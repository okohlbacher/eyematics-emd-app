/**
 * T-07: Tests for authMiddleware.ts — local HS256 path.
 * Validates JWT verification, challenge token rejection, public path bypass.
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock initAuth to provide a known JWT secret
const TEST_SECRET = 'test-secret-for-auth-middleware';
vi.mock('../server/initAuth.js', () => ({
  getJwtSecret: () => TEST_SECRET,
}));
vi.mock('../server/keycloakAuth.js', () => ({
  getAuthProvider: () => 'local',
  getJwksClient: () => null,
}));

import { authMiddleware } from '../server/authMiddleware';

function createApp() {
  const app = express();
  app.use('/api', authMiddleware);
  app.get('/api/auth/login', (_req, res) => res.json({ public: true }));
  app.get('/api/auth/verify', (_req, res) => res.json({ public: true }));
  app.get('/api/auth/config', (_req, res) => res.json({ public: true }));
  app.get('/api/protected', (req, res) => res.json({ auth: req.auth }));
  return app;
}

function signToken(payload: Record<string, unknown>, options?: jwt.SignOptions): string {
  return jwt.sign(payload, TEST_SECRET, { algorithm: 'HS256', expiresIn: '10m', ...options });
}

describe('authMiddleware (local HS256)', () => {
  describe('public paths', () => {
    it('allows /api/auth/login without token', async () => {
      const app = createApp();
      const res = await request(app).get('/api/auth/login');
      expect(res.status).toBe(200);
      expect(res.body.public).toBe(true);
    });

    it('allows /api/auth/verify without token', async () => {
      const app = createApp();
      const res = await request(app).get('/api/auth/verify');
      expect(res.status).toBe(200);
    });

    it('allows /api/auth/config without token', async () => {
      const app = createApp();
      const res = await request(app).get('/api/auth/config');
      expect(res.status).toBe(200);
    });
  });

  describe('protected paths', () => {
    it('returns 401 without Authorization header', async () => {
      const app = createApp();
      const res = await request(app).get('/api/protected');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Authentication required');
    });

    it('returns 401 with invalid token', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid or expired');
    });

    it('returns 401 with token signed by wrong secret', async () => {
      const app = createApp();
      const token = jwt.sign({ sub: 'admin', preferred_username: 'admin', role: 'admin', centers: [] }, 'wrong-secret');
      const res = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });

    it('returns 401 with expired token', async () => {
      const app = createApp();
      const token = signToken(
        { sub: 'admin', preferred_username: 'admin', role: 'admin', centers: [] },
        { expiresIn: '-1s' },
      );
      const res = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });

    it('populates req.auth with valid token', async () => {
      const app = createApp();
      const token = signToken({
        sub: 'admin',
        preferred_username: 'admin',
        role: 'admin',
        centers: ['org-uka'],
      });
      const res = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.auth.preferred_username).toBe('admin');
      expect(res.body.auth.role).toBe('admin');
      expect(res.body.auth.centers).toEqual(['org-uka']);
    });

    it('rejects challenge-purpose tokens (T-02-02)', async () => {
      const app = createApp();
      const token = signToken({
        sub: 'admin',
        preferred_username: 'admin',
        role: 'admin',
        centers: [],
        purpose: 'challenge',
      });
      const res = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Challenge tokens');
    });

    it('returns 401 without Bearer prefix', async () => {
      const app = createApp();
      const token = signToken({ sub: 'admin', preferred_username: 'admin', role: 'admin', centers: [] });
      const res = await request(app)
        .get('/api/protected')
        .set('Authorization', `Basic ${token}`);
      expect(res.status).toBe(401);
    });
  });
});
