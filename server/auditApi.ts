/**
 * Audit API router — read-only HTTP endpoints for the SQLite audit log.
 *
 * Per D-13 and AUDIT-05: NO write endpoints exist for audit data.
 * All audit writes are internal server function calls (logAuditEntry via middleware).
 *
 * Endpoints:
 *   GET  /api/audit                      — filtered list with pagination (authenticated users)
 *   GET  /api/audit/export               — full dump as downloadable JSON (admin only, T-02-08)
 *   POST /api/audit/events/view-open     — view-open beacon (hashed cohort id, Phase 11)
 */

import crypto from 'node:crypto';

import type { Request, Response } from 'express';
import { Router } from 'express';

import type { AuditFilters } from './auditDb.js';
import { logAuditEntry, queryAudit, queryAuditExport } from './auditDb.js';
import { hashCohortId } from './hashCohortId.js';

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

  // F-30: limit/offset clamping handled in queryAudit() — no duplication here
  const { rows, total } = queryAudit(filters);

  res.json({ entries: rows, total, limit: filters.limit ?? 50, offset: filters.offset ?? 0 });
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

  // F-19: consistent wrapper object pattern
  res.setHeader('Content-Disposition', 'attachment; filename="audit-export.json"');
  res.setHeader('Content-Type', 'application/json');
  res.json({ entries });
});

// ---------------------------------------------------------------------------
// POST /api/audit/events/view-open — view-open beacon (Phase 11 / CRREV-01)
// ---------------------------------------------------------------------------
/**
 * Authenticated beacon used by analytical views to produce an auditable row
 * for "user opened view X". Phase 11 flipped this from GET to POST so the
 * cohort identifier never appears in the request URL / access logs / proxy
 * logs / Referer headers. The handler computes an HMAC-SHA256 hash of the
 * cohortId via hashCohortId() and writes the audit row directly, then
 * returns 204. The auditMiddleware SKIP_AUDIT_PATHS set ensures no duplicate
 * row is written (D-10 / T-11-01).
 *
 * Request body (JSON, <= 16 KiB):
 *   name      string — required, view identifier (e.g. 'open_outcomes_view')
 *   cohortId  string — optional, raw saved-search id; hashed before storage
 *   filter    object — optional, ad-hoc filter snapshot; stored as-is (D-08)
 *
 * Response: 204 No Content (D-03 fire-and-forget).
 *
 * No role gate: any authenticated user may emit their own view-open.
 *
 * Trust boundary (IN-02): `filter` is stored VERBATIM in the audit row body.
 * Callers MUST NOT embed PII or patient identifiers inside the filter object.
 * The server performs no redaction or field-allowlisting on this payload beyond
 * the 16 KiB JSON cap; a future phase may introduce a shallow allowlist once
 * the filter taxonomy stabilises.
 */
auditApiRouter.post('/events/view-open', (req: Request, res: Response): void => {
  const body = (req.body ?? {}) as { name?: unknown; cohortId?: unknown; filter?: unknown };
  const name = typeof body.name === 'string' ? body.name : 'unknown';
  // IN-01: defensive 128-char upper bound on cohortId — saved-search ids are short
  // UUID-like strings; a larger value is either a caller bug or abuse.
  if (typeof body.cohortId === 'string' && body.cohortId.length > 128) {
    res.status(400).json({ error: 'cohortId exceeds 128 characters' });
    return;
  }
  const cohortHash = typeof body.cohortId === 'string' && body.cohortId.length > 0
    ? hashCohortId(body.cohortId)
    : null;
  const filter = body.filter !== undefined ? body.filter : null;

  logAuditEntry({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    method: 'POST',
    path: '/api/audit/events/view-open',
    user: req.auth?.preferred_username ?? 'anonymous',
    status: 204,
    duration_ms: 0,
    body: JSON.stringify({ name, cohortHash, filter }),
    query: null,
  });

  res.status(204).end();
});

// NOTE: The legacy GET /events/view-open handler is removed in this phase.
// Express will return 404 for GETs to this path — matches CRREV-01 success
// criterion "no longer accepts or records cohort id in the querystring".

// ---------------------------------------------------------------------------
// No PUT / PATCH / DELETE routes are defined.
// Per D-13 and AUDIT-05: the audit log is append-only from the server's
// perspective. All writes go through logAuditEntry — either implicitly via
// auditMiddleware or explicitly via a handler-written row (see POST
// /events/view-open above). Express will return 404 for any other write.
// ---------------------------------------------------------------------------
