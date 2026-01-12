/**
 * Client-side type definitions
 * Mirrors server types for type safety across the stack
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

export interface BlockMetadata {
  model?: string;
  toolName?: string;
  toolId?: string;
  inputTokens?: number;
  outputTokens?: number;
  stopReason?: string;
  messageId?: string;
}

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

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type SSEEventType =
  | 'connected'
  | 'message_start'
  | 'content_block_start'
  | 'content_block_delta'
  | 'content_block_stop'
  | 'message_delta'
  | 'message_stop'
  | 'error';

export interface SSEMessage {
  event: SSEEventType;
  data: unknown;
}

export interface SearchMatch {
  blockId: string;
  startIndex: number;
  endIndex: number;
  text: string;
}

export interface ConnectionStatus {
  connected: boolean;
  streaming: boolean;
  error?: string;
}

export type ExportFormat = 'json' | 'text' | 'html';

/**
 * Color configuration for each content type
 */
export const CONTENT_TYPE_COLORS: Record<ContentType, {
  bg: string;
  text: string;
  border: string;
  label: string;
}> = {
  [ContentType.SYSTEM]: {
    bg: 'var(--color-system-bg)',
    text: 'var(--color-system-text)',
    border: 'var(--color-system-border)',
    label: 'System',
  },
  [ContentType.TOOL_DEFINITION]: {
    bg: 'var(--color-tool-def-bg)',
    text: 'var(--color-tool-def-text)',
    border: 'var(--color-tool-def-border)',
    label: 'Tool Definition',
  },
  [ContentType.USER]: {
    bg: 'var(--color-user-bg)',
    text: 'var(--color-user-text)',
    border: 'var(--color-user-border)',
    label: 'User',
  },
  [ContentType.ASSISTANT_THINKING]: {
    bg: 'var(--color-thinking-bg)',
    text: 'var(--color-thinking-text)',
    border: 'var(--color-thinking-border)',
    label: 'Thinking',
  },
  [ContentType.ASSISTANT_TEXT]: {
    bg: 'var(--color-text-bg)',
    text: 'var(--color-text-text)',
    border: 'var(--color-text-border)',
    label: 'Assistant',
  },
  [ContentType.TOOL_USE]: {
    bg: 'var(--color-tool-use-bg)',
    text: 'var(--color-tool-use-text)',
    border: 'var(--color-tool-use-border)',
    label: 'Tool Call',
  },
  [ContentType.TOOL_RESULT]: {
    bg: 'var(--color-tool-result-bg)',
    text: 'var(--color-tool-result-text)',
    border: 'var(--color-tool-result-border)',
    label: 'Tool Result',
  },
  [ContentType.ERROR]: {
    bg: 'var(--color-error-bg)',
    text: 'var(--color-error-text)',
    border: 'var(--color-error-border)',
    label: 'Error',
  },
};
