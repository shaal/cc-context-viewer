/**
 * Server-Sent Events (SSE) utilities
 *
 * Handles the streaming protocol between server and client.
 * SSE is preferred over WebSockets for this use case because:
 * 1. It's simpler (HTTP-based, auto-reconnect)
 * 2. Claude streams are unidirectional (server → client)
 * 3. Better compatibility with proxies and load balancers
 */

import type { Response } from 'express';
import type { SSEEventType } from '../types/index.js';

/**
 * Initializes an SSE connection
 */
export function initSSE(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();
}

/**
 * Sends an SSE event to the client
 */
export function sendSSE(
  res: Response,
  eventType: SSEEventType,
  data: unknown
): void {
  // SSE format: event type, then data, then double newline
  res.write(`event: ${eventType}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Sends a heartbeat to keep the connection alive
 */
export function sendHeartbeat(res: Response): void {
  res.write(`: heartbeat\n\n`);
}

/**
 * Creates a heartbeat interval
 * Returns a cleanup function
 */
export function startHeartbeat(res: Response, intervalMs = 30000): () => void {
  const interval = setInterval(() => {
    if (!res.writableEnded) {
      sendHeartbeat(res);
    }
  }, intervalMs);

  return () => clearInterval(interval);
}

/**
 * Closes an SSE connection gracefully
 */
export function closeSSE(res: Response): void {
  if (!res.writableEnded) {
    res.end();
  }
}

/**
 * Creates an SSE stream handler with automatic cleanup
 */
export function createSSEHandler(
  res: Response,
  onClose?: () => void
): {
  send: (eventType: SSEEventType, data: unknown) => void;
  close: () => void;
  cleanup: () => void;
} {
  initSSE(res);
  const stopHeartbeat = startHeartbeat(res);

  // Handle client disconnect
  res.on('close', () => {
    stopHeartbeat();
    onClose?.();
  });

  return {
    send: (eventType: SSEEventType, data: unknown) => {
      if (!res.writableEnded) {
        sendSSE(res, eventType, data);
      }
    },
    close: () => {
      stopHeartbeat();
      closeSSE(res);
    },
    cleanup: () => {
      stopHeartbeat();
    },
  };
}
