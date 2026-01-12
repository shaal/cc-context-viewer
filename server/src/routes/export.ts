/**
 * Export route handlers
 *
 * Provides context export in multiple formats: JSON, text, and HTML.
 */

import { Router, type Request, type Response } from 'express';
import { contextStore } from '../services/context-store.js';
import type { ExportFormat } from '../types/index.js';

const router = Router();

/**
 * GET /api/export/:format
 * Export context in the specified format
 */
router.get('/:format', (req: Request, res: Response) => {
  const format = req.params.format as ExportFormat;
  const context = contextStore.getContext();
  const filename = `claude-context-${context.id.slice(0, 8)}`;

  switch (format) {
    case 'json':
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}.json"`
      );
      res.send(contextStore.toJSON());
      break;

    case 'text':
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}.txt"`
      );
      res.send(contextStore.toText());
      break;

    case 'html':
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}.html"`
      );
      res.send(contextStore.toHTML());
      break;

    default:
      res.status(400).json({
        error: 'Invalid format',
        validFormats: ['json', 'text', 'html'],
      });
  }
});

/**
 * GET /api/export
 * Returns available export formats
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    formats: [
      {
        name: 'json',
        description: 'Full structured data with metadata',
        contentType: 'application/json',
      },
      {
        name: 'text',
        description: 'Human-readable plain text format',
        contentType: 'text/plain',
      },
      {
        name: 'html',
        description: 'Self-contained HTML with styling',
        contentType: 'text/html',
      },
    ],
  });
});

export default router;
