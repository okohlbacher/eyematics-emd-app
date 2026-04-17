/**
 * T-05: Tests for issueApi.ts — issue creation, listing, export.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Redirect FEEDBACK_DIR to a temp directory
let tmpFeedbackDir: string;

vi.mock('../server/utils.js', () => ({
  readBody: vi.fn(),
  sendError: vi.fn(),
  validateAuth: vi.fn(),
}));

// We need to patch the FEEDBACK_DIR constant. Since it's a module-level const,
// we'll test the Router directly with a custom feedback dir by writing test
// files into the expected location.

import { issueApiRouter } from '../server/issueApi';

function createApp(role: string) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use((req, _res, next) => {
    req.auth = { sub: 'testuser', preferred_username: 'testuser', role, centers: [], iat: 0, exp: 0 };
    next();
  });
  app.use('/api/issues', issueApiRouter);
  return app;
}

describe('issueApi', () => {
  describe('POST /api/issues', () => {
    it('creates an issue with valid data', async () => {
      const app = createApp('researcher');
      const res = await request(app)
        .post('/api/issues')
        .send({ page: 'Dashboard', description: 'Button broken' });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('filename');
    });

    it('returns 400 for missing page', async () => {
      const app = createApp('researcher');
      const res = await request(app)
        .post('/api/issues')
        .send({ description: 'No page' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('page');
    });

    it('returns 400 for missing description', async () => {
      const app = createApp('researcher');
      const res = await request(app)
        .post('/api/issues')
        .send({ page: 'Dashboard' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('description');
    });

    it('returns 400 for non-object body', async () => {
      const app = createApp('researcher');
      const res = await request(app)
        .post('/api/issues')
        .send('not json');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/issues', () => {
    it('returns issues list with total', async () => {
      const app = createApp('researcher');
      // Create one issue first
      await request(app).post('/api/issues').send({ page: 'Test', description: 'Test issue' });

      const res = await request(app).get('/api/issues');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('issues');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.issues)).toBe(true);
    });
  });

  describe('GET /api/issues/export', () => {
    it('returns 403 for non-admin', async () => {
      const app = createApp('researcher');
      const res = await request(app).get('/api/issues/export');
      expect(res.status).toBe(403);
    });

    it('returns issues for admin', async () => {
      const app = createApp('admin');
      const res = await request(app).get('/api/issues/export');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('issues');
    });
  });
});
