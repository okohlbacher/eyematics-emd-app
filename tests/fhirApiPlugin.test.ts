/**
 * T-08: Tests for server/fhirApiPlugin.ts — Vite dev plugin for FHIR routes.
 *
 * Tests the middleware function directly by extracting it from the plugin.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('../server/constants.js', () => ({
  getFallbackCenterFiles: () => ['center-aachen.json'],
  getValidCenterIds: () => new Set(['org-uka', 'org-ukb']),
}));

vi.mock('../server/fhirApi.js', () => ({
  filterBundlesByCenters: vi.fn((bundles: unknown[]) => bundles),
}));

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn().mockReturnValue(false),
      readFileSync: vi.fn().mockReturnValue('{}'),
    },
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue('{}'),
  };
});

import { fhirApiPlugin } from '../server/fhirApiPlugin';

// Extract the middleware from the plugin
function getMiddleware(): (req: IncomingMessage, res: ServerResponse, next: () => void) => void {
  const plugin = fhirApiPlugin();
  let middleware: ((req: IncomingMessage, res: ServerResponse, next: () => void) => void) | null = null;
  const mockServer = {
    middlewares: {
      use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => {
        middleware = fn;
      },
    },
  };
  (plugin.configureServer as (server: typeof mockServer) => void)(mockServer);
  return middleware!;
}

function encodeToken(payload: Record<string, unknown>): string {
  return `Bearer ${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
}

function mockReq(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    method: 'GET',
    url: '/api/fhir/bundles',
    headers: {
      authorization: encodeToken({ username: 'admin', role: 'admin' }),
    },
    ...overrides,
  } as unknown as IncomingMessage;
}

function mockRes(): ServerResponse & { _status: number; _body: string; _headers: Record<string, unknown> } {
  const res = {
    _status: 0,
    _body: '',
    _headers: {} as Record<string, unknown>,
    writeHead: vi.fn(function (this: { _status: number; _headers: Record<string, unknown> }, status: number, headers?: Record<string, unknown>) {
      this._status = status;
      if (headers) Object.assign(this._headers, headers);
    }),
    end: vi.fn(function (this: { _body: string }, data?: string | Buffer) {
      if (data) this._body = data.toString();
    }),
  };
  return res as unknown as ServerResponse & { _status: number; _body: string; _headers: Record<string, unknown> };
}

describe('fhirApiPlugin', () => {
  describe('GET /api/fhir/bundles', () => {
    it('returns 401 without auth', () => {
      const mw = getMiddleware();
      const req = mockReq({ headers: {} });
      const res = mockRes();
      const next = vi.fn();
      mw(req, res, next);
      expect(res._status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns bundles with valid auth', () => {
      const mw = getMiddleware();
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();
      mw(req, res, next);
      expect(res._status).toBe(200);
      expect(res._headers['Content-Type']).toBe('application/json');
      const body = JSON.parse(res._body);
      expect(body).toHaveProperty('bundles');
    });
  });

  describe('GET /api/fhir/images/:filename', () => {
    it('returns 401 without auth', () => {
      const mw = getMiddleware();
      const req = mockReq({ url: '/api/fhir/images/test.jpg', headers: {} });
      const res = mockRes();
      mw(req, res, vi.fn());
      expect(res._status).toBe(401);
    });

    it('returns 404 for non-existent file', () => {
      const mw = getMiddleware();
      const req = mockReq({ url: '/api/fhir/images/nonexistent.jpg' });
      const res = mockRes();
      mw(req, res, vi.fn());
      expect(res._status).toBe(404);
    });

    it('returns 400 for empty filename', () => {
      const mw = getMiddleware();
      const req = mockReq({ url: '/api/fhir/images/' });
      const res = mockRes();
      mw(req, res, vi.fn());
      expect(res._status).toBe(400);
    });
  });

  describe('non-matching routes', () => {
    it('calls next() for unrelated URLs', () => {
      const mw = getMiddleware();
      const req = mockReq({ url: '/some/other/path' });
      const res = mockRes();
      const next = vi.fn();
      mw(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
