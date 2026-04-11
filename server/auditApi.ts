/**
 * Audit API router — read-only HTTP endpoints for the SQLite audit log.
 *
 * Per D-13 and AUDIT-05: NO write endpoints exist for audit data.
 * All audit writes are internal server function calls (logAuditEntry via middleware).
 *
 * Endpoints:
 *   GET /api/audit        — filtered list with pagination (authenticated users)
 *   GET /api/audit/export — full dump as downloadable JSON (admin only, T-02-08)
 */

import type { Request, Response } from 'express';
import { Router } from 'express';

import type { AuditFilters } from './auditDb.js';
import { queryAudit, queryAuditExport } from './auditDb.js';

export const auditApiRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/audit — filtered list with pagination
// ---------------------------------------------------------------------------

/**
 * Query params (all optional):
 *   user      — exact username match
 *   method    — exact HTTP method match (e.g. GET, POST)
 *   path      — substring match on URL path
 *   fromTime  — ISO 8601 lower bound on timestamp
 *   toTime    — ISO 8601 upper bound on timestamp
 *   limit     — max rows to return (default 50, max 500)
 *   offset    — skip N rows for pagination (default 0)
 *
 * Response: { entries: AuditDbRow[], total: number, limit: number, offset: number }
 * where total is the full row count matching the filters (without LIMIT/OFFSET),
 * enabling correct pagination in the UI.
 */
auditApiRouter.get('/', (req: Request, res: Response): void => {
  const filters: AuditFilters = {};

  // H-03: Auto-scope — non-admins see only their own audit entries
  if (req.auth?.role !== 'admin') {
    filters.user = req.auth!.preferred_username;
  } else if (typeof req.query.user === 'string') {
    filters.user = req.query.user;
  }
  if (typeof req.query.method === 'string') filters.method = req.query.method;
  if (typeof req.query.path === 'string') filters.path = req.query.path;
  if (typeof req.query.fromTime === 'string') filters.fromTime = req.query.fromTime;
  if (typeof req.query.toTime === 'string') filters.toTime = req.query.toTime;

  const rawLimit = Number(req.query.limit);
  if (!Number.isNaN(rawLimit) && rawLimit > 0) filters.limit = rawLimit;

  const rawOffset = Number(req.query.offset);
  if (!Number.isNaN(rawOffset) && rawOffset >= 0) filters.offset = rawOffset;

  const limit = Math.min(filters.limit ?? 50, 500);
  const offset = filters.offset ?? 0;

  const { rows, total } = queryAudit({ ...filters, limit, offset });

  res.json({ entries: rows, total, limit, offset });
});

// ---------------------------------------------------------------------------
// GET /api/audit/export — admin-only full dump
// ---------------------------------------------------------------------------

/**
 * Returns all audit entries as a downloadable JSON file.
 *
 * Per T-02-08: admin role required — non-admin receives 403.
 * Sets Content-Disposition header to trigger browser download.
 */
auditApiRouter.get('/export', (req: Request, res: Response): void => {
  // Admin-only access check (req.auth populated by authMiddleware)
  if (req.auth?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: admin role required' });
    return;
  }

  const entries = queryAuditExport();

  res.setHeader('Content-Disposition', 'attachment; filename="audit-export.json"');
  res.setHeader('Content-Type', 'application/json');
  res.json(entries);
});

// ---------------------------------------------------------------------------
// No POST / PUT / PATCH / DELETE routes are defined.
// Per D-13 and AUDIT-05: the audit log is append-only from the server's
// perspective. Express will return 404 for any write attempt.
// ---------------------------------------------------------------------------
