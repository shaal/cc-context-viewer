/**
 * Context route handlers
 *
 * Provides access to the conversation context for display and management.
 */

import { Router, type Request, type Response } from 'express';
import { contextStore } from '../services/context-store.js';
import { claudeClient } from '../services/claude-client.js';

const router = Router();

/**
 * GET /api/context
 * Returns the full conversation context
 */
router.get('/', (req: Request, res: Response) => {
  const context = contextStore.getContext();
  res.json(context);
});

/**
 * GET /api/context/blocks
 * Returns just the context blocks (lighter payload)
 */
router.get('/blocks', (req: Request, res: Response) => {
  const blocks = contextStore.getBlocks();
  res.json({
    count: blocks.length,
    blocks,
  });
});

/**
 * GET /api/context/stats
 * Returns context statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  const context = contextStore.getContext();
  const blocks = context.blocks;

  // Count blocks by type
  const blocksByType = blocks.reduce(
    (acc, block) => {
      acc[block.type] = (acc[block.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  res.json({
    conversationId: context.id,
    createdAt: context.createdAt,
    updatedAt: context.updatedAt,
    totalBlocks: blocks.length,
    blocksByType,
    totalInputTokens: context.totalInputTokens,
    totalOutputTokens: context.totalOutputTokens,
    totalTokens: context.totalInputTokens + context.totalOutputTokens,
  });
});

/**
 * DELETE /api/context
 * Clears the conversation context
 */
router.delete('/', (req: Request, res: Response) => {
  claudeClient.clear();
  res.json({
    success: true,
    message: 'Context cleared',
    newContext: contextStore.getContext(),
  });
});

/**
 * POST /api/context/initialize
 * Initialize context with custom system prompt and tools
 */
router.post('/initialize', (req: Request, res: Response) => {
  const { systemPrompt, tools } = req.body;

  claudeClient.clear();
  claudeClient.initialize(systemPrompt, tools);

  res.json({
    success: true,
    context: contextStore.getContext(),
  });
});

export default router;
