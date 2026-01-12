/**
 * Worker Manager
 *
 * Singleton wrapper for Web Worker communication with Promise-based API.
 * Handles worker lifecycle, error recovery, and request/response matching.
 */

import type { SearchMatch, ContextBlock } from '$types';

// Response types from worker
type WorkerResponse =
  | { type: 'ready' }
  | { type: 'indexed'; count: number }
  | { type: 'searchResults'; matches: SearchMatch[]; query: string }
  | { type: 'heights'; data: Record<string, number> }
  | { type: 'error'; message: string };

// Pending request tracker
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  type: string;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Manager class for parser worker communication
 */
class ParserWorkerManager {
  private worker: Worker | null = null;
  private isReady = false;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestCounter = 0;
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds

  /**
   * Initialize the worker
   */
  async initialize(): Promise<void> {
    if (this.worker) return;

    return new Promise((resolve, reject) => {
      try {
        // Create worker using Vite's worker import syntax
        this.worker = new Worker(
          new URL('../../workers/parser.worker.ts', import.meta.url),
          { type: 'module' }
        );

        // Set up message handler
        this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          this.handleMessage(event.data);
        };

        // Set up error handler
        this.worker.onerror = (error) => {
          console.error('Worker error:', error);
          this.handleWorkerError(new Error(error.message));
        };

        // Wait for ready signal
        const readyTimeout = setTimeout(() => {
          reject(new Error('Worker initialization timeout'));
        }, 5000);

        const originalHandler = this.worker.onmessage;
        this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          if (event.data.type === 'ready') {
            clearTimeout(readyTimeout);
            this.isReady = true;
            this.worker!.onmessage = originalHandler;
            resolve();
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming messages from worker
   */
  private handleMessage(response: WorkerResponse): void {
    // Find matching pending request
    for (const [id, request] of this.pendingRequests.entries()) {
      if (this.matchesRequest(response, request.type)) {
        clearTimeout(request.timeout);
        this.pendingRequests.delete(id);

        if (response.type === 'error') {
          request.reject(new Error(response.message));
        } else {
          request.resolve(response);
        }
        return;
      }
    }
  }

  /**
   * Check if response matches request type
   */
  private matchesRequest(response: WorkerResponse, requestType: string): boolean {
    switch (requestType) {
      case 'index':
      case 'updateBlock':
      case 'clear':
        return response.type === 'indexed' || response.type === 'error';
      case 'search':
        return response.type === 'searchResults' || response.type === 'error';
      case 'calculateHeights':
        return response.type === 'heights' || response.type === 'error';
      default:
        return response.type === 'error';
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(error: Error): void {
    // Reject all pending requests
    for (const [id, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeout);
      request.reject(error);
    }
    this.pendingRequests.clear();

    // Recreate worker
    this.terminate();
  }

  /**
   * Send a message to the worker and wait for response
   */
  private async sendMessage<T>(
    message: Record<string, unknown>,
    requestType: string
  ): Promise<T> {
    if (!this.worker || !this.isReady) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const requestId = `${requestType}-${++this.requestCounter}`;

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request ${requestType} timed out`));
      }, this.REQUEST_TIMEOUT);

      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        type: requestType,
        timeout,
      });

      this.worker!.postMessage(message);
    });
  }

  /**
   * Index blocks for searching
   */
  async indexBlocks(blocks: ContextBlock[]): Promise<number> {
    const message = {
      type: 'index',
      blocks: blocks.map((b) => ({
        id: b.id,
        content: b.content,
        type: b.type,
      })),
    };
    const response = await this.sendMessage<{ type: 'indexed'; count: number }>(
      message,
      'index'
    );
    return response.count;
  }

  /**
   * Update a single block in the index
   */
  async updateBlock(block: ContextBlock): Promise<void> {
    const message = {
      type: 'updateBlock',
      block: {
        id: block.id,
        content: block.content,
        type: block.type,
      },
    };
    await this.sendMessage(message, 'updateBlock');
  }

  /**
   * Search for a query string
   */
  async search(query: string): Promise<SearchMatch[]> {
    const message = { type: 'search', query };
    const response = await this.sendMessage<{
      type: 'searchResults';
      matches: SearchMatch[];
    }>(message, 'search');
    return response.matches;
  }

  /**
   * Calculate heights for blocks
   */
  async calculateHeights(
    blocks: ContextBlock[],
    fontSize: number
  ): Promise<Record<string, number>> {
    const message = {
      type: 'calculateHeights',
      blocks: blocks.map((b) => ({
        id: b.id,
        content: b.content,
        type: b.type,
      })),
      fontSize,
    };
    const response = await this.sendMessage<{
      type: 'heights';
      data: Record<string, number>;
    }>(message, 'calculateHeights');
    return response.data;
  }

  /**
   * Clear the search index
   */
  async clear(): Promise<void> {
    const message = { type: 'clear' };
    await this.sendMessage(message, 'clear');
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }

  /**
   * Check if worker is ready
   */
  get ready(): boolean {
    return this.isReady;
  }
}

// Export singleton instance
export const parserWorker = new ParserWorkerManager();
