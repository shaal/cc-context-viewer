/**
 * Context Store
 *
 * Central state management for the conversation context.
 * Handles SSE streaming, block updates, and connection state.
 */

import { writable, derived, get } from 'svelte/store';
import type {
  ContextBlock,
  ConversationContext,
  ConnectionStatus,
  SSEEventType,
  ContentType,
} from '$types';

// Connection status store
export const connectionStatus = writable<ConnectionStatus>({
  connected: false,
  streaming: false,
  error: undefined,
});

// Raw context blocks
export const blocks = writable<ContextBlock[]>([]);

// Token usage
export const tokenUsage = writable<{ input: number; output: number }>({
  input: 0,
  output: 0,
});

// Conversation metadata
export const conversationId = writable<string>('');

// Project info
export const projectInfo = writable<{ projectDir: string; projectName: string }>({
  projectDir: '',
  projectName: '',
});

// Current message being streamed
const currentStreamingBlockId = writable<string | null>(null);

/**
 * Fetches the project info from the server
 */
export async function fetchProjectInfo(): Promise<void> {
  try {
    const response = await fetch('/api/project');
    if (!response.ok) throw new Error('Failed to fetch project info');

    const info = await response.json();
    projectInfo.set(info);
  } catch (error) {
    console.error('Failed to fetch project info:', error);
  }
}

/**
 * Fetches the full context from the server
 */
export async function fetchContext(): Promise<void> {
  try {
    // Fetch project info in parallel
    fetchProjectInfo();

    const response = await fetch('/api/context');
    if (!response.ok) throw new Error('Failed to fetch context');

    const context: ConversationContext = await response.json();

    blocks.set(context.blocks);
    tokenUsage.set({
      input: context.totalInputTokens,
      output: context.totalOutputTokens,
    });
    conversationId.set(context.id);
    connectionStatus.update((s) => ({ ...s, connected: true, error: undefined }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    connectionStatus.update((s) => ({ ...s, error: message }));
  }
}

/**
 * Clears the conversation context
 */
export async function clearContext(): Promise<void> {
  try {
    const response = await fetch('/api/context', { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to clear context');

    const result = await response.json();
    blocks.set(result.newContext.blocks);
    tokenUsage.set({ input: 0, output: 0 });
    conversationId.set(result.newContext.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    connectionStatus.update((s) => ({ ...s, error: message }));
  }
}

/**
 * Sends a message and handles the streaming response
 */
export async function sendMessage(
  message: string,
  onComplete?: () => void
): Promise<void> {
  if (!message.trim()) return;

  connectionStatus.update((s) => ({ ...s, streaming: true, error: undefined }));

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    // Add user message to blocks immediately
    const userBlock: ContextBlock = {
      id: `user-${Date.now()}`,
      type: 'user' as ContentType,
      content: message,
      timestamp: new Date().toISOString(),
      isStreaming: false,
    };
    blocks.update((b) => [...b, userBlock]);

    // Process SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          const eventType = line.slice(7).trim() as SSEEventType;
          continue;
        }
        if (line.startsWith('data:')) {
          const data = JSON.parse(line.slice(5).trim());
          handleSSEEvent(data);
        }
      }
    }

    connectionStatus.update((s) => ({ ...s, streaming: false }));
    onComplete?.();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    connectionStatus.update((s) => ({
      ...s,
      streaming: false,
      error: message,
    }));

    // Add error block
    const errorBlock: ContextBlock = {
      id: `error-${Date.now()}`,
      type: 'error' as ContentType,
      content: message,
      timestamp: new Date().toISOString(),
      isStreaming: false,
    };
    blocks.update((b) => [...b, errorBlock]);
  }
}

/**
 * Handles incoming SSE events
 */
function handleSSEEvent(data: Record<string, unknown>): void {
  // Determine event type from data structure
  if ('messageId' in data && 'model' in data && !('stopReason' in data)) {
    // message_start
    return;
  }

  if ('blockId' in data && 'blockType' in data) {
    // content_block_start
    const newBlock: ContextBlock = {
      id: data.blockId as string,
      type: data.blockType as ContentType,
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
      metadata: {
        toolName: data.toolName as string | undefined,
        toolId: data.toolId as string | undefined,
      },
    };
    blocks.update((b) => [...b, newBlock]);
    currentStreamingBlockId.set(data.blockId as string);
    return;
  }

  if ('blockId' in data && 'delta' in data) {
    // content_block_delta
    const blockId = data.blockId as string;
    const delta = data.delta as string;
    blocks.update((b) =>
      b.map((block) =>
        block.id === blockId
          ? { ...block, content: block.content + delta }
          : block
      )
    );
    return;
  }

  if ('blockId' in data && !('delta' in data) && !('blockType' in data)) {
    // content_block_stop
    const blockId = data.blockId as string;
    blocks.update((b) =>
      b.map((block) =>
        block.id === blockId ? { ...block, isStreaming: false } : block
      )
    );
    currentStreamingBlockId.set(null);
    return;
  }

  if ('messageId' in data && 'stopReason' in data) {
    // message_stop
    tokenUsage.update((t) => ({
      input: t.input + (data.inputTokens as number || 0),
      output: t.output + (data.outputTokens as number || 0),
    }));
    return;
  }

  if ('message' in data && 'code' in data) {
    // error
    connectionStatus.update((s) => ({
      ...s,
      error: data.message as string,
    }));
    return;
  }
}

/**
 * Derived store: blocks filtered by active filters
 */
export function createFilteredBlocks(activeFilters: Set<ContentType>) {
  return derived(blocks, ($blocks) => {
    if (activeFilters.size === 0) return $blocks;
    return $blocks.filter((block) => activeFilters.has(block.type));
  });
}

/**
 * Derived store: block count by type
 */
export const blockCountByType = derived(blocks, ($blocks) => {
  const counts: Record<string, number> = {};
  for (const block of $blocks) {
    counts[block.type] = (counts[block.type] || 0) + 1;
  }
  return counts;
});

/**
 * Derived store: total block count
 */
export const totalBlockCount = derived(blocks, ($blocks) => $blocks.length);

/**
 * Check if currently streaming
 */
export const isStreaming = derived(
  connectionStatus,
  ($status) => $status.streaming
);
