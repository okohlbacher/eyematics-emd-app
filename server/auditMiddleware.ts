/**
 * Audit middleware — auto-logs every /api/* request to the SQLite audit database.
 *
 * Design decisions from 02-CONTEXT.md and 02-REVIEWS.md:
 *
 * - D-10: Log every API request automatically (method, path, user, status, duration)
 * - D-11: Mutations log (redacted) body; GETs log query params only
 * - Review concern #2 (HIGH): Redact sensitive fields (password, otp, challengeToken)
 *   before storing the body for /api/auth/* endpoints
 * - Review concern #4 (HIGH): Requires express.json() (or readBody() via _capturedBody)
 *   to populate req.body. index.ts mounts express.json() scoped to specific routes
 *   (NOT global) because issueApi and settingsApi consume the raw stream via readBody().
 * - Review concern #5 (MEDIUM): Mount BEFORE auth middleware so 401 responses are
 *   captured. req.auth is read at finish time — populated if auth succeeded, undefined
 *   for 401s. Both cases resolve correctly at event time.
 * - Review concern #6: Use req.originalUrl (not req.path or req.url) for path accuracy.
 */

import crypto from 'node:crypto';

import type { NextFunction,Request, Response } from 'express';

import { logAuditEntry } from './auditDb.js';
import { verifyAccessTokenIgnoringExpiry } from './jwtUtil.js';

// Type augmentation in server/types.d.ts (F-17: single source of truth)

// ---------------------------------------------------------------------------
// Body redaction for sensitive auth endpoints
// ---------------------------------------------------------------------------

/**
 * Paths whose request bodies must have sensitive fields redacted before storage.
 * Per T-02-07: prevent information disclosure via audit log.
 */
const REDACT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/verify',
  '/api/auth/users',           // POST /api/auth/users — response contains generatedPassword
  '/api/auth/totp/confirm',    // SEC-15: body contains OTP
  '/api/auth/totp/disable',    // SEC-15: body contains OTP / recovery code
  '/api/settings',             // H4 / F-11: YAML body carries cohortHashSecret, otpCode
  '/api/auth/refresh',         // Phase 20 / D-22: body is CSRF-only / empty by design
  '/api/auth/logout',          // Phase 20 / D-22: defense in depth
]);

/**
 * Regex-redaction for YAML/text bodies on REDACT_PATHS. Replaces the value
 * of any line whose key matches a sensitive name with "[REDACTED]".
 *
 * Covers the PUT /api/settings case where the body is raw YAML text, not
 * a JSON object — the field-level sanitizer cannot walk it.
 */
const SENSITIVE_YAML_KEY = /^(\s*(?:otpCode|cohortHashSecret|password|jwtSecret|clientSecret)\s*:\s*).*$/gim;
function redactYamlString(yaml: string): string {
  return yaml.replace(SENSITIVE_YAML_KEY, '$1[REDACTED]');
}

/**
 * Paths whose audit row is written DIRECTLY by the route handler (not by this middleware).
 * The middleware must NOT write a duplicate row AND must NOT capture the raw request body
 * for these paths — D-10 / T-11-01 / Phase 11 CRREV-01.
 *
 * Handler-written rows bypass this middleware's redaction pipeline because they carry
 * per-route privileged data (e.g. hashed identifiers) that only the handler knows how to
 * derive. The handler is responsible for its own PII minimization.
 */
const SKIP_AUDIT_PATHS = new Set([
  '/api/audit/events/view-open',  // Phase 11: handler writes row with hashed cohortId
  '/api/outcomes/aggregate',      // Phase 12 / D-17 / T-12-04: handler writes row with hashed cohortId + payloadBytes
]);

/**
 * Phase 20 / D-19: Status-conditional audit skip.
 *
 * Maps urlPath → set of statusCodes for which the audit row should be SKIPPED.
 * Use ONLY for high-volume background events whose successful path would
 * dominate the audit log. Failed paths still produce rows for security visibility.
 *
 * Differs from SKIP_AUDIT_PATHS (unconditional skip — used by handlers that
 * write their own audit row, e.g. Phase 11 view-open beacon).
 *
 * Threat model anchor: T-20-19 (DoS via audit log flooded by ~80 refreshes/user/12h)
 * and T-20-21 (Repudiation: failed refresh attack invisible in audit log) — failures
 * (401/403) are NOT skipped, satisfying the "audit success silently, surface failures
 * loudly" stance from CONTEXT D-19 / RESEARCH Pitfall 5.
 */
// Exported for v1.9 Phase 21 UAT-AUTO-03 unit assertion (audit-silence contract regression guard per D-09 minimal-scoped source fix).
export const SKIP_AUDIT_IF_STATUS: Record<string, Set<number>> = {
  '/api/auth/refresh': new Set([200]),
};

/**
 * AUDIT-02: paths where the actor should be taken from the attempted username
 * (request body) when no authenticated identity is present. A login/verify
 * request carries no token yet, so `req.auth` is empty — but the audit row is
 * far more useful showing WHO logged in / WHO was targeted on a failed attempt.
 */
// Only /login carries the username in its body. /verify (2FA step 2) sends
// {challengeToken, otp} — the username is encoded in the token, not the body —
// so it stays 'unauthenticated'; the preceding /login row already records who.
const LOGIN_ACTOR_PATHS = new Set(['/api/auth/login']);

/**
 * Field names that must never appear in plaintext in the audit database.
 */
const REDACT_FIELDS = new Set(['password', 'otp', 'challengeToken', 'generatedPassword']);

/**
 * Return the request body as a JSON string with sensitive fields replaced
 * by '[REDACTED]'. Returns null if the body is absent.
 *
 * For paths not in REDACT_PATHS the body is serialised as-is.
 * For paths in REDACT_PATHS every field in REDACT_FIELDS is replaced.
 */
function redactBody(urlPath: string, body: unknown): string | null {
  if (body === undefined || body === null) return null;
  const isRedactPath = REDACT_PATHS.has(urlPath);

  if (typeof body !== 'object') {
    const s = String(body);
    return isRedactPath ? redactYamlString(s) : s;
  }

  if (!isRedactPath) {
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
// Body helpers
// ---------------------------------------------------------------------------

/**
 * Try to parse a string as JSON; return the original string if parsing fails.
 *
 * Rule: JSON bodies (POST /api/issues) get parsed into objects so redactBody
 * can traverse REDACT_PATHS. Non-JSON bodies (PUT /api/settings sends YAML)
 * stay as raw strings -- redactBody handles strings via String(body).
 */
function tryParseJson(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

/**
 * AUDIT-02 / WR-06: sanitize an untrusted attempted-username before it becomes
 * the audit actor. Strips control / non-printable characters (C0 + C1 controls,
 * DEL, line/paragraph separators) to prevent log-injection (forged newlines) and
 * display corruption, then trims surrounding whitespace and caps length at 64.
 *
 * Returns '' when nothing printable remains, so callers can fall back to
 * 'unauthenticated'. The "attacker can supply another user's name on a failed
 * attempt" behaviour is BY DESIGN (it is the *attempted* username) — only the
 * characters are sanitized, not the value semantics.
 */
function sanitizeActor(raw: string): string {
  return raw
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, '')
    .trim()
    .slice(0, 64);
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
    // Strip query string to get the clean path
    const urlPath = req.originalUrl.split('?')[0];

    // Phase 11 / D-10 / T-11-01: skip paths whose handlers write their own audit row.
    // This check MUST precede body capture so the raw body is never read/serialised here.
    if (SKIP_AUDIT_PATHS.has(urlPath)) return;

    // Phase 20 / D-19: status-conditional skip — successful refresh is silenced
    // (high-volume background event); failures still recorded for security visibility.
    if (SKIP_AUDIT_IF_STATUS[urlPath]?.has(res.statusCode)) return;

    const duration = Date.now() - startMs;
    // Actor resolution:
    //   1. Authenticated requests → preferred_username (from authMiddleware).
    //   2. Login/verify rows carry no token yet (req.auth empty), but the attempted
    //      username is in the body — attribute the row to it so the audit log shows
    //      WHO logged in / WHO was targeted on a failed attempt (AUDIT-02 / brute-force
    //      visibility). Safe: audit is admin-only and the body already holds the value;
    //      the public 401 stays generic (no enumeration). Length-bounded to curb log abuse.
    //   3. Otherwise (true unauthenticated request) → 'unauthenticated'.
    let user = req.auth?.preferred_username;
    if (!user && LOGIN_ACTOR_PATHS.has(urlPath)) {
      const attempted = (req.body as { username?: unknown } | undefined)?.username;
      if (typeof attempted === 'string') {
        // WR-06: the actor here is the ATTEMPTED (untrusted) username from the
        // request body, recorded so the audit log shows WHO was targeted on a
        // failed login (brute-force visibility). Strip non-printable/control
        // characters (C0/C1 controls, DEL, line/paragraph separators) BEFORE
        // trimming + length-capping, so newlines/control bytes cannot inject
        // forged lines or corrupt the audit display. Length bound curbs abuse.
        const sanitized = sanitizeActor(attempted);
        if (sanitized) user = sanitized;
      }
    }

    // A5: Expired signed-claim attribution — attribute 401 audit rows to the
    // token username when:
    //   - The response is 401 (session rejected)
    //   - req.auth is absent (auth middleware did not authenticate the request)
    //   - An Authorization: Bearer <token> header is present
    //   - The token has a valid HS256 signature against the CURRENT key (current-key
    //     only; access tokens never had dual-key per initAuth D-12 policy)
    //   - The token's typ is 'access' (refresh/challenge tokens are rejected)
    //   - The token expired within the last 24 h (limits audit spoofing with
    //     old stolen tokens — Vibe A5 v2 constraint)
    //
    // This is NOT authenticated identity. The 401 status already conveys failure.
    // Forged tokens (bad signature) and too-old tokens stay 'unauthenticated'.
    // NO row suppression — audit completeness is preserved.
    if (!user && res.statusCode === 401) {
      const MAX_EXPIRED_AGE_S = 24 * 60 * 60; // 24 hours in seconds
      const authHeader = req.headers['authorization'];
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const payload = verifyAccessTokenIgnoringExpiry(token);
        if (payload !== null) {
          const nowS = Math.floor(Date.now() / 1000);
          const expiredAgeS = nowS - payload.exp;
          if (expiredAgeS <= MAX_EXPIRED_AGE_S) {
            const sanitized = sanitizeActor(payload.preferred_username);
            if (sanitized) user = sanitized;
          }
        }
      }
    }

    user = user ?? 'unauthenticated';

    // Per D-11: mutations log (redacted) body; GETs log query params only
    // Body capture priority (Bug 1 fix):
    //   1. req.body (from express.json()) — populated for /api/auth/* routes
    //   2. req._capturedBody (from readBody()) — populated for all other mutation routes
    // _capturedBody is always a raw string. tryParseJson attempts JSON parse so
    // redactBody can walk REDACT_PATHS for object bodies; YAML bodies stay as
    // raw strings and redactBody handles them via its String(body) fallback.
    const rawBody = req.method !== 'GET'
      ? (req.body !== undefined && req.body !== null
          ? req.body
          : (req._capturedBody ? tryParseJson(req._capturedBody) : undefined))
      : undefined;
    const bodyStr = req.method !== 'GET' ? redactBody(urlPath, rawBody) : null;
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
