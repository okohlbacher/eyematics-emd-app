/**
 * Session router: POST /rotate-key, DELETE/GET /sessions
 *
 * IMPORTANT: Route registration order is load-bearing.
 *   - DELETE /sessions/:id BEFORE DELETE /sessions (query-param variant) — invariant #2
 */

import type { Request, Response } from 'express';
import { Router } from 'express';

import { rotateSigningKey } from '../initAuth.js';
import { getSession, listActiveSessionsByUser, revokeByUsername, revokeSession } from '../sessionsDb.js';

export const sessionRouter = Router();

/**
 * POST /api/auth/rotate-key
 *
 * Admin-only JWT signing-key rotation (SESS-04). Operator must stage the next
 * key at data/jwt-secret-next.txt before calling this endpoint. On success,
 * next becomes current and current becomes prev (dual-key window opens).
 *
 * NOT in PUBLIC_PATHS — requires a valid admin Bearer token.
 * Returns { rotatedAt, prevKeyExpiresBy } so the operator knows when the
 * window closes and existing tokens signed by the prev key expire.
 */
sessionRouter.post('/rotate-key', (req: Request, res: Response): void => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  try {
    const result = rotateSigningKey();
    res.status(200).json(result);
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === 'NEXT_KEY_MISSING') {
      res.status(400).json({ error: 'jwt-secret-next.txt not found; stage the next key first' });
      return;
    }
    console.error('[authApi] rotate-key failed', err);
    res.status(500).json({ error: 'Key rotation failed' });
  }
});

/**
 * DELETE /api/auth/sessions/:id
 *
 * Admin-only. Revokes a single refresh-session by its jti (id).
 * Returns { revoked: true } on success; 404 if the session id is not found.
 *
 * MUST be registered before DELETE /sessions (query-param variant) so that
 * Express matches :id before treating the path as a missing-username request.
 *
 * No requireCsrf: auth is via Authorization: Bearer header (attached by authFetch),
 * which a cross-site attacker cannot set — CSRF does not apply to Bearer-only endpoints.
 * Do NOT move the access token to a cookie without revisiting this.
 * (SESSUI-02, D-11, T-28-01, T-28-03)
 */
sessionRouter.delete('/sessions/:id', (req: Request, res: Response): void => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  const id = String(req.params.id ?? '');
  const row = getSession(id);
  // Treat already-revoked/expired sessions as not-found — prevents misleading { revoked: true }
  if (!row || row.revoked === 1) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  revokeSession(id);
  res.json({ revoked: true });
});

/**
 * DELETE /api/auth/sessions?username=<u>
 *
 * Admin-only. Revokes all active refresh-sessions for the given username (SESS-01).
 * Returns { revoked: <count> } — the number of rows revoked.
 * (SESS-01, D-12, T-28-01, T-28-03)
 */
sessionRouter.delete('/sessions', (req: Request, res: Response): void => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  const username = String(req.query.username ?? '').trim();
  if (!username) {
    res.status(400).json({ error: 'username required' });
    return;
  }
  const count = revokeByUsername(username);
  res.json({ revoked: count });
});

/**
 * GET /api/auth/sessions?username=<u>
 *
 * Admin-only. Returns active (non-revoked, non-expired) refresh-sessions
 * for the given username. Used by the admin session management UI.
 * (SESSUI-01, D-10, T-28-01, T-28-02)
 */
sessionRouter.get('/sessions', (req: Request, res: Response): void => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  const username = String(req.query.username ?? '').trim();
  if (!username) {
    res.status(400).json({ error: 'username required' });
    return;
  }
  // Project to DTO — omit sid/ver/revoked/username (unnecessary attack surface in browser).
  const sessions = listActiveSessionsByUser(username).map(
    ({ id, issued_at, last_used_at, expires_at, key_id }) =>
      ({ id, issued_at, last_used_at, expires_at, key_id }),
  );
  res.json({ sessions });
});
