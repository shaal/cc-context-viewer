/**
 * Claude Context Viewer - Server Entry Point
 *
 * Express server that provides:
 * - SSE streaming for Claude API responses
 * - REST endpoints for context management
 * - Export functionality in multiple formats
 *
 * Environment Variables:
 * - ANTHROPIC_API_KEY: Optional - Your Anthropic API key (falls back to cliproxyapi)
 * - CLIPROXYAPI_URL: Optional - Custom proxy URL (default: http://localhost:8318)
 * - CLIPROXYAPI_PATH: Optional - Path to cliproxyapi (default: ~/code/utilities/cliproxyapi)
 * - PORT: Optional - Server port (default: 3001)
 * - NODE_ENV: Optional - Environment (development/production)
 * - CLAUDE_MODEL: Optional - Model to use (default: claude-sonnet-4-20250514)
 * - ENABLE_THINKING: Optional - Enable extended thinking (default: false)
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import chatRouter from './routes/chat.js';
import contextRouter from './routes/context.js';
import exportRouter from './routes/export.js';
import { claudeClient } from './services/claude-client.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGIN
    : ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    configured: claudeClient.isConfigured(),
    apiMode: claudeClient.getApiMode(),
    configurationStatus: claudeClient.getConfigurationStatus(),
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Claude Context Viewer API',
    version: '1.0.0',
    endpoints: {
      'POST /api/chat': 'Send message and stream response (SSE)',
      'GET /api/context': 'Get full conversation context',
      'GET /api/context/blocks': 'Get context blocks only',
      'GET /api/context/stats': 'Get context statistics',
      'DELETE /api/context': 'Clear conversation',
      'POST /api/context/initialize': 'Initialize with custom prompt/tools',
      'GET /api/export': 'List export formats',
      'GET /api/export/:format': 'Export context (json/text/html)',
      'GET /api/tools': 'List available tools',
    },
  });
});

// API Routes
app.use('/api/chat', chatRouter);
app.use('/api/context', contextRouter);
app.use('/api/export', exportRouter);

// Tools endpoint
app.get('/api/tools', (req, res) => {
  res.json({
    tools: claudeClient.getTools(),
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// Start server
app.listen(PORT, () => {
  const apiMode = claudeClient.getApiMode();
  const configStatus = claudeClient.getConfigurationStatus();
  const statusIcon = claudeClient.isConfigured() ? '✓' : '✗';
  const statusText = claudeClient.isConfigured() ? 'Configured' : 'NOT CONFIGURED';

  console.log(`
╔════════════════════════════════════════════════════════════╗
║           Claude Context Viewer - Server                   ║
╠════════════════════════════════════════════════════════════╣
║  Status: Running                                           ║
║  Port: ${String(PORT).padEnd(51)}║
║  API: ${(statusText + ' ' + statusIcon).padEnd(52)}║
║  Mode: ${configStatus.padEnd(51)}║
╚════════════════════════════════════════════════════════════╝

Endpoints:
  - Health:  http://localhost:${PORT}/health
  - API:     http://localhost:${PORT}/api
  - Chat:    POST http://localhost:${PORT}/api/chat
  - Context: http://localhost:${PORT}/api/context
  - Export:  http://localhost:${PORT}/api/export
`);

  // Initialize Claude client with default configuration
  if (claudeClient.isConfigured()) {
    claudeClient.initialize();
    if (apiMode === 'proxy') {
      console.log(`✓ Claude client initialized via cliproxyapi at ${claudeClient.getProxyUrl()}\n`);
    } else {
      console.log('✓ Claude client initialized with direct API key\n');
    }
  } else {
    console.warn(`⚠ Warning: No API configuration found.
  Option 1: Set ANTHROPIC_API_KEY in .env file
  Option 2: Install cliproxyapi at ~/code/utilities/cliproxyapi
`);
  }
});

export default app;
