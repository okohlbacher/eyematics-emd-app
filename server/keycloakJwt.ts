/**
 * Keycloak RS256 JWT verification — physically separated from the local HS256
 * path so the ESLint `no-restricted-imports` rule (Plan 20-02 / D-04) can ban
 * `jsonwebtoken` outside of `server/jwtUtil.ts` and this file.
 *
 * Why a second module? The Keycloak path uses RS256 + a JWKS-fetched public key,
 * a fundamentally different verification contract from the HS256 + shared-secret
 * `jwtUtil`. Mixing them in one helper would force an awkward overload; keeping
 * them in separate files makes the algorithm pin physical (the wrong file
 * literally cannot import the wrong key type).
 *
 * This file performs ONLY the cryptographic verification — claim normalization
 * and challenge-token rejection live in `server/authMiddleware.ts` because they
 * are policy decisions, not key-management concerns.
 */

import jwt from 'jsonwebtoken';

/**
 * Decode a JWT to inspect its header (NOT verify). Used to read the `kid`
 * before fetching the matching JWKS public key.
 */
export function decodeKeycloakHeader(token: string): jwt.Jwt | null {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string') return null;
  return decoded;
}

/**
 * Verify a Keycloak-issued JWT against the supplied PEM-encoded RSA public key.
 * RS256 hard-pin via `algorithms: ['RS256']`. Throws on signature mismatch,
 * algorithm mismatch, or expired token.
 *
 * Returns the raw claims object — the caller is responsible for normalizing
 * Keycloak's role/centers shapes and rejecting `purpose: 'challenge'`.
 */
export function verifyKeycloakToken(token: string, publicKeyPem: string): Record<string, unknown> {
  return jwt.verify(token, publicKeyPem, {
    algorithms: ['RS256'],
  }) as Record<string, unknown>;
}
