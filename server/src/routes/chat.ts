/**
 * Chat route handlers
 *
 * Handles user messages and streams Claude responses back via SSE.
 */

import { Router, type Request, type Response } from 'express';
import { claudeClient, type StreamCallbacks } from '../services/claude-client.js';
import { createSSEHandler } from '../services/streaming.js';
import type { ChatRequest, ContentType } from '../types/index.js';

const router = Router();

/**
 * POST /api/chat
 * Send a message to Claude and stream the response
 */
router.post('/', async (req: Request, res: Response) => {
  const { message, systemPrompt } = req.body as ChatRequest;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  // Check if API is configured
  if (!claudeClient.isConfigured()) {
    res.status(500).json({
      error: 'ANTHROPIC_API_KEY not configured',
    });
    return;
  }

  // Update system prompt if provided
  if (systemPrompt) {
    claudeClient.setSystemPrompt(systemPrompt);
  }

  // Set up SSE streaming
  const sse = createSSEHandler(res);

  // Send initial connection event
  sse.send('connected', { status: 'connected' });

  // Create callbacks for streaming events
  const callbacks: StreamCallbacks = {
    onMessageStart: (messageId, model) => {
      sse.send('message_start', { messageId, model });
    },
    onContentBlockStart: (blockId, blockType, toolName, toolId) => {
      sse.send('content_block_start', {
        blockId,
        blockType,
        toolName,
        toolId,
      });
    },
    onContentBlockDelta: (blockId, delta) => {
      sse.send('content_block_delta', { blockId, delta });
    },
    onContentBlockStop: (blockId) => {
      sse.send('content_block_stop', { blockId });
    },
    onMessageStop: (messageId, stopReason, inputTokens, outputTokens) => {
      sse.send('message_stop', {
        messageId,
        stopReason,
        inputTokens,
        outputTokens,
      });
      // Only close SSE if this is the final message (not continuing with tool use)
      if (stopReason !== 'tool_use') {
        sse.close();
      }
    },
    onToolResult: (toolId, toolName, result) => {
      sse.send('tool_result', {
        toolId,
        toolName,
        result,
      });
    },
    onError: (error) => {
      sse.send('error', {
        message: error.message,
        code: (error as NodeJS.ErrnoException).code,
      });
      sse.close();
    },
  };

  try {
    await claudeClient.sendMessage(message, callbacks);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    callbacks.onError(err);
  }
});

export default router;
