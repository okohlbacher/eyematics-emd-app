/**
 * User admin router: GET/POST /users, GET /users/me, PUT/DELETE /users/:username, password routes
 *
 * IMPORTANT: Route registration order is load-bearing.
 *   - /users/me BEFORE /users/:username (parameterized match)
 *   - /users/me/password BEFORE /users/:username/password (invariant #1)
 */

import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { Router } from 'express';

import type { UserRecord } from '../initAuth.js';
import { loadUsers, modifyUsers } from '../initAuth.js';
import { getValidCenterIds } from '../constants.js';
import { revokeByUsername } from '../sessionsDb.js';
import { generateSecurePassword, VALID_ROLES } from './authHelpers.js';

export const userAdminRouter = Router();

/**
 * GET /api/auth/users/me
 *
 * Returns the authenticated user's profile (USER-01).
 * Available to any authenticated user (not admin-only).
 */
userAdminRouter.get('/users/me', (req: Request, res: Response): void => {
  if (!req.auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  // Case-insensitive lookup to get full user record (review suggestion: case-insensitive matching)
  const userRecord = loadUsers().find(
    (u) => u.username.toLowerCase() === req.auth!.preferred_username.toLowerCase()
  );
  res.json({
    user: {
      username: req.auth.preferred_username,
      role: req.auth.role,
      centers: req.auth.centers,
      firstName: userRecord?.firstName,
      lastName: userRecord?.lastName,
    },
  });
});

/**
 * GET /api/auth/users
 *
 * Returns user list (without password hashes). Admin only (T-04-05).
 */
userAdminRouter.get('/users', (req: Request, res: Response): void => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  // UMGMT-03: include active in projection so admin UI can show deactivation status
  const users = loadUsers().map(({ username, firstName, lastName, role, centers, createdAt, lastLogin, active }) => ({
    username, firstName, lastName, role, centers, createdAt, lastLogin, active,
  }));
  res.json({ users });
});

/**
 * POST /api/auth/users
 *
 * Create a new user with auto-generated password (USER-03, D-01, D-03).
 * Admin only. Password is server-generated — never sent in request body.
 * Centers validated against VALID_CENTERS allowlist (review concern #3).
 */
userAdminRouter.post('/users', async (req: Request, res: Response): Promise<void> => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const { username, role, centers, firstName, lastName } = req.body as Record<string, unknown>;

  // Validate required fields
  if (typeof username !== 'string' || !username.trim()) {
    res.status(400).json({ error: 'username is required' });
    return;
  }

  // Validate role against allowlist — reject explicitly invalid values (F-40)
  if (role !== undefined && (typeof role !== 'string' || !VALID_ROLES.has(role))) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${[...VALID_ROLES].join(', ')}` });
    return;
  }
  const userRole = typeof role === 'string' && VALID_ROLES.has(role) ? role : 'researcher';

  // Validate centers against allowlist (review concern #3)
  const rawCenters = Array.isArray(centers) ? centers.filter((c): c is string => typeof c === 'string') : [];
  const validCenterIds = getValidCenterIds();
  const invalidCenters = rawCenters.filter((c) => !validCenterIds.has(c));
  if (invalidCenters.length > 0) {
    res.status(400).json({ error: `Invalid center codes: ${invalidCenters.join(', ')}` });
    return;
  }

  // Generate secure random password (D-01): 16 chars base64url = ~96 bits entropy
  const generatedPassword = generateSecurePassword();
  const passwordHash = await bcrypt.hash(generatedPassword, 12);

  const newUser: UserRecord = {
    username: username.trim(),
    passwordHash,
    role: userRole,
    centers: rawCenters,
    firstName: typeof firstName === 'string' && firstName.trim() ? firstName.trim() : undefined,
    lastName: typeof lastName === 'string' && lastName.trim() ? lastName.trim() : undefined,
    createdAt: new Date().toISOString(),
  };

  // F-11: atomic read-modify-write under lock prevents TOCTOU race
  try {
    await modifyUsers((users) => {
      if (users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase())) {
        throw new Error('USERNAME_EXISTS');
      }
      return [...users, newUser];
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'USERNAME_EXISTS') {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }
    throw err;
  }

  // Return user WITHOUT passwordHash, plus the one-time generatedPassword
  const { passwordHash: _omit, ...safeUser } = newUser;
  // Cache-Control: no-store to prevent caching one-time password (review suggestion)
  res.setHeader('Cache-Control', 'no-store');
  res.status(201).json({ user: safeUser, generatedPassword });
});

/**
 * DELETE /api/auth/users/:username
 *
 * Remove a user (USER-04, D-03). Admin only.
 * Self-delete guard prevents admin from locking themselves out (T-04-03).
 */
userAdminRouter.delete('/users/:username', async (req: Request, res: Response): Promise<void> => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const target = String(req.params.username ?? '');

  // Self-delete guard (T-04-03)
  if (req.auth.preferred_username.toLowerCase() === target.toLowerCase()) {
    res.status(409).json({ error: 'Cannot delete your own account' });
    return;
  }

  // F-11: atomic read-modify-write under lock prevents TOCTOU race
  try {
    await modifyUsers((users) => {
      const idx = users.findIndex((u) => u.username.toLowerCase() === target.toLowerCase());
      if (idx === -1) throw new Error('USER_NOT_FOUND');
      return [...users.slice(0, idx), ...users.slice(idx + 1)];
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    throw err;
  }
  // PROT-001: revoke all active sessions for the deleted user so their
  // still-valid JWTs cannot be used after account deletion.
  // If sessionsDb is not initialised (e.g. Keycloak mode) this is a no-op.
  try {
    revokeByUsername(target);
  } catch {
    // sessionsDb not initialised — safe to ignore
  }
  res.json({ message: 'User deleted' });
});

/**
 * PUT /api/auth/users/:username
 *
 * Update a user's profile (firstName, lastName, role, centers). Admin only.
 * Username and passwordHash are immutable via this endpoint.
 */
userAdminRouter.put('/users/:username', async (req: Request, res: Response): Promise<void> => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const target = String(req.params.username ?? '');
  const { role, centers, firstName, lastName, active } = req.body as Record<string, unknown>;

  // Validate role against allowlist
  if (role !== undefined && (typeof role !== 'string' || !VALID_ROLES.has(role))) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${[...VALID_ROLES].join(', ')}` });
    return;
  }

  // UMGMT-03 / T-32-04 — validate active is boolean when present.
  // Server is authoritative; client checkbox is convenience only.
  if (active !== undefined && typeof active !== 'boolean') {
    res.status(400).json({ error: '`active` must be a boolean when provided' });
    return;
  }

  // Validate centers against allowlist
  const rawCenters = Array.isArray(centers) ? centers.filter((c): c is string => typeof c === 'string') : undefined;
  if (rawCenters !== undefined) {
    const validCenterIds = getValidCenterIds();
    const invalidCenters = rawCenters.filter((c) => !validCenterIds.has(c));
    if (invalidCenters.length > 0) {
      res.status(400).json({ error: `Invalid center codes: ${invalidCenters.join(', ')}` });
      return;
    }
  }

  let updated: UserRecord | undefined;
  // UMGMT-03 / T-32-03 — track whether this PUT deactivates the user (true→false).
  // Used to revoke sessions AFTER the write commits (mirrors PROT-001 delete at :644-648).
  let wasDeactivated = false;

  try {
    await modifyUsers((users) => {
      const user = users.find((u) => u.username.toLowerCase() === target.toLowerCase());
      if (!user) throw new Error('USER_NOT_FOUND');
      if (role !== undefined && typeof role === 'string') user.role = role;
      if (rawCenters !== undefined) user.centers = rawCenters;
      if (typeof firstName === 'string') user.firstName = firstName.trim() || undefined;
      if (typeof lastName === 'string') user.lastName = lastName.trim() || undefined;
      // UMGMT-03: set active flag when provided; capture deactivation transition
      if (typeof active === 'boolean') {
        const previousActive = user.active;
        user.active = active;
        // revokeByUsername on true→false transition (PROT-001 parity)
        if (active === false && previousActive !== false) {
          wasDeactivated = true;
        }
      }
      updated = user;
      return users;
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    throw err;
  }

  // UMGMT-03 / T-32-03 — revoke all sessions for a freshly deactivated user.
  // If sessionsDb is uninitialised this is a no-op (mirrors DELETE handler).
  if (wasDeactivated) {
    try {
      revokeByUsername(target);
    } catch {
      // sessionsDb not initialised — safe to ignore
    }
  }

  const { passwordHash: _omit, ...safeUser } = updated!;
  res.json({ user: safeUser });
});

/**
 * PUT /api/auth/users/me/password
 *
 * Plan 20-02 / D-18 (SESSION-03) — self password change. Verifies the current
 * password (proof-of-possession) before accepting the new one, then bumps
 * tokenVersion + passwordChangedAt atomically with the new hash so any
 * outstanding refresh cookie is invalidated on next /refresh.
 *
 * MUST be registered BEFORE the `/users/:username/password` route so the
 * literal `/me/` path wins over the parameterized match (Express matches in
 * registration order).
 *
 * Body: { currentPassword: string, newPassword: string }
 * - 400 on missing fields or newPassword shorter than 8 chars
 * - 401 on bad currentPassword
 * - 200 on success
 */
userAdminRouter.put('/users/me/password', async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) { res.status(401).json({ error: 'Authentication required' }); return; }
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
    res.status(400).json({ error: 'currentPassword and newPassword are required' });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'newPassword must be at least 8 characters' });
    return;
  }

  const username = req.auth.preferred_username;
  const user = loadUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!user || !user.passwordHash) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  const nowIso = new Date().toISOString();
  try {
    await modifyUsers((users) => {
      const u = users.find((x) => x.username.toLowerCase() === username.toLowerCase());
      if (!u) throw new Error('USER_NOT_FOUND');
      u.passwordHash = newHash;
      u.tokenVersion = (u.tokenVersion ?? 0) + 1;
      u.passwordChangedAt = nowIso;
      return users;
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    throw err;
  }
  res.json({ ok: true });
});

/**
 * PUT /api/auth/users/:username/password
 *
 * Reset a user's password (USER-11, D-03). Admin only.
 * Password is SERVER-GENERATED — no plaintext in request body (review concern #1, T-04-07).
 */
userAdminRouter.put('/users/:username/password', async (req: Request, res: Response): Promise<void> => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const target = String(req.params.username ?? '');

  // Server generates the new password — no plaintext in request body
  // This eliminates the audit log leak (review concern #1, T-04-07)
  const generatedPassword = generateSecurePassword();
  const newHash = await bcrypt.hash(generatedPassword, 12);

  // F-11: atomic read-modify-write under lock prevents TOCTOU race
  // Plan 20-02 / D-18: bump tokenVersion + passwordChangedAt in the SAME write
  // so outstanding refresh tokens for this user are invalidated atomically.
  const nowIso = new Date().toISOString();
  try {
    await modifyUsers((users) => {
      const user = users.find((u) => u.username.toLowerCase() === target.toLowerCase());
      if (!user) throw new Error('USER_NOT_FOUND');
      user.passwordHash = newHash;
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      user.passwordChangedAt = nowIso;
      return users;
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    throw err;
  }

  // Cache-Control: no-store to prevent caching one-time password (review suggestion)
  res.setHeader('Cache-Control', 'no-store');
  res.json({ generatedPassword });
});
