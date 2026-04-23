/**
 * Plan 20-01 / Task 1 — server/jwtUtil.ts
 *
 * Coverage: HS256 algorithm pin, typ-claim cross-rejection, round-trip
 * sign/verify for both token types, and explicit guard against the
 * "expiresIn-in-ms-not-seconds" Pitfall 7.
 */

import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';

const TEST_SECRET = 'test-secret-32-bytes-of-randomness';

vi.mock('../server/initAuth.js', () => ({
  getJwtSecret: () => TEST_SECRET,
}));

import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../server/jwtUtil';

describe('jwtUtil — algorithm pin + typ enforcement', () => {
  it('verifyAccessToken rejects tokens signed with non-HS256 algorithms (HS512)', () => {
    const badToken = jwt.sign(
      { sub: 'u', preferred_username: 'u', role: 'admin', centers: ['c1'], typ: 'access' },
      TEST_SECRET,
      { algorithm: 'HS512', expiresIn: 600 },
    );
    expect(() => verifyAccessToken(badToken)).toThrow(/jwt|algorithm|invalid/i);
  });

  it('verifyAccessToken throws wrong_token_type when payload.typ === "refresh"', () => {
    const refreshShaped = jwt.sign(
      { sub: 'u', typ: 'refresh' },
      TEST_SECRET,
      { algorithm: 'HS256', expiresIn: 600 },
    );
    expect(() => verifyAccessToken(refreshShaped)).toThrow(/wrong_token_type/);
  });

  it('verifyRefreshToken throws wrong_token_type when payload.typ === "access"', () => {
    const accessShaped = jwt.sign(
      { sub: 'u', typ: 'access' },
      TEST_SECRET,
      { algorithm: 'HS256', expiresIn: 600 },
    );
    expect(() => verifyRefreshToken(accessShaped)).toThrow(/wrong_token_type/);
  });

  it('signAccessToken → verifyAccessToken round-trips the claims with typ === "access"', () => {
    const token = signAccessToken(
      { sub: 'u', preferred_username: 'u', role: 'admin', centers: ['c1'] },
      600_000,
    );
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('u');
    expect(payload.preferred_username).toBe('u');
    expect(payload.role).toBe('admin');
    expect(payload.centers).toEqual(['c1']);
    expect(payload.typ).toBe('access');
  });

  it('signRefreshToken → verifyRefreshToken round-trips sub/ver/sid with typ === "refresh"', () => {
    const token = signRefreshToken({ sub: 'u', ver: 0, sid: 'abc-123' }, 28_800_000);
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe('u');
    expect(payload.ver).toBe(0);
    expect(payload.sid).toBe('abc-123');
    expect(payload.typ).toBe('refresh');
  });

  it('ttlMs is converted to seconds (Pitfall 7) — ttlMs=2000 yields exp - iat === 2', () => {
    const token = signAccessToken(
      { sub: 'u', preferred_username: 'u', role: 'admin', centers: [] },
      2000,
    );
    const payload = verifyAccessToken(token);
    expect(payload.exp - payload.iat).toBe(2);
  });
});
