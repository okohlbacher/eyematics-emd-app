/**
 * JWT authentication middleware for Express.
 *
 * Validates Bearer tokens on all /api/* routes, excluding public auth paths.
 * Branches on auth provider:
 *   - local: HS256 validation using local JWT secret (existing behavior unchanged)
 *   - keycloak: RS256 validation via JWKS endpoint (T-06-01, T-06-02)
 *
 * Challenge-purpose tokens are rejected on protected routes (T-02-02).
 * Keycloak unavailability returns 503 fail-closed (D-03, T-06-05).
 */

import type { NextFunction,Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { getJwtSecret } from './initAuth.js';
import { getAuthProvider, getJwksClient } from './keycloakAuth.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthPayload {
  sub: string;
  preferred_username: string;
  role: string;
  centers: string[];
  purpose?: string;
  iat: number;
  exp: number;
}

// F-17: Single declaration — all server files import authMiddleware transitively
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

// ---------------------------------------------------------------------------
// Public paths (no JWT required)
// ---------------------------------------------------------------------------

const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/verify',
  '/api/auth/config',
  '/api/auth/change-password',
  '/api/auth/totp/enroll',
  '/api/auth/totp/confirm',
];

// ---------------------------------------------------------------------------
// Local HS256 verification (existing behavior)
// ---------------------------------------------------------------------------

/**
 * Verify a local HS256 JWT and populate req.auth.
 * Rejects challenge-purpose tokens (T-02-02).
 */
function verifyLocalToken(token: string, req: Request, res: Response, next: NextFunction): void {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as AuthPayload;
    if (
      payload.purpose === 'challenge' ||
      payload.purpose === 'change-password' ||
      payload.purpose === 'totp-enroll'
    ) {
      res.status(401).json({ error: 'Challenge tokens cannot be used for authentication' });
      return;
    }
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ---------------------------------------------------------------------------
// Keycloak RS256 JWKS verification
// ---------------------------------------------------------------------------

/**
 * Verify a Keycloak RS256 JWT via JWKS endpoint and populate req.auth.
 *
 * Security behaviors:
 * - 503 when JWKS client not initialized (D-03 fail-closed)
 * - 401 when token has no kid header (T-06-01 algorithm confusion prevention)
 * - Explicit algorithms: ['RS256'] to prevent algorithm confusion attacks (T-06-01)
 * - 503 on ECONNREFUSED/ENOTFOUND (D-03 fail-closed, T-06-05)
 * - Claim normalization: role array->string, centers string->array (T-06-03)
 * - Rejects challenge-purpose tokens (T-02-02)
 */
async function verifyKeycloakToken(token: string, req: Request, res: Response, next: NextFunction): Promise<void> {
  const client = getJwksClient();
  if (!client) {
    res.status(503).json({ error: 'Keycloak auth not initialized' });
    return;
  }

  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
      res.status(401).json({ error: 'Token missing key ID (kid)' });
      return;
    }

    const signingKey = await client.getSigningKey(decoded.header.kid);
    const raw = jwt.verify(token, signingKey.getPublicKey(), {
      algorithms: ['RS256'],
    }) as Record<string, unknown>;

    // Reject challenge-purpose tokens (T-02-02)
    if (raw.purpose === 'challenge' || raw.purpose === 'totp-enroll') {
      res.status(401).json({ error: 'Challenge tokens cannot be used for authentication' });
      return;
    }

    // Normalize claims: Keycloak may return role as array, centers as single string (T-06-03)
    const rawRole = Array.isArray(raw.role) ? (raw.role as string[])[0] : (raw.role as string);
    const rawCenters = Array.isArray(raw.centers)
      ? (raw.centers as string[])
      : typeof raw.centers === 'string' ? [raw.centers as string] : [];

    req.auth = {
      sub: raw.sub as string,
      preferred_username: raw.preferred_username as string,
      role: rawRole,
      centers: rawCenters,
      iat: raw.iat as number,
      exp: raw.exp as number,
    };
    next();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('network')) {
      res.status(503).json({ error: 'Keycloak is unreachable. Contact your administrator.' });
    } else {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Validates JWT Bearer tokens on all routes.
 * Skips validation for PUBLIC_PATHS.
 * Branches on provider: local (HS256) or keycloak (RS256 via JWKS).
 *
 * Uses req.originalUrl (not req.path) for reliable matching when middleware
 * is mounted on a sub-path (addresses review concern #6).
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Use req.originalUrl for reliable matching (review concern #6)
  const urlPath = req.originalUrl.split('?')[0];

  if (PUBLIC_PATHS.includes(urlPath)) {
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = header.slice(7);
  const provider = getAuthProvider();

  if (provider === 'keycloak') {
    await verifyKeycloakToken(token, req, res, next);
  } else {
    verifyLocalToken(token, req, res, next);
  }
}
