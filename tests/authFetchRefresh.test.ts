/**
 * @vitest-environment jsdom
 *
 * Tests for src/services/authHeaders.ts — silent refresh + single-flight + retry guard +
 * BroadcastChannel cross-tab coordination + CSRF double-submit.
 *
 * IMPORTANT: authHeaders.ts holds a module-level `refreshPromise` and a module-level
 * BroadcastChannel instance. Each test calls `vi.resetModules()` then dynamically imports
 * `../src/services/authHeaders` so the module-level state is fresh per test.
 */

import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

// ----- Mock infrastructure -----------------------------------------------------------

interface MockResponseInit { status?: number; body?: unknown }
function mockResp(init: MockResponseInit): Response {
  const status = init.status ?? 200;
  const body = init.body !== undefined ? JSON.stringify(init.body) : '{}';
  return new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
}

class MockBC {
  static instances: MockBC[] = [];
  listeners: Array<(e: MessageEvent) => void> = [];
  postMessage = vi.fn();
  addEventListener = (_type: string, fn: (e: MessageEvent) => void) => { this.listeners.push(fn); };
  removeEventListener = vi.fn();
  close = vi.fn();
  constructor(_name: string) { MockBC.instances.push(this); }
  static reset() { MockBC.instances = []; }
  /** Simulate receipt of a message from a sibling tab. */
  fire(data: unknown) {
    for (const fn of this.listeners) fn({ data } as MessageEvent);
  }
}

// Reset global cookie + sessionStorage between tests
function setCookie(value: string) {
  Object.defineProperty(document, 'cookie', {
    get: () => value,
    configurable: true,
  });
}

// Force the module to re-import with fresh module-level state.
async function loadModule() {
  vi.resetModules();
  return await import('../src/services/authHeaders');
}

beforeEach(() => {
  MockBC.reset();
  vi.stubGlobal('BroadcastChannel', MockBC);
  setCookie('emd-csrf=test-csrf-value');
  sessionStorage.clear();
  // Default fetch stub — overridden per test
  vi.stubGlobal('fetch', vi.fn());
  // Stub window.location.href setter
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...window.location,
      href: 'http://localhost/',
      pathname: '/',
      assign: vi.fn(),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('authFetch silent refresh', () => {
  it('Test 1 — silently refreshes on 401 and retries original request once', async () => {
    sessionStorage.setItem('emd-token', 'old-token');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockResp({ status: 401 })) // original 401
      .mockResolvedValueOnce(mockResp({ status: 200, body: { token: 'new-token', expiresAt: Date.now() + 600000 } })) // refresh OK
      .mockResolvedValueOnce(mockResp({ status: 200, body: { ok: true } })); // retry OK
    vi.stubGlobal('fetch', fetchMock);

    const { authFetch } = await loadModule();
    const resp = await authFetch('/api/x');

    expect(resp.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const refreshCalls = fetchMock.mock.calls.filter(([u]) => u === '/api/auth/refresh').length;
    expect(refreshCalls).toBe(1);
    expect(sessionStorage.getItem('emd-token')).toBe('new-token');
  });

  it('Test 2 — single-flight: 5 concurrent 401s trigger ONLY 1 refresh call', async () => {
    sessionStorage.setItem('emd-token', 'old-token');
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/auth/refresh') {
        return Promise.resolve(mockResp({ status: 200, body: { token: 'new', expiresAt: Date.now() + 600000 } }));
      }
      // Track call number per endpoint to differentiate first call vs retry
      // We'll use a per-url counter so original returns 401, retry returns 200
      const counter = (fetchMock as unknown as { _seen?: Record<string, number> })._seen ??= {};
      counter[url] = (counter[url] ?? 0) + 1;
      if (counter[url] === 1) return Promise.resolve(mockResp({ status: 401 }));
      return Promise.resolve(mockResp({ status: 200, body: { ok: true } }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { authFetch } = await loadModule();
    const results = await Promise.all([
      authFetch('/a'), authFetch('/b'), authFetch('/c'), authFetch('/d'), authFetch('/e'),
    ]);

    expect(results.every(r => r.status === 200)).toBe(true);
    const refreshCalls = fetchMock.mock.calls.filter(([u]: [string]) => u === '/api/auth/refresh').length;
    expect(refreshCalls).toBe(1);
  });

  it('Test 3 — retry guard: retried request returning 401 does NOT trigger second refresh', async () => {
    sessionStorage.setItem('emd-token', 'old-token');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockResp({ status: 401 }))
      .mockResolvedValueOnce(mockResp({ status: 200, body: { token: 'new', expiresAt: Date.now() + 600000 } }))
      .mockResolvedValueOnce(mockResp({ status: 401 })); // retry also 401
    vi.stubGlobal('fetch', fetchMock);

    const { authFetch } = await loadModule();
    const resp = await authFetch('/api/x');

    expect(resp.status).toBe(401);
    const refreshCalls = fetchMock.mock.calls.filter(([u]) => u === '/api/auth/refresh').length;
    expect(refreshCalls).toBe(1);
    expect(sessionStorage.getItem('emd-token')).toBeNull();
  });

  it('Test 4 — refresh failure: refresh 401 → no retry, falls through to logout', async () => {
    sessionStorage.setItem('emd-token', 'old-token');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockResp({ status: 401 })) // original
      .mockResolvedValueOnce(mockResp({ status: 401 })); // refresh also 401
    vi.stubGlobal('fetch', fetchMock);

    const { authFetch } = await loadModule();
    const resp = await authFetch('/api/x');

    expect(resp.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2); // no retry
    expect(sessionStorage.getItem('emd-token')).toBeNull();
  });

  it('Test 5 — CSRF header: refresh fetch includes X-CSRF-Token from emd-csrf cookie', async () => {
    setCookie('emd-csrf=my-csrf-hex');
    sessionStorage.setItem('emd-token', 'old-token');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockResp({ status: 401 }))
      .mockResolvedValueOnce(mockResp({ status: 200, body: { token: 'new', expiresAt: 1 } }))
      .mockResolvedValueOnce(mockResp({ status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { authFetch } = await loadModule();
    await authFetch('/api/x');

    const refreshCall = fetchMock.mock.calls.find(([u]) => u === '/api/auth/refresh');
    expect(refreshCall).toBeDefined();
    const init = refreshCall![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['X-CSRF-Token']).toBe('my-csrf-hex');
    expect(init.credentials).toBe('include');
    expect(init.method).toBe('POST');
  });

  it('Test 6 — BroadcastChannel: refresh-success message broadcast after successful refresh', async () => {
    sessionStorage.setItem('emd-token', 'old-token');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockResp({ status: 401 }))
      .mockResolvedValueOnce(mockResp({ status: 200, body: { token: 'newT', expiresAt: 4242 } }))
      .mockResolvedValueOnce(mockResp({ status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await loadModule().then(({ authFetch }) => authFetch('/api/x'));

    const bc = MockBC.instances[0];
    expect(bc.postMessage).toHaveBeenCalledWith({ type: 'refresh-success', token: 'newT', expiresAt: 4242 });
  });

  it('Test 7 — BroadcastChannel: sibling adopts refresh-success token into sessionStorage', async () => {
    await loadModule();
    const bc = MockBC.instances[0];
    bc.fire({ type: 'refresh-success', token: 'sibling-token', expiresAt: 99 });
    expect(sessionStorage.getItem('emd-token')).toBe('sibling-token');
  });

  it('Test 8 — BroadcastChannel: logout message clears sessionStorage and redirects', async () => {
    sessionStorage.setItem('emd-token', 'about-to-die');
    Object.defineProperty(window.location, 'pathname', { value: '/dashboard', configurable: true });
    await loadModule();
    const bc = MockBC.instances[0];
    bc.fire({ type: 'logout' });
    expect(sessionStorage.getItem('emd-token')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('Test 9 — refreshPromise reset on failure: next 401 CAN trigger another refresh', async () => {
    sessionStorage.setItem('emd-token', 'old-token');
    const fetchMock = vi.fn()
      // First authFetch: 401 → refresh fails → no retry
      .mockResolvedValueOnce(mockResp({ status: 401 }))
      .mockResolvedValueOnce(mockResp({ status: 401 }))
      // Second authFetch: 401 → refresh succeeds → retry succeeds
      .mockResolvedValueOnce(mockResp({ status: 401 }))
      .mockResolvedValueOnce(mockResp({ status: 200, body: { token: 'recovered', expiresAt: 1 } }))
      .mockResolvedValueOnce(mockResp({ status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { authFetch } = await loadModule();
    const r1 = await authFetch('/api/x');
    expect(r1.status).toBe(401);
    // Restore sessionStorage so authFetch attempts again with a fresh token
    sessionStorage.setItem('emd-token', 'second-attempt');
    const r2 = await authFetch('/api/y');
    expect(r2.status).toBe(200);

    const refreshCalls = fetchMock.mock.calls.filter(([u]) => u === '/api/auth/refresh').length;
    expect(refreshCalls).toBe(2);
  });

  it('Test 10 — non-401 responses do NOT trigger refresh', async () => {
    sessionStorage.setItem('emd-token', 'tok');
    const fetchMock = vi.fn().mockResolvedValue(mockResp({ status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { authFetch } = await loadModule();
    await authFetch('/api/x');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.find(([u]) => u === '/api/auth/refresh')).toBeUndefined();
  });
});
