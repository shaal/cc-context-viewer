/**
 * Shared type definitions for Claude Context Viewer
 * These types are used by both server and client
 */

/**
 * Content types that can appear in a Claude conversation
 */
export enum ContentType {
  SYSTEM = 'system',
  TOOL_DEFINITION = 'tool_definition',
  USER = 'user',
  ASSISTANT_THINKING = 'thinking',
  ASSISTANT_TEXT = 'text',
  TOOL_USE = 'tool_use',
  TOOL_RESULT = 'tool_result',
  ERROR = 'error',
}

/**
 * A single block of content in the conversation context
 */
export interface ContextBlock {
  id: string;
  type: ContentType;
  content: string;
  timestamp: string;
  metadata?: BlockMetadata;
  isStreaming?: boolean;
  isCollapsed?: boolean;
  estimatedHeight?: number;
}

/**
 * Metadata associated with a context block
 */
export interface BlockMetadata {
  model?: string;
  toolName?: string;
  toolId?: string;
  inputTokens?: number;
  outputTokens?: number;
  stopReason?: string;
  messageId?: string;
}

/**
 * Server-sent event types for streaming
 */
export type SSEEventType =
  | 'connected'
  | 'message_start'
  | 'content_block_start'
  | 'content_block_delta'
  | 'content_block_stop'
  | 'message_delta'
  | 'message_stop'
  | 'tool_result'
  | 'error';

/**
 * Base structure for SSE events
 */
export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
}

/**
 * Event sent when a new message starts
 */
export interface MessageStartEvent {
  type: 'message_start';
  data: {
    messageId: string;
    model: string;
  };
}

/**
 * Event sent when a content block starts
 */
export interface ContentBlockStartEvent {
  type: 'content_block_start';
  data: {
    blockId: string;
    blockType: ContentType;
    toolName?: string;
    toolId?: string;
  };
}

/**
 * Event sent for incremental content updates
 */
export interface ContentBlockDeltaEvent {
  type: 'content_block_delta';
  data: {
    blockId: string;
    delta: string;
  };
}

/**
 * Event sent when a content block is complete
 */
export interface ContentBlockStopEvent {
  type: 'content_block_stop';
  data: {
    blockId: string;
  };
}

/**
 * Event sent when a message is complete
 */
export interface MessageStopEvent {
  type: 'message_stop';
  data: {
    messageId: string;
    stopReason: string;
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Event sent when an error occurs
 */
export interface ErrorEvent {
  type: 'error';
  data: {
    message: string;
    code?: string;
  };
}

/**
 * Tool definition structure
 */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Chat request from client
 */
export interface ChatRequest {
  message: string;
  systemPrompt?: string;
}

/**
 * Context export formats
 */
export type ExportFormat = 'json' | 'text' | 'html';

/**
 * Full conversation context
 */
export interface ConversationContext {
  id: string;
  createdAt: string;
  updatedAt: string;
  systemPrompt?: string;
  tools: ToolDefinition[];
  blocks: ContextBlock[];
  totalInputTokens: number;
  totalOutputTokens: number;
}
