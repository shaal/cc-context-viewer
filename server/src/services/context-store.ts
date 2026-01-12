/**
 * In-memory storage for conversation context
 *
 * This store maintains the full conversation state including all messages,
 * tool calls, and responses. It's designed to be easily serializable for
 * export functionality.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ContextBlock,
  ContentType,
  ConversationContext,
  ToolDefinition,
  BlockMetadata,
} from '../types/index.js';

class ContextStore {
  private context: ConversationContext;

  constructor() {
    this.context = this.createEmptyContext();
  }

  /**
   * Creates a new empty conversation context
   */
  private createEmptyContext(): ConversationContext {
    const now = new Date().toISOString();
    return {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      systemPrompt: undefined,
      tools: [],
      blocks: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
    };
  }

  /**
   * Gets the current conversation context
   */
  getContext(): ConversationContext {
    return { ...this.context };
  }

  /**
   * Gets all context blocks
   */
  getBlocks(): ContextBlock[] {
    return [...this.context.blocks];
  }

  /**
   * Sets the system prompt
   */
  setSystemPrompt(prompt: string): ContextBlock {
    this.context.systemPrompt = prompt;
    this.context.updatedAt = new Date().toISOString();

    // Add as a block for display
    const block = this.addBlock('system' as ContentType, prompt);
    return block;
  }

  /**
   * Sets the available tools
   */
  setTools(tools: ToolDefinition[]): ContextBlock[] {
    this.context.tools = tools;
    this.context.updatedAt = new Date().toISOString();

    // Add each tool as a block for display
    return tools.map((tool) =>
      this.addBlock(
        'tool_definition' as ContentType,
        JSON.stringify(tool, null, 2),
        { toolName: tool.name }
      )
    );
  }

  /**
   * Adds a new block to the context
   */
  addBlock(
    type: ContentType,
    content: string,
    metadata?: BlockMetadata
  ): ContextBlock {
    const block: ContextBlock = {
      id: uuidv4(),
      type,
      content,
      timestamp: new Date().toISOString(),
      metadata,
      isStreaming: false,
      estimatedHeight: this.estimateHeight(content),
    };

    this.context.blocks.push(block);
    this.context.updatedAt = new Date().toISOString();

    return block;
  }

  /**
   * Creates a new streaming block (content will be appended)
   */
  createStreamingBlock(
    type: ContentType,
    metadata?: BlockMetadata
  ): ContextBlock {
    const block: ContextBlock = {
      id: uuidv4(),
      type,
      content: '',
      timestamp: new Date().toISOString(),
      metadata,
      isStreaming: true,
      estimatedHeight: 50, // Initial estimate
    };

    this.context.blocks.push(block);
    this.context.updatedAt = new Date().toISOString();

    return block;
  }

  /**
   * Appends content to a streaming block
   */
  appendToBlock(blockId: string, delta: string): ContextBlock | null {
    const block = this.context.blocks.find((b) => b.id === blockId);
    if (!block) return null;

    block.content += delta;
    block.estimatedHeight = this.estimateHeight(block.content);
    this.context.updatedAt = new Date().toISOString();

    return block;
  }

  /**
   * Marks a block as no longer streaming
   */
  finalizeBlock(blockId: string, metadata?: Partial<BlockMetadata>): ContextBlock | null {
    const block = this.context.blocks.find((b) => b.id === blockId);
    if (!block) return null;

    block.isStreaming = false;
    if (metadata) {
      block.metadata = { ...block.metadata, ...metadata };
    }
    this.context.updatedAt = new Date().toISOString();

    return block;
  }

  /**
   * Updates token usage statistics
   */
  updateTokenUsage(inputTokens: number, outputTokens: number): void {
    this.context.totalInputTokens += inputTokens;
    this.context.totalOutputTokens += outputTokens;
    this.context.updatedAt = new Date().toISOString();
  }

  /**
   * Clears the conversation and starts fresh
   */
  clear(): void {
    this.context = this.createEmptyContext();
  }

  /**
   * Estimates the display height of content (for virtual scrolling)
   * This is a rough estimate based on character count and line breaks
   */
  private estimateHeight(content: string): number {
    const lineCount = content.split('\n').length;
    const avgCharsPerLine = 80;
    const estimatedLines = Math.max(
      lineCount,
      Math.ceil(content.length / avgCharsPerLine)
    );
    // Assume ~24px per line + padding
    return Math.max(60, estimatedLines * 24 + 40);
  }

  /**
   * Gets a block by ID
   */
  getBlock(blockId: string): ContextBlock | undefined {
    return this.context.blocks.find((b) => b.id === blockId);
  }

  /**
   * Gets blocks by type
   */
  getBlocksByType(type: ContentType): ContextBlock[] {
    return this.context.blocks.filter((b) => b.type === type);
  }

  /**
   * Gets the total number of blocks
   */
  getBlockCount(): number {
    return this.context.blocks.length;
  }

  /**
   * Exports context to JSON format
   */
  toJSON(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        ...this.context,
      },
      null,
      2
    );
  }

  /**
   * Exports context to plain text format
   */
  toText(): string {
    const lines: string[] = [
      '=== CLAUDE CONTEXT VIEWER EXPORT ===',
      `Exported: ${new Date().toISOString()}`,
      `Conversation ID: ${this.context.id}`,
      `Total Messages: ${this.context.blocks.length}`,
      `Total Input Tokens: ${this.context.totalInputTokens}`,
      `Total Output Tokens: ${this.context.totalOutputTokens}`,
      '',
    ];

    for (const block of this.context.blocks) {
      lines.push(`--- ${block.type.toUpperCase()} (${block.timestamp}) ---`);
      if (block.metadata?.toolName) {
        lines.push(`Tool: ${block.metadata.toolName}`);
      }
      lines.push(block.content);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Exports context to HTML format with syntax highlighting
   */
  toHTML(): string {
    const styles = `
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
        .block { margin: 10px 0; padding: 15px; border-radius: 8px; border-left: 4px solid; }
        .system { background: #E3F2FD; border-color: #1976D2; }
        .tool_definition { background: #E8F5E9; border-color: #43A047; }
        .user { background: #FFFDE7; border-color: #FBC02D; }
        .thinking { background: #F3E5F5; border-color: #9C27B0; }
        .text { background: #FFFFFF; border-color: #E0E0E0; }
        .tool_use { background: #FFF3E0; border-color: #FB8C00; }
        .tool_result { background: #FFEBEE; border-color: #EF5350; }
        .error { background: #ECEFF1; border-color: #F44336; }
        .header { font-size: 12px; color: #666; margin-bottom: 8px; }
        .content { white-space: pre-wrap; font-family: 'Monaco', 'Menlo', monospace; font-size: 13px; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
      </style>
    `;

    const blocks = this.context.blocks
      .map((block) => {
        const toolInfo = block.metadata?.toolName
          ? ` | Tool: ${block.metadata.toolName}`
          : '';
        return `
        <div class="block ${block.type}">
          <div class="header">${block.type.toUpperCase()} | ${block.timestamp}${toolInfo}</div>
          <div class="content">${this.escapeHtml(block.content)}</div>
        </div>
      `;
      })
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Context Export - ${this.context.id}</title>
  ${styles}
</head>
<body>
  <h1>Claude Context Viewer Export</h1>
  <p>
    <strong>Conversation ID:</strong> ${this.context.id}<br>
    <strong>Exported:</strong> ${new Date().toISOString()}<br>
    <strong>Messages:</strong> ${this.context.blocks.length}<br>
    <strong>Tokens:</strong> ${this.context.totalInputTokens} in / ${this.context.totalOutputTokens} out
  </p>
  ${blocks}
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Singleton instance
export const contextStore = new ContextStore();
