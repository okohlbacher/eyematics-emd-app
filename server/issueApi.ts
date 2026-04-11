/**
 * Issue reporting API — Express Router + Vite dev plugin.
 * Issues are stored as JSON files in the `feedback/` directory.
 *
 * Endpoints:
 *   POST /api/issues        — create a new issue (authenticated users)
 *   GET  /api/issues         — list all issues without screenshots (authenticated)
 *   GET  /api/issues/export  — download full export with screenshots (admin-only)
 *
 * H-01: Shared core logic between production Router and Vite plugin.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readBody, validateAuth, sendError } from './utils';
import './authMiddleware.js';

const FEEDBACK_DIR = path.resolve(process.cwd(), 'feedback');

// ---------------------------------------------------------------------------
// Shared core logic (used by both Router and Plugin)
// ---------------------------------------------------------------------------

function ensureDir() {
  if (!fs.existsSync(FEEDBACK_DIR)) {
    fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
  }
}

function loadAllIssues(includeScreenshots: boolean): Record<string, unknown>[] {
  ensureDir();
  const files = fs.readdirSync(FEEDBACK_DIR)
    .filter(f => f.startsWith('issue-') && f.endsWith('.json'))
    .sort();

  const results: Record<string, unknown>[] = [];
  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(FEEDBACK_DIR, f), 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      const issue = parsed as Record<string, unknown>;
      if (typeof issue.id !== 'string' || typeof issue.page !== 'string') continue;
      if (!includeScreenshots) {
        const { screenshot, ...rest } = issue;
        results.push({ ...rest, hasScreenshot: !!screenshot });
      } else {
        results.push(issue);
      }
    } catch {
      // skip unreadable files
    }
  }
  return results;
}

function validateIssueBody(data: unknown): string | null {
  if (data === null || typeof data !== 'object') return 'Issue body must be a JSON object';
  const obj = data as Record<string, unknown>;
  if (typeof obj.page !== 'string' || obj.page.length === 0) return 'Issue must include a non-empty "page" string';
  if (typeof obj.description !== 'string' || obj.description.length === 0) return 'Issue must include a non-empty "description" string';
  return null;
}

function createIssue(issue: Record<string, unknown>): { id: string; filename: string } {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const entry = { id, timestamp, ...issue };
  ensureDir();
  const filename = `issue-${timestamp.replace(/[:.]/g, '-')}_${id.slice(0, 8)}.json`;
  fs.writeFileSync(path.join(FEEDBACK_DIR, filename), JSON.stringify(entry, null, 2), 'utf-8');
  return { id, filename };
}

// ---------------------------------------------------------------------------
// Express Router (production)
// ---------------------------------------------------------------------------

export const issueApiRouter = Router();

issueApiRouter.use(Router().use('/', (req, _res, next) => {
  // express.json() for this router
  if (req.headers['content-type']?.includes('application/json')) {
    import('express').then(({ json }) => json({ limit: '10mb' })(req, _res, next));
  } else {
    next();
  }
}));

issueApiRouter.post('/', (req: Request, res: Response): void => {
  const validationError = validateIssueBody(req.body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }
  try {
    const result = createIssue(req.body as Record<string, unknown>);
    res.status(201).json(result);
  } catch (err) {
    console.error('[issueApi] Failed to save issue:', err);
    res.status(500).json({ error: 'Failed to save issue' });
  }
});

issueApiRouter.get('/export', (req: Request, res: Response): void => {
  if (req.auth?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: admin role required' });
    return;
  }
  const issues = loadAllIssues(true);
  const dateStr = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="emd-issues-${dateStr}.json"`);
  res.json(issues);
});

issueApiRouter.get('/', (_req: Request, res: Response): void => {
  res.json(loadAllIssues(false));
});

// ---------------------------------------------------------------------------
// Vite dev plugin (reuses shared logic)
// ---------------------------------------------------------------------------

export function issueApiPlugin(): Plugin {
  return {
    name: 'issue-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/issues')) return next();

        const user = validateAuth(req, req.method === 'GET' && req.url === '/api/issues/export' ? 'admin' : undefined);
        if (!user) {
          sendError(res, req.url === '/api/issues/export' ? 403 : 401,
            req.url === '/api/issues/export' ? 'Forbidden: admin role required' : 'Authentication required');
          return;
        }

        if (req.method === 'POST' && req.url === '/api/issues') {
          readBody(req)
            .then((body) => {
              const issue = JSON.parse(body);
              const error = validateIssueBody(issue);
              if (error) { sendError(res, 400, error); return; }
              const result = createIssue(issue);
              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            })
            .catch((err) => {
              sendError(res, err instanceof Error && err.message.includes('too large') ? 413 : 500,
                err instanceof Error && err.message.includes('too large') ? 'Request body too large' : 'Failed to read request body', err);
            });
          return;
        }

        if (req.method === 'GET' && req.url === '/api/issues/export') {
          const issues = loadAllIssues(true);
          const dateStr = new Date().toISOString().slice(0, 10);
          res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="emd-issues-${dateStr}.json"` });
          res.end(JSON.stringify(issues, null, 2));
          return;
        }

        if (req.method === 'GET' && req.url === '/api/issues') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(loadAllIssues(false)));
          return;
        }

        next();
      });
    },
  };
}
