/**
 * Audit middleware — auto-logs every /api/* request to the SQLite audit database.
 *
 * Design decisions from 02-CONTEXT.md and 02-REVIEWS.md:
 *
 * - D-10: Log every API request automatically (method, path, user, status, duration)
 * - D-11: Mutations log (redacted) body; GETs log query params only
 * - Review concern #2 (HIGH): Redact sensitive fields (password, otp, challengeToken)
 *   before storing the body for /api/auth/* endpoints
 * - Review concern #4 (HIGH): Requires express.json() mounted BEFORE this middleware
 *   so that req.body is populated. Plan 03 (wiring) adds express.json() globally.
 * - Review concern #5 (MEDIUM): Mount BEFORE auth middleware so 401 responses are
 *   captured. req.auth is read at finish time — populated if auth succeeded, undefined
 *   for 401s. Both cases resolve correctly at event time.
 * - Review concern #6: Use req.originalUrl (not req.path or req.url) for path accuracy.
 */

import type { Request, Response, NextFunction } from 'express';
import { logAuditEntry } from './auditDb.js';

// ---------------------------------------------------------------------------
// Type augmentation — matches AuthPayload from server/authMiddleware.ts
// (authMiddleware attaches this to req.auth after JWT validation)
// ---------------------------------------------------------------------------

declare module 'express-serve-static-core' {
  interface Request {
    auth?: {
      sub: string;
      preferred_username: string;
      role: string;
      centers: string[];
      purpose?: string;
      iat: number;
      exp: number;
    };
  }
}

// ---------------------------------------------------------------------------
// Body redaction for sensitive auth endpoints
// ---------------------------------------------------------------------------

/**
 * Paths whose request bodies must have sensitive fields redacted before storage.
 * Per T-02-07: prevent information disclosure via audit log.
 */
const REDACT_PATHS = new Set(['/api/auth/login', '/api/auth/verify']);

/**
 * Field names that must never appear in plaintext in the audit database.
 */
const REDACT_FIELDS = new Set(['password', 'otp', 'challengeToken']);

/**
 * Return the request body as a JSON string with sensitive fields replaced
 * by '[REDACTED]'. Returns null if the body is absent.
 *
 * For paths not in REDACT_PATHS the body is serialised as-is.
 * For paths in REDACT_PATHS every field in REDACT_FIELDS is replaced.
 */
function redactBody(urlPath: string, body: unknown): string | null {
  if (body === undefined || body === null) return null;
  if (typeof body !== 'object') return String(body);

  if (!REDACT_PATHS.has(urlPath)) {
    return JSON.stringify(body);
  }

  const sanitized = { ...(body as Record<string, unknown>) };
  for (const field of REDACT_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  return JSON.stringify(sanitized);
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware that logs every /api/* request to the audit database.
 *
 * Mount order (handled by Plan 03 — server/index.ts):
 *   1. express.json()      — populates req.body (required for body capture)
 *   2. auditMiddleware     — registers res.on('finish') handler (this function)
 *   3. authMiddleware      — validates JWT, populates req.auth
 *   4. route handlers
 *
 * By mounting before authMiddleware, the 'finish' event fires after auth
 * completes (or fails), so req.auth captures the resolved auth state at
 * response time — undefined for 401s, populated for authenticated requests.
 */
export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Only audit /api/* requests — skip static file serving
  if (!req.originalUrl.startsWith('/api/')) {
    next();
    return;
  }

  const startMs = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startMs;
    // Strip query string to get the clean path
    const urlPath = req.originalUrl.split('?')[0];
    // req.auth is populated by authMiddleware for authenticated requests;
    // undefined for requests that were rejected (401) — fall back to 'anonymous'
    const user = req.auth?.preferred_username ?? 'anonymous';

    // Per D-11: mutations log (redacted) body; GETs log query params only
    const bodyStr =
      req.method !== 'GET' ? redactBody(urlPath, req.body) : null;
    const queryStr =
      req.method === 'GET' && Object.keys(req.query).length > 0
        ? JSON.stringify(req.query)
        : null;

    logAuditEntry({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      method: req.method,
      path: urlPath,
      user,
      status: res.statusCode,
      duration_ms: duration,
      body: bodyStr,
      query: queryStr,
    });
  });

  next();
}
