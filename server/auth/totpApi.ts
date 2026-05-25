/**
 * TOTP router: enroll / confirm / disable / status + admin reset
 *
 * Per-user TOTP (SEC-15, Phase 15).
 */

import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

import type { UserRecord } from '../initAuth.js';
import { loadUsers, modifyUsers } from '../initAuth.js';

export const totpRouter = Router();

// ---------------------------------------------------------------------------
// Per-user TOTP (SEC-15, Phase 15): enroll / confirm / disable / admin-reset
// ---------------------------------------------------------------------------

const TOTP_ISSUER = 'EyeMatics EMD';
const RECOVERY_CODE_COUNT = 10;

function generateRecoveryCode(): string {
  // 10 chars base32-ish: user-typable, ~50 bits entropy
  return crypto.randomBytes(8).toString('base64url').slice(0, 10).toUpperCase();
}

/**
 * POST /api/auth/totp/enroll
 * Starts (or restarts) TOTP enrollment for the authenticated user. Generates
 * a new secret, otpauth URL, QR data URL, and 10 one-time recovery codes.
 * Secret is stored immediately but totpEnabled stays false until /confirm.
 */
totpRouter.post('/totp/enroll', async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) { res.status(401).json({ error: 'Authentication required' }); return; }
  const username = req.auth.preferred_username;

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(username, TOTP_ISSUER, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth);

  const plaintextCodes: string[] = [];
  const hashedCodes: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const code = generateRecoveryCode();
    plaintextCodes.push(code);
    hashedCodes.push(await bcrypt.hash(code, 10));
  }

  try {
    await modifyUsers((users) => users.map((u) => {
      if (u.username.toLowerCase() !== username.toLowerCase()) return u;
      return { ...u, totpSecret: secret, totpEnabled: false, recoveryCodeHashes: hashedCodes };
    }));
  } catch {
    res.status(500).json({ error: 'Failed to persist TOTP enrollment' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json({ otpauth, qrDataUrl, recoveryCodes: plaintextCodes });
});

/**
 * POST /api/auth/totp/confirm  { otp }
 * Verifies the first 6-digit code against the pending secret and flips
 * totpEnabled=true. Required before TOTP is enforced at login.
 */
totpRouter.post('/totp/confirm', async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) { res.status(401).json({ error: 'Authentication required' }); return; }
  const { otp } = req.body as { otp?: string };
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
    res.status(400).json({ error: 'otp must be a 6-digit code' });
    return;
  }
  const username = req.auth.preferred_username;
  const user = loadUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!user || !user.totpSecret) {
    res.status(409).json({ error: 'No pending TOTP enrollment. Call /totp/enroll first.' });
    return;
  }
  if (!authenticator.check(otp.trim(), user.totpSecret)) {
    res.status(401).json({ error: 'Invalid OTP' });
    return;
  }
  // Plan 20-02 / D-18: bump tokenVersion + totpChangedAt atomically with the
  // totpEnabled flip so outstanding refresh cookies are invalidated.
  const nowIso = new Date().toISOString();
  try {
    await modifyUsers((users) => users.map((u) =>
      u.username.toLowerCase() === username.toLowerCase()
        ? { ...u, totpEnabled: true, tokenVersion: (u.tokenVersion ?? 0) + 1, totpChangedAt: nowIso }
        : u,
    ));
  } catch {
    res.status(500).json({ error: 'Failed to enable TOTP' });
    return;
  }
  res.json({ totpEnabled: true });
});

/**
 * POST /api/auth/totp/disable  { otp }
 * Self-disable TOTP. Requires a current valid OTP (or recovery code) to prove possession.
 */
totpRouter.post('/totp/disable', async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) { res.status(401).json({ error: 'Authentication required' }); return; }
  const { otp } = req.body as { otp?: string };
  if (typeof otp !== 'string' || !otp.trim()) {
    res.status(400).json({ error: 'otp is required' });
    return;
  }
  const username = req.auth.preferred_username;
  const user = loadUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!user || !user.totpEnabled || !user.totpSecret) {
    res.status(409).json({ error: 'TOTP is not enabled for this user' });
    return;
  }
  const input = otp.trim();
  let ok = /^\d{6}$/.test(input) ? authenticator.check(input, user.totpSecret) : false;
  if (!ok && Array.isArray(user.recoveryCodeHashes)) {
    for (const h of user.recoveryCodeHashes) {
      if (await bcrypt.compare(input, h)) { ok = true; break; }
    }
  }
  if (!ok) { res.status(401).json({ error: 'Invalid OTP' }); return; }
  // Plan 20-02 / D-18: bump tokenVersion + totpChangedAt atomically with the
  // TOTP-state strip so outstanding refresh cookies are invalidated.
  const nowIso = new Date().toISOString();
  try {
    await modifyUsers((users) => users.map((u) => {
      if (u.username.toLowerCase() !== username.toLowerCase()) return u;
      const { totpSecret: _s, totpEnabled: _e, recoveryCodeHashes: _c, ...rest } = u;
      return {
        ...(rest as UserRecord),
        tokenVersion: (u.tokenVersion ?? 0) + 1,
        totpChangedAt: nowIso,
      };
    }));
  } catch {
    res.status(500).json({ error: 'Failed to disable TOTP' });
    return;
  }
  res.json({ totpEnabled: false });
});

/**
 * GET /api/auth/totp/status
 * Returns the authenticated user's TOTP state for the SettingsPage UI.
 */
totpRouter.get('/totp/status', (req: Request, res: Response): void => {
  if (!req.auth) { res.status(401).json({ error: 'Authentication required' }); return; }
  const user = loadUsers().find(
    (u) => u.username.toLowerCase() === req.auth!.preferred_username.toLowerCase(),
  );
  res.json({
    totpEnabled: Boolean(user?.totpEnabled),
    recoveryCodesRemaining: user?.recoveryCodeHashes?.length ?? 0,
  });
});

/**
 * POST /api/auth/users/:username/totp/reset
 * Admin-only TOTP reset — clears per-user TOTP state so the user can re-enroll.
 */
totpRouter.post('/users/:username/totp/reset', async (req: Request, res: Response): Promise<void> => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  const target = String(req.params.username ?? '');
  // Plan 20-02 / D-18: bump tokenVersion + totpChangedAt atomically with the
  // admin reset so outstanding refresh cookies for the target are invalidated.
  const nowIso = new Date().toISOString();
  try {
    await modifyUsers((users) => {
      const idx = users.findIndex((u) => u.username.toLowerCase() === target.toLowerCase());
      if (idx === -1) throw new Error('USER_NOT_FOUND');
      const u = users[idx];
      const { totpSecret: _s, totpEnabled: _e, recoveryCodeHashes: _c, ...rest } = u;
      users[idx] = {
        ...(rest as UserRecord),
        tokenVersion: (u.tokenVersion ?? 0) + 1,
        totpChangedAt: nowIso,
      };
      return users;
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    throw err;
  }
  res.json({ totpEnabled: false });
});
