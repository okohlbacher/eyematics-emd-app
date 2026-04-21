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
// H6 / F-06: ISO 8601 validation for time-range filters. Accepts the
// broad ISO-8601 shapes the audit page emits (`2026-04-21`,
// `2026-04-21T10:15:30Z`, with optional fractional seconds and TZ).
// Anything else is rejected at the boundary so SQLite never does a
// surprise text comparison on junk input.
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
// H6 / F-06: body_search hardening — bound length and reject LIKE wildcards
// rather than escape them, so admins cannot accidentally trigger full-table
// scans with `%...%` patterns.
const BODY_SEARCH_MAX_LEN = 128;

auditApiRouter.get('/', (req: Request, res: Response): void => {
  const filters: AuditFilters = {};

  // Parse base filters (user from query only applies when admin — overwritten below for non-admins)
  if (typeof req.query.user === 'string') filters.user = req.query.user;
  if (typeof req.query.method === 'string') filters.method = req.query.method;
  if (typeof req.query.path === 'string') filters.path = req.query.path;

  if (typeof req.query.fromTime === 'string') {
    if (!ISO_8601_REGEX.test(req.query.fromTime)) {
      res.status(400).json({ error: 'fromTime must be an ISO 8601 timestamp' });
      return;
    }
    filters.fromTime = req.query.fromTime;
  }
  if (typeof req.query.toTime === 'string') {
    if (!ISO_8601_REGEX.test(req.query.toTime)) {
      res.status(400).json({ error: 'toTime must be an ISO 8601 timestamp' });
      return;
    }
    filters.toTime = req.query.toTime;
  }

  // Phase 17: new filter params with enum + NaN validation (T-17-01, T-17-02, T-17-04)
  const VALID_CATEGORIES = ['auth', 'data', 'admin', 'outcomes'] as const;
  type ActionCategory = typeof VALID_CATEGORIES[number];

  const rawCategory = req.query.action_category;
  if (typeof rawCategory === 'string' && (VALID_CATEGORIES as readonly string[]).includes(rawCategory)) {
    filters.action_category = rawCategory as ActionCategory;
  }

  const rawBodySearch = req.query.body_search;
  if (typeof rawBodySearch === 'string' && rawBodySearch.length > 0) {
    // H6: gate body_search to admins only — non-admin rows are auto-scoped to
    // their own user anyway, so their own context is already visible in the UI.
    if (req.auth?.role !== 'admin') {
      res.status(403).json({ error: 'body_search is restricted to administrators' });
      return;
    }
    if (rawBodySearch.length > BODY_SEARCH_MAX_LEN) {
      res.status(400).json({ error: `body_search must be ≤ ${BODY_SEARCH_MAX_LEN} characters` });
      return;
    }
    if (/[%_]/.test(rawBodySearch)) {
      res.status(400).json({ error: 'body_search cannot contain % or _ wildcards' });
      return;
    }
    filters.body_search = rawBodySearch;
  }

  const rawStatusGte = req.query.status_gte;
  if (typeof rawStatusGte === 'string' && rawStatusGte.length > 0) {
    const parsed = Number(rawStatusGte);
    // H6: HTTP status codes are 100–599; anything outside is a client error.
    if (!Number.isNaN(parsed) && Number.isFinite(parsed) && parsed >= 100 && parsed <= 599) {
      filters.status_gte = parsed;
    }
  }

  // H-03: Auto-scope — non-admins see only their own audit entries.
  // Applied AFTER new param parsing so it overwrites any user-provided user value last.
  if (req.auth?.role !== 'admin') {
    filters.user = req.auth!.preferred_username;
  }

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
 *
 * Timing convention (IN-10): `duration_ms: 0` is a SENTINEL indicating a
 * handler-written row with no middleware timing available (D-03 fire-and-forget).
 * Middleware-written rows carry a true duration via `Date.now() - startMs`.
 * Dashboarding that filters on `duration_ms > 0` will exclude these rows by design.
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
  // IN-04: trim() guards against whitespace-only strings producing spurious hash rows.
  const cohortHash = typeof body.cohortId === 'string' && body.cohortId.trim().length > 0
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
