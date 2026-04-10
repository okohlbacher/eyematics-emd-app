/**
 * Vite server plugin that provides a REST API for issue reporting.
 * Issues are stored as JSON files in the `feedback/` directory.
 *
 * Endpoints:
 *   POST /api/issues        — create a new issue (authenticated users, JSON body)
 *   GET  /api/issues         — list all issues without screenshots (authenticated users)
 *   GET  /api/issues/export  — download full export with screenshots (admin-only)
 */

import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { readBody, validateAuth, sendError } from './utils';

const FEEDBACK_DIR = path.resolve(process.cwd(), 'feedback');

function ensureDir() {
  if (!fs.existsSync(FEEDBACK_DIR)) {
    fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
  }
}

function loadAllIssues(includeScreenshots: boolean) {
  ensureDir();
  const files = fs.readdirSync(FEEDBACK_DIR)
    .filter(f => f.startsWith('issue-') && f.endsWith('.json'))
    .sort();

  const results: Record<string, unknown>[] = [];
  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(FEEDBACK_DIR, f), 'utf-8');
      const parsed = JSON.parse(raw);
      // M-02: Validate JSON structure — must be a non-null object with id and page
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        console.warn(`[issueApi] Skipping malformed issue file: ${f}`);
        continue;
      }
      const issue = parsed as Record<string, unknown>;
      if (typeof issue.id !== 'string' || typeof issue.page !== 'string') {
        console.warn(`[issueApi] Skipping issue file missing required fields: ${f}`);
        continue;
      }
      if (!includeScreenshots) {
        const { screenshot, ...rest } = issue;
        results.push({ ...rest, hasScreenshot: !!screenshot });
      } else {
        results.push(issue);
      }
    } catch (err) {
      console.warn(`[issueApi] Skipping unreadable issue file: ${f}`, err);
    }
  }
  return results;
}

/**
 * Validate that an issue object has the required fields.
 * Returns an error message if invalid, or null if valid.
 */
function validateIssueBody(data: unknown): string | null {
  if (data === null || typeof data !== 'object') {
    return 'Issue body must be a JSON object';
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.page !== 'string' || obj.page.length === 0) {
    return 'Issue must include a non-empty "page" string';
  }
  if (typeof obj.description !== 'string' || obj.description.length === 0) {
    return 'Issue must include a non-empty "description" string';
  }
  return null;
}

export function issueApiHandler(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  // POST /api/issues — create new issue (authenticated)
  if (req.method === 'POST' && req.url === '/api/issues') {
    const user = validateAuth(req);
    if (!user) {
      sendError(res, 401, 'Authentication required');
      return;
    }

    readBody(req)
      .then((body) => {
        let issue: unknown;
        try {
          issue = JSON.parse(body);
        } catch (parseErr) {
          sendError(res, 400, 'Invalid JSON', parseErr);
          return;
        }

        const validationError = validateIssueBody(issue);
        if (validationError) {
          sendError(res, 400, validationError);
          return;
        }

        try {
          const id = crypto.randomUUID();
          const timestamp = new Date().toISOString();
          const entry = { id, timestamp, ...(issue as Record<string, unknown>) };

          ensureDir();
          const filename = `issue-${timestamp.replace(/[:.]/g, '-')}_${id.slice(0, 8)}.json`;
          fs.writeFileSync(
            path.join(FEEDBACK_DIR, filename),
            JSON.stringify(entry, null, 2),
            'utf-8',
          );

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ id, filename }));
        } catch (err) {
          sendError(res, 500, 'Failed to save issue', err);
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.message.includes('too large')) {
          sendError(res, 413, 'Request body too large');
        } else {
          sendError(res, 500, 'Failed to read request body', err);
        }
      });
    return;
  }

  // GET /api/issues/export — full export with screenshots (admin-only)
  if (req.method === 'GET' && req.url === '/api/issues/export') {
    const user = validateAuth(req, 'admin');
    if (!user) {
      sendError(res, 403, 'Forbidden: admin role required');
      return;
    }

    try {
      const issues = loadAllIssues(true);
      const dateStr = new Date().toISOString().slice(0, 10);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="emd-issues-${dateStr}.json"`,
      });
      res.end(JSON.stringify(issues, null, 2));
    } catch (err) {
      sendError(res, 500, 'Failed to export issues', err);
    }
    return;
  }

  // GET /api/issues — list issues without screenshot data (authenticated)
  if (req.method === 'GET' && req.url === '/api/issues') {
    const user = validateAuth(req);
    if (!user) {
      sendError(res, 401, 'Authentication required');
      return;
    }

    try {
      const issues = loadAllIssues(false);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(issues));
    } catch (err) {
      sendError(res, 500, 'Failed to load issues', err);
    }
    return;
  }

  next();
}

export function issueApiPlugin(): Plugin {
  return {
    name: 'issue-api',
    configureServer(server) {
      server.middlewares.use(issueApiHandler);
    },
  };
}
