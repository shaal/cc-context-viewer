/**
 * Claude API Client
 *
 * Wraps the official Anthropic SDK to provide streaming responses
 * and manage conversation state. Handles all communication with the
 * Claude API.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ContentBlock, ToolUseBlock, TextBlock } from '@anthropic-ai/sdk/resources/messages';
import { contextStore } from './context-store.js';
import { ContentType, type ToolDefinition } from '../types/index.js';

// Example tools for demonstration - can be customized
const DEFAULT_TOOLS: ToolDefinition[] = [
  {
    name: 'get_current_time',
    description: 'Get the current date and time',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'calculate',
    description: 'Perform a mathematical calculation',
    input_schema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'The mathematical expression to evaluate',
        },
      },
      required: ['expression'],
    },
  },
];

// Default system prompt
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. You have access to tools that can help you perform various tasks. When a user asks you to do something that requires a tool, use the appropriate tool to help them.

Be concise but thorough in your responses. If you're thinking through a problem, show your reasoning.`;

/**
 * Type for streaming event callbacks
 */
export interface StreamCallbacks {
  onMessageStart: (messageId: string, model: string) => void;
  onContentBlockStart: (blockId: string, blockType: ContentType, toolName?: string, toolId?: string) => void;
  onContentBlockDelta: (blockId: string, delta: string) => void;
  onContentBlockStop: (blockId: string) => void;
  onMessageStop: (messageId: string, stopReason: string, inputTokens: number, outputTokens: number) => void;
  onError: (error: Error) => void;
}

class ClaudeClient {
  private client: Anthropic;
  private model: string;
  private messages: MessageParam[] = [];
  private systemPrompt: string;
  private tools: ToolDefinition[];
  private enableThinking: boolean;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
    this.enableThinking = process.env.ENABLE_THINKING === 'true';
    this.systemPrompt = DEFAULT_SYSTEM_PROMPT;
    this.tools = DEFAULT_TOOLS;
  }

  /**
   * Initializes the context store with system prompt and tools
   */
  initialize(systemPrompt?: string, tools?: ToolDefinition[]): void {
    if (systemPrompt) {
      this.systemPrompt = systemPrompt;
    }
    if (tools) {
      this.tools = tools;
    }

    // Store in context for display
    contextStore.setSystemPrompt(this.systemPrompt);
    contextStore.setTools(this.tools);
  }

  /**
   * Sends a message and streams the response
   */
  async sendMessage(userMessage: string, callbacks: StreamCallbacks): Promise<void> {
    // Add user message to context
    contextStore.addBlock(ContentType.USER, userMessage);

    // Add to conversation history
    this.messages.push({
      role: 'user',
      content: userMessage,
    });

    try {
      // Create streaming message request
      const streamParams: Anthropic.MessageCreateParams = {
        model: this.model,
        max_tokens: 8192,
        system: this.systemPrompt,
        messages: this.messages,
        tools: this.tools.map(t => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema as Anthropic.Tool['input_schema'],
        })),
        stream: true,
      };

      // Add thinking if enabled and model supports it
      if (this.enableThinking && this.model.includes('claude-3-5')) {
        // Note: Extended thinking requires specific API parameters
        // This is a placeholder - adjust based on actual SDK support
      }

      const stream = this.client.messages.stream(streamParams);

      let currentBlockId: string | null = null;
      let messageId: string | null = null;
      let blockIndex = 0;
      const blockMap = new Map<number, string>(); // Maps API block index to our block ID

      // Handle stream events
      stream.on('message', (message) => {
        messageId = message.id;
        callbacks.onMessageStart(message.id, message.model);
      });

      stream.on('contentBlockStart', (event) => {
        const idx = event.index;
        const contentBlock = event.content_block;

        let blockType: ContentType;
        let toolName: string | undefined;
        let toolId: string | undefined;

        if (contentBlock.type === 'tool_use') {
          blockType = ContentType.TOOL_USE;
          toolName = contentBlock.name;
          toolId = contentBlock.id;
        } else if (contentBlock.type === 'thinking') {
          blockType = ContentType.ASSISTANT_THINKING;
        } else {
          blockType = ContentType.ASSISTANT_TEXT;
        }

        // Create streaming block in context store
        const block = contextStore.createStreamingBlock(blockType, {
          toolName,
          toolId,
          messageId: messageId || undefined,
        });

        currentBlockId = block.id;
        blockMap.set(idx, block.id);
        callbacks.onContentBlockStart(block.id, blockType, toolName, toolId);
      });

      stream.on('contentBlockDelta', (event) => {
        const blockId = blockMap.get(event.index);
        if (!blockId) return;

        let delta = '';
        if (event.delta.type === 'text_delta') {
          delta = event.delta.text;
        } else if (event.delta.type === 'thinking_delta') {
          delta = event.delta.thinking;
        } else if (event.delta.type === 'input_json_delta') {
          delta = event.delta.partial_json;
        }

        if (delta) {
          contextStore.appendToBlock(blockId, delta);
          callbacks.onContentBlockDelta(blockId, delta);
        }
      });

      stream.on('contentBlockStop', (event) => {
        const blockId = blockMap.get(event.index);
        if (blockId) {
          contextStore.finalizeBlock(blockId);
          callbacks.onContentBlockStop(blockId);
        }
      });

      // Wait for the stream to complete
      const finalMessage = await stream.finalMessage();

      // Update token usage
      contextStore.updateTokenUsage(
        finalMessage.usage.input_tokens,
        finalMessage.usage.output_tokens
      );

      callbacks.onMessageStop(
        finalMessage.id,
        finalMessage.stop_reason || 'end_turn',
        finalMessage.usage.input_tokens,
        finalMessage.usage.output_tokens
      );

      // Add assistant response to conversation history
      this.messages.push({
        role: 'assistant',
        content: finalMessage.content,
      });

      // Handle tool use if needed
      if (finalMessage.stop_reason === 'tool_use') {
        await this.handleToolUse(finalMessage.content, callbacks);
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      contextStore.addBlock(ContentType.ERROR, err.message);
      callbacks.onError(err);
    }
  }

  /**
   * Handles tool use by executing tools and continuing conversation
   */
  private async handleToolUse(
    content: ContentBlock[],
    callbacks: StreamCallbacks
  ): Promise<void> {
    const toolUseBlocks = content.filter(
      (block): block is ToolUseBlock => block.type === 'tool_use'
    );

    const toolResults: Array<{
      type: 'tool_result';
      tool_use_id: string;
      content: string;
    }> = [];

    for (const toolUse of toolUseBlocks) {
      const result = await this.executeTool(toolUse.name, toolUse.input as Record<string, unknown>);

      // Add tool result to context
      contextStore.addBlock(ContentType.TOOL_RESULT, result, {
        toolName: toolUse.name,
        toolId: toolUse.id,
      });

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    // Add tool results to conversation and continue
    this.messages.push({
      role: 'user',
      content: toolResults,
    });

    // Continue conversation after tool use
    await this.sendMessage('', callbacks);
  }

  /**
   * Executes a tool and returns the result
   */
  private async executeTool(
    name: string,
    input: Record<string, unknown>
  ): Promise<string> {
    switch (name) {
      case 'get_current_time':
        return new Date().toISOString();

      case 'calculate':
        try {
          const expression = input.expression as string;
          // Simple safe evaluation - in production use a proper math parser
          const result = Function(`"use strict"; return (${expression})`)();
          return String(result);
        } catch {
          return 'Error: Invalid expression';
        }

      default:
        return `Tool "${name}" not implemented`;
    }
  }

  /**
   * Clears the conversation history
   */
  clear(): void {
    this.messages = [];
    contextStore.clear();
    // Re-initialize with system prompt and tools
    this.initialize();
  }

  /**
   * Gets the available tools
   */
  getTools(): ToolDefinition[] {
    return this.tools;
  }

  /**
   * Sets a custom system prompt
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
    contextStore.clear();
    this.initialize();
  }

  /**
   * Checks if the client is properly configured
   */
  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }
}

// Singleton instance
export const claudeClient = new ClaudeClient();
