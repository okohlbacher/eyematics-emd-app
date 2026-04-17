import crypto from 'node:crypto';

import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// keycloakAuth unit tests (uses real module — no mocking)
// ---------------------------------------------------------------------------
import { _resetForTesting,getAuthProvider, getJwksClient, initKeycloakAuth } from '../server/keycloakAuth.js';

describe('keycloakAuth module', () => {
  beforeEach(() => { _resetForTesting(); });

  it('defaults to local provider', () => {
    expect(getAuthProvider()).toBe('local');
  });

  it('getJwksClient returns null before init', () => {
    expect(getJwksClient()).toBeNull();
  });

  it('switches to keycloak after initKeycloakAuth', () => {
    initKeycloakAuth('https://auth.example.com/realms/emd');
    expect(getAuthProvider()).toBe('keycloak');
    expect(getJwksClient()).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// authMiddleware branching tests (uses vi.spyOn to control provider)
// ---------------------------------------------------------------------------

// Generate an RSA key pair once for all Keycloak RS256 tests
const { privateKey: rsaPrivateKey, publicKey: rsaPublicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// HS256 secret for local mode tests
const LOCAL_SECRET = 'test-local-secret-for-testing';

// ---------------------------------------------------------------------------
// Helpers to create mock req/res/next for Express middleware
// ---------------------------------------------------------------------------

function makeMockReq(overrides: Record<string, unknown> = {}) {
  return {
    originalUrl: '/api/data/something',
    headers: {},
    auth: undefined,
    ...overrides,
  } as unknown as import('express').Request;
}

function makeMockRes() {
  const res = {
    _statusCode: 200,
    _body: null as unknown,
    status(code: number) { res._statusCode = code; return res; },
    json(body: unknown) { res._body = body; return res; },
  };
  return res as unknown as import('express').Response & { _statusCode: number; _body: unknown };
}

// Helper: sign a local HS256 token
function signLocal(payload: object, opts: jwt.SignOptions = {}) {
  return jwt.sign(payload, LOCAL_SECRET, { algorithm: 'HS256', expiresIn: '10m', ...opts });
}

// Helper: sign a Keycloak RS256 token with kid header
function signKeycloak(payload: object, kid = 'test-key-id', opts: jwt.SignOptions = {}) {
  return jwt.sign(payload, rsaPrivateKey, { algorithm: 'RS256', keyid: kid, expiresIn: '10m', ...opts });
}

// Helper: create a mock JWKS client that returns the RSA public key
function makeMockJwksClient(throwErr?: Error) {
  return {
    getSigningKey: vi.fn(async (_kid: string) => {
      if (throwErr) throw throwErr;
      return { getPublicKey: () => rsaPublicKey };
    }),
  };
}

// Import the real keycloakAuth module (already imported above) and authMiddleware
// We use vi.spyOn to override getAuthProvider and getJwksClient per test
import { authMiddleware } from '../server/authMiddleware.js';
import * as initAuthModule from '../server/initAuth.js';
import * as keycloakAuthModule from '../server/keycloakAuth.js';

describe('authMiddleware branching', () => {
  let providerSpy: ReturnType<typeof vi.spyOn>;
  let clientSpy: ReturnType<typeof vi.spyOn>;
  let secretSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset keycloakAuth state
    _resetForTesting();

    // Spy on getAuthProvider and getJwksClient to control behavior
    providerSpy = vi.spyOn(keycloakAuthModule, 'getAuthProvider').mockReturnValue('local');
    clientSpy = vi.spyOn(keycloakAuthModule, 'getJwksClient').mockReturnValue(null);

    // Spy on getJwtSecret to return a test secret
    secretSpy = vi.spyOn(initAuthModule, 'getJwtSecret').mockReturnValue(LOCAL_SECRET);
  });

  afterEach(() => {
    providerSpy.mockRestore();
    clientSpy.mockRestore();
    secretSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // LOCAL mode (regression)
  // -------------------------------------------------------------------------

  it('local: valid HS256 token -> req.auth populated, next() called', async () => {
    providerSpy.mockReturnValue('local');

    const token = signLocal({
      sub: 'alice',
      preferred_username: 'alice',
      role: 'admin',
      centers: ['org-uka'],
    });

    const req = makeMockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.auth).toBeDefined();
    expect(req.auth!.preferred_username).toBe('alice');
    expect(req.auth!.role).toBe('admin');
  });

  it('local: invalid token -> 401', async () => {
    providerSpy.mockReturnValue('local');

    const req = makeMockReq({ headers: { authorization: 'Bearer not-a-valid-token' } });
    const res = makeMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._statusCode).toBe(401);
  });

  // -------------------------------------------------------------------------
  // KEYCLOAK mode
  // -------------------------------------------------------------------------

  it('keycloak: valid RS256 token with kid -> req.auth populated with normalized claims', async () => {
    const mockClient = makeMockJwksClient();
    providerSpy.mockReturnValue('keycloak');
    clientSpy.mockReturnValue(mockClient as never);

    const token = signKeycloak({
      sub: 'user-uuid-123',
      preferred_username: 'bob',
      role: 'researcher',
      centers: ['org-ukb'],
    });

    const req = makeMockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.auth).toBeDefined();
    expect(req.auth!.sub).toBe('user-uuid-123');
    expect(req.auth!.preferred_username).toBe('bob');
    expect(req.auth!.role).toBe('researcher');
    expect(req.auth!.centers).toEqual(['org-ukb']);
  });

  it('keycloak: token without kid -> 401 "Token missing key ID (kid)"', async () => {
    const mockClient = makeMockJwksClient();
    providerSpy.mockReturnValue('keycloak');
    clientSpy.mockReturnValue(mockClient as never);

    // Sign without keyid (no kid in header)
    const token = jwt.sign(
      { sub: 'user', preferred_username: 'user', role: 'admin', centers: [] },
      rsaPrivateKey,
      { algorithm: 'RS256' },
    );

    const req = makeMockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._statusCode).toBe(401);
    expect((res._body as { error: string }).error).toMatch(/kid/i);
  });

  it('keycloak: JWKS client null (not initialized) -> 503 "Keycloak auth not initialized"', async () => {
    providerSpy.mockReturnValue('keycloak');
    clientSpy.mockReturnValue(null);

    const token = signKeycloak({ sub: 'u', preferred_username: 'u', role: 'admin', centers: [] });
    const req = makeMockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._statusCode).toBe(503);
    expect((res._body as { error: string }).error).toMatch(/not initialized/i);
  });

  it('keycloak: getSigningKey throws ECONNREFUSED -> 503 "Keycloak is unreachable" (D-03)', async () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:8080');
    const mockClient = makeMockJwksClient(err);
    providerSpy.mockReturnValue('keycloak');
    clientSpy.mockReturnValue(mockClient as never);

    const token = signKeycloak({ sub: 'u', preferred_username: 'u', role: 'admin', centers: [] });
    const req = makeMockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._statusCode).toBe(503);
    expect((res._body as { error: string }).error).toMatch(/unreachable/i);
  });

  it('keycloak: jwt.verify fails (expired) -> 401', async () => {
    const mockClient = makeMockJwksClient();
    providerSpy.mockReturnValue('keycloak');
    clientSpy.mockReturnValue(mockClient as never);

    // Sign with past expiry (-1 second)
    const token = jwt.sign(
      { sub: 'u', preferred_username: 'u', role: 'admin', centers: [] },
      rsaPrivateKey,
      { algorithm: 'RS256', keyid: 'test-key-id', expiresIn: -1 },
    );

    const req = makeMockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._statusCode).toBe(401);
  });

  it('keycloak: role arrives as array ["admin"] -> normalized to string "admin"', async () => {
    const mockClient = makeMockJwksClient();
    providerSpy.mockReturnValue('keycloak');
    clientSpy.mockReturnValue(mockClient as never);

    const token = signKeycloak({
      sub: 'u',
      preferred_username: 'carol',
      role: ['admin'],
      centers: ['org-uka'],
    });

    const req = makeMockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.auth!.role).toBe('admin');
  });

  it('keycloak: centers arrives as single string "org-uka" -> normalized to array ["org-uka"]', async () => {
    const mockClient = makeMockJwksClient();
    providerSpy.mockReturnValue('keycloak');
    clientSpy.mockReturnValue(mockClient as never);

    const token = signKeycloak({
      sub: 'u',
      preferred_username: 'dave',
      role: 'researcher',
      centers: 'org-uka',
    });

    const req = makeMockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.auth!.centers).toEqual(['org-uka']);
  });

  it('keycloak: challenge-purpose token -> 401 rejected', async () => {
    const mockClient = makeMockJwksClient();
    providerSpy.mockReturnValue('keycloak');
    clientSpy.mockReturnValue(mockClient as never);

    const token = signKeycloak({
      sub: 'u',
      preferred_username: 'u',
      role: 'admin',
      centers: [],
      purpose: 'challenge',
    });

    const req = makeMockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._statusCode).toBe(401);
    expect((res._body as { error: string }).error).toMatch(/challenge/i);
  });
});
