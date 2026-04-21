/**
 * Issue reporting API — Express Router.
 * Issues are stored as JSON files in the `feedback/` directory.
 *
 * Endpoints:
 *   POST /api/issues        — create a new issue (authenticated users)
 *   GET  /api/issues         — list all issues without screenshots (authenticated)
 *   GET  /api/issues/export  — download full export with screenshots (admin-only)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { Request, Response } from 'express';
import { Router } from 'express';

import type {} from './authMiddleware.js'; // triggers Request.auth augmentation

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

// F-15: Body parsing handled by express.json() mounted in index.ts
export const issueApiRouter = Router();

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
  // F-19: consistent wrapper object pattern
  res.setHeader('Content-Disposition', `attachment; filename="emd-issues-${dateStr}.json"`);
  res.json({ issues });
});

issueApiRouter.get('/', (_req: Request, res: Response): void => {
  // F-19: consistent wrapper object pattern; F-28: include total for lightweight counting
  const issues = loadAllIssues(false);
  res.json({ issues, total: issues.length });
});

