/**
 * JWT authentication middleware for Express.
 *
 * Validates Bearer tokens on all /api/* routes, excluding public auth paths.
 * Challenge-purpose tokens are rejected on protected routes (T-02-02).
 */

import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { getJwtSecret } from './initAuth.js';

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

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

// ---------------------------------------------------------------------------
// Public paths (no JWT required)
// ---------------------------------------------------------------------------

const PUBLIC_PATHS = ['/api/auth/login', '/api/auth/verify', '/api/auth/config'];

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Validates JWT Bearer tokens on all routes.
 * Skips validation for PUBLIC_PATHS.
 *
 * Uses req.originalUrl (not req.path) for reliable matching when middleware
 * is mounted on a sub-path (addresses review concern #6).
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Use req.originalUrl for reliable matching (review concern #6)
  const urlPath = req.originalUrl.split('?')[0];

  if (PUBLIC_PATHS.includes(urlPath)) {
    return next();
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, getJwtSecret()) as AuthPayload;

    // CRITICAL (T-02-02): Reject challenge-purpose tokens on protected routes.
    // Challenge tokens have purpose='challenge' and must NOT be used as session tokens.
    if (payload.purpose === 'challenge') {
      res.status(401).json({ error: 'Challenge tokens cannot be used for authentication' });
      return;
    }

    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
