/**
 * Phase 15 — TOTP enrollment and verify tests (SEC-04, SEC-05).
 *
 * Setup pattern mirrors mustChangePassword.test.ts:
 *   - Temp dir per test, initAuth(), supertest against Express app
 *   - Two users: one with totpEnabled=true (enrolled), one without (unenrolled)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../server/keycloakAuth.js', () => ({
  getAuthProvider: () => 'local',
  getJwksClient: () => null,
}));

import { generateSecret, generateSync } from 'otplib';

import { authApiRouter } from '../server/authApi';
import { initAuth, loadUsers, type UserRecord } from '../server/initAuth';

const TEST_SECRET = 'test-secret-for-totp-enrollment-tests';

let tmpDir: string;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authApiRouter);
  return app;
}

function writeUsers(dir: string, users: UserRecord[]): void {
  fs.writeFileSync(path.join(dir, 'users.json'), JSON.stringify(users, null, 2), 'utf-8');
}

function writeJwtSecret(dir: string, secret: string): void {
  fs.writeFileSync(path.join(dir, 'jwt-secret.txt'), secret, { encoding: 'utf-8', mode: 0o600 });
}

/** Settings with twoFactorEnabled=true so the TOTP gate activates */
function makeSettings(twoFactorEnabled = true): Record<string, unknown> {
  return { twoFactorEnabled, maxLoginAttempts: 5, otpCode: 'static123' };
}

/** A pre-enrolled user (totpEnabled=true, known secret, 2 recovery code hashes) */
function makeEnrolledUser(totpSecret: string, recoveryHashes: string[]): UserRecord {
  return {
    username: 'enrolled',
    passwordHash: bcrypt.hashSync('password123!', 4),
    role: 'researcher',
    centers: ['org-uka'],
    createdAt: '2025-01-01T00:00:00Z',
    totpSecret,
    totpEnabled: true,
    totpRecoveryCodes: recoveryHashes,
  };
}

/** A user who has not yet enrolled TOTP */
function makeUnenrolledUser(): UserRecord {
  return {
    username: 'unenrolled',
    passwordHash: bcrypt.hashSync('password123!', 4),
    role: 'researcher',
    centers: ['org-uka'],
    createdAt: '2025-01-01T00:00:00Z',
    // no totpEnabled / totpSecret
  };
}

/** A non-enrolled user who should use the static OTP fallback */
function makeNonTotpUser(): UserRecord {
  return {
    username: 'nototp',
    passwordHash: bcrypt.hashSync('password123!', 4),
    role: 'researcher',
    centers: ['org-uka'],
    createdAt: '2025-01-01T00:00:00Z',
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'totp-enroll-test-'));
  writeJwtSecret(tmpDir, TEST_SECRET);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Phase 15 — TOTP enrollment (SEC-04)
// ---------------------------------------------------------------------------

describe('Phase 15 — TOTP enrollment (SEC-04)', () => {
  it('POST /login returns requiresTotpEnrollment + enrollToken when unenrolled and twoFactorEnabled=true', async () => {
    const unenrolled = makeUnenrolledUser();
    writeUsers(tmpDir, [unenrolled]);
    initAuth(tmpDir, makeSettings(true));

    const app = createApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'unenrolled', password: 'password123!' });

    expect(res.status).toBe(200);
    expect(res.body.requiresTotpEnrollment).toBe(true);
    expect(typeof res.body.enrollToken).toBe('string');
    // Must NOT contain a session token or challengeToken
    expect(res.body.token).toBeUndefined();
    expect(res.body.challengeToken).toBeUndefined();

    // Verify enrollToken has correct purpose and embeds totpSecret
    const payload = jwt.decode(res.body.enrollToken as string) as {
      purpose: string;
      sub: string;
      totpSecret: string;
    };
    expect(payload.purpose).toBe('totp-enroll');
    expect(payload.sub).toBe('unenrolled');
    expect(typeof payload.totpSecret).toBe('string');
    expect(payload.totpSecret.length).toBeGreaterThan(0);
  });

  it('POST /api/auth/totp/enroll requires valid enrollToken purpose', async () => {
    writeUsers(tmpDir, [makeUnenrolledUser()]);
    initAuth(tmpDir, makeSettings(true));

    const app = createApp();

    // No token at all → 400
    const res1 = await request(app)
      .post('/api/auth/totp/enroll')
      .send({});
    expect(res1.status).toBe(400);

    // Invalid JWT → 401
    const res2 = await request(app)
      .post('/api/auth/totp/enroll')
      .send({ enrollToken: 'not.a.real.token' });
    expect(res2.status).toBe(401);

    // Valid JWT but wrong purpose → 401
    const wrongPurposeToken = jwt.sign(
      { sub: 'unenrolled', purpose: 'challenge' },
      TEST_SECRET,
      { algorithm: 'HS256', expiresIn: '3m' },
    );
    const res3 = await request(app)
      .post('/api/auth/totp/enroll')
      .send({ enrollToken: wrongPurposeToken });
    expect(res3.status).toBe(401);
  });

  it('POST /api/auth/totp/enroll returns qrDataUrl, manualKey, enrollToken', async () => {
    writeUsers(tmpDir, [makeUnenrolledUser()]);
    initAuth(tmpDir, makeSettings(true));

    const app = createApp();

    // First: get an enrollToken from /login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'unenrolled', password: 'password123!' });
    expect(loginRes.status).toBe(200);
    const { enrollToken } = loginRes.body as { enrollToken: string };

    // Now call /totp/enroll
    const enrollRes = await request(app)
      .post('/api/auth/totp/enroll')
      .send({ enrollToken });

    expect(enrollRes.status).toBe(200);
    expect(enrollRes.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(typeof enrollRes.body.manualKey).toBe('string');
    expect(enrollRes.body.manualKey.length).toBeGreaterThanOrEqual(16); // base32 secret
    expect(typeof enrollRes.body.enrollToken).toBe('string'); // fresh token
  });

  // bcrypt.hash×10 at rounds=12 takes ~3-4s; 30s timeout
  it('POST /api/auth/totp/confirm verifies TOTP code against embedded secret and activates totpEnabled',
    async () => {
      writeUsers(tmpDir, [makeUnenrolledUser()]);
      initAuth(tmpDir, makeSettings(true));

      const app = createApp();

      // Get enrollToken from /login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'unenrolled', password: 'password123!' });
      const { enrollToken } = loginRes.body as { enrollToken: string };

      // Extract the embedded secret from the token (no signature needed — just decode payload)
      const payload = jwt.decode(enrollToken) as { totpSecret: string };
      const totpSecret = payload.totpSecret;

      // Generate a valid TOTP code from the secret
      const otp = generateSync({ secret: totpSecret });

      const confirmRes = await request(app)
        .post('/api/auth/totp/confirm')
        .send({ enrollToken, otp });

      expect(confirmRes.status).toBe(200);
      expect(typeof confirmRes.body.token).toBe('string');
      expect(Array.isArray(confirmRes.body.recoveryCodes)).toBe(true);
      expect(confirmRes.body.recoveryCodes).toHaveLength(10);

      // Each recovery code must match XXXX-XXXX pattern (D-03)
      for (const code of confirmRes.body.recoveryCodes as string[]) {
        expect(code).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);
      }

      // Verify users.json now has totpEnabled=true
      const users = loadUsers();
      const user = users.find((u) => u.username === 'unenrolled');
      expect(user?.totpEnabled).toBe(true);
      expect(typeof user?.totpSecret).toBe('string');
      expect(Array.isArray(user?.totpRecoveryCodes)).toBe(true);
      expect(user?.totpRecoveryCodes).toHaveLength(10);
      // Recovery codes in users.json must be bcrypt hashes, not plaintext
      expect(user?.totpRecoveryCodes?.[0]).toMatch(/^\$2[ab]\$/);
    },
    30000,
  );
});

// ---------------------------------------------------------------------------
// Phase 15 — TOTP recovery codes (SEC-05)
// ---------------------------------------------------------------------------

describe('Phase 15 — TOTP recovery codes (SEC-05)', () => {
  // bcrypt.hash×10 at rounds=12 takes ~3-4s; 30s timeout
  it('Enrollment returns 10 plaintext recovery codes exactly once',
    async () => {
      writeUsers(tmpDir, [makeUnenrolledUser()]);
      initAuth(tmpDir, makeSettings(true));

      const app = createApp();
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'unenrolled', password: 'password123!' });
      const { enrollToken } = loginRes.body as { enrollToken: string };

      const payload = jwt.decode(enrollToken) as { totpSecret: string };
      const otp = generateSync({ secret: payload.totpSecret });

      const confirmRes = await request(app)
        .post('/api/auth/totp/confirm')
        .send({ enrollToken, otp });

      expect(confirmRes.status).toBe(200);
      const codes = confirmRes.body.recoveryCodes as string[];
      expect(codes).toHaveLength(10);
      // Each code must be plaintext (not a bcrypt hash)
      for (const code of codes) {
        expect(code).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);
        expect(code).not.toMatch(/^\$2/);
      }
    },
    30000,
  );

  // bcrypt.hash×10 at rounds=12 takes ~3-4s; 30s timeout
  it('Recovery codes persist as bcrypt hashes in users.json (not plaintext)',
    async () => {
      writeUsers(tmpDir, [makeUnenrolledUser()]);
      initAuth(tmpDir, makeSettings(true));

      const app = createApp();
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'unenrolled', password: 'password123!' });
      const { enrollToken } = loginRes.body as { enrollToken: string };

      const payload = jwt.decode(enrollToken) as { totpSecret: string };
      const otp = generateSync({ secret: payload.totpSecret });

      await request(app)
        .post('/api/auth/totp/confirm')
        .send({ enrollToken, otp });

      const users = loadUsers();
      const user = users.find((u) => u.username === 'unenrolled');
      expect(Array.isArray(user?.totpRecoveryCodes)).toBe(true);
      expect(user?.totpRecoveryCodes).toHaveLength(10);
      // All stored values must be bcrypt hashes
      for (const hash of user!.totpRecoveryCodes!) {
        expect(hash).toMatch(/^\$2[ab]\$/);
      }
    },
    30000,
  );
});

// ---------------------------------------------------------------------------
// Phase 15 — TOTP verify with enrolled user (SEC-04 continued)
// ---------------------------------------------------------------------------

describe('Phase 15 — TOTP verify (SEC-04)', () => {
  let enrolledSecret: string;

  beforeEach(() => {
    // Create a fresh enrolled user with known secret
    enrolledSecret = generateSecret();
    const recovery1 = 'AAAA-1111';
    const recovery2 = 'BBBB-2222';
    const recoveryHashes = [
      bcrypt.hashSync(recovery1, 4),
      bcrypt.hashSync(recovery2, 4),
    ];
    const enrolled = makeEnrolledUser(enrolledSecret, recoveryHashes);
    const unenrolled = makeNonTotpUser();
    writeUsers(tmpDir, [enrolled, unenrolled]);
    initAuth(tmpDir, makeSettings(true));
  });

  /** Helper: get a challengeToken for an enrolled user */
  async function getChallengeToken(app: express.Express, username: string): Promise<string> {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'password123!' });
    return res.body.challengeToken as string;
  }

  it('POST /verify with enrolled user accepts a valid RFC 6238 TOTP code (window=1)', async () => {
    const app = createApp();
    const challengeToken = await getChallengeToken(app, 'enrolled');

    const otp = generateSync({ secret: enrolledSecret });
    const res = await request(app)
      .post('/api/auth/verify')
      .send({ challengeToken, otp });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.recoveryCodeUsed).toBeUndefined();
  });

  it('POST /verify with enrolled user rejects an invalid TOTP code with 401', async () => {
    const app = createApp();
    const challengeToken = await getChallengeToken(app, 'enrolled');

    const res = await request(app)
      .post('/api/auth/verify')
      .send({ challengeToken, otp: '000000' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeTruthy();
  });

  it('POST /verify with non-enrolled user still accepts the static otpCode fallback', async () => {
    // D-07: Static otpCode fallback for unenrolled users.
    // The /login gate returns requiresTotpEnrollment for unenrolled users under twoFactorEnabled=true,
    // so a non-enrolled user cannot get a challengeToken via /login. The static OTP fallback in
    // /verify is a safety net for edge cases (e.g. admin reset between /login and /verify).
    // Test approach: manually craft a challengeToken (server-signed, valid purpose) and verify
    // that /verify accepts the static otpCode for a user without totpEnabled=true.

    // Create a challengeToken manually for the nototp user
    const challengeToken = jwt.sign(
      { sub: 'nototp', purpose: 'challenge' },
      TEST_SECRET,
      { algorithm: 'HS256', expiresIn: '2m' },
    );

    const app = createApp();
    const res = await request(app)
      .post('/api/auth/verify')
      .send({ challengeToken, otp: 'static123' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  it('POST /verify accepts a valid recovery code and burns it (removed from array)', async () => {
    const app = createApp();
    const challengeToken = await getChallengeToken(app, 'enrolled');

    const res = await request(app)
      .post('/api/auth/verify')
      .send({ challengeToken, otp: 'AAAA-1111' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.recoveryCodeUsed).toBe(true);

    // Users.json should now have 1 recovery code (the second one)
    const users = loadUsers();
    const user = users.find((u) => u.username === 'enrolled');
    expect(user?.totpRecoveryCodes).toHaveLength(1);
  });

  it('A burned recovery code cannot be reused (second attempt 401)', async () => {
    const app = createApp();

    // First use of recovery code AAAA-1111
    const challengeToken1 = await getChallengeToken(app, 'enrolled');
    const res1 = await request(app)
      .post('/api/auth/verify')
      .send({ challengeToken: challengeToken1, otp: 'AAAA-1111' });
    expect(res1.status).toBe(200);

    // Now try to reuse the same code — need a new challengeToken from /login
    const challengeToken2 = await getChallengeToken(app, 'enrolled');
    // Use the burned recovery code again
    const res2 = await request(app)
      .post('/api/auth/verify')
      .send({ challengeToken: challengeToken2, otp: 'AAAA-1111' });
    expect(res2.status).toBe(401);
  });

  it('POST /verify response includes recoveryCodeUsed: true when recovery path taken', async () => {
    const app = createApp();
    const challengeToken = await getChallengeToken(app, 'enrolled');

    // Use recovery code
    const res = await request(app)
      .post('/api/auth/verify')
      .send({ challengeToken, otp: 'BBBB-2222' });

    expect(res.status).toBe(200);
    expect(res.body.recoveryCodeUsed).toBe(true);

    // Using a valid TOTP code should NOT have recoveryCodeUsed
    const otp = generateSync({ secret: enrolledSecret });
    const challengeToken2 = await getChallengeToken(app, 'enrolled');
    const res2 = await request(app)
      .post('/api/auth/verify')
      .send({ challengeToken: challengeToken2, otp });
    expect(res2.status).toBe(200);
    expect(res2.body.recoveryCodeUsed).toBeUndefined();
  });
});
