// @vitest-environment jsdom
/**
 * v1.9 Phase 21 / Plan 21-02 — Automation of Phase 20 UAT items 1-3.
 *
 * Replaces three manual UAT checks with CI-enforced tests:
 *   UAT-AUTO-01: silent refresh — authFetch on 401 refreshes once and retries original.
 *   UAT-AUTO-02: two-tab single-flight — non-poster tab receives refresh-success
 *                via the global BroadcastChannel shim (tests/setup.ts, D-03).
 *   UAT-AUTO-03: audit-silence contract — SKIP_AUDIT_IF_STATUS skips 200 refresh,
 *                audits 401/403 (T-20-19 DoS guard + T-20-21 repudiation guard).
 *
 * Threat model anchors:
 *   - T-20-19: audit-log DoS via ~80 refreshes/user/12h — silenced 200 prevents flood.
 *   - T-20-21: repudiation — failed refresh attacks MUST remain audited.
 *   - T-20-23: session-resilience single-flight lock must not allow per-tab storm.
 *
 * Design decisions (per 21-02-PLAN.md + 21-RESEARCH.md):
 *   - MockBC scoped to authFetchRefresh.test.ts retained per Assumption A2 (per-file
 *     vi.stubGlobal overrides the global shim for that file).
 *   - UAT-AUTO-03 uses a direct unit import per D-09 minimal-scoped source fix.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SKIP_AUDIT_IF_STATUS } from '../server/auditMiddleware';
import { MockBroadcastChannel } from './setup';

// ----- Helpers (reused verbatim from tests/authFetchRefresh.test.ts) -----

interface MockResponseInit { status?: number; body?: unknown }
function mockResp(init: MockResponseInit): Response {
  const status = init.status ?? 200;
  const body = init.body !== undefined ? JSON.stringify(init.body) : '{}';
  return new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
}

function setCookie(value: string) {
  Object.defineProperty(document, 'cookie', {
    get: () => value,
    configurable: true,
  });
}

async function loadModule() {
  vi.resetModules();
  return await import('../src/services/authHeaders');
}

// ----- Per-test setup — CLEANS global shim registry between tests via tests/setup.ts beforeEach -----

beforeEach(() => {
  // Node 18+ ships a native BroadcastChannel that does NOT deliver messages
  // synchronously across sibling instances in the same process. Force-stub with
  // the Map-backed shim so two in-process "tabs" see each other's posts.
  // (The setup.ts install-guard `typeof BC === 'undefined'` is bypassed by Node
  // native BC; per-file vi.stubGlobal wins — RESEARCH Assumption A2 pattern.)
  MockBroadcastChannel._reset();
  vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
  setCookie('emd-csrf=test-csrf-value');
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
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

describe('authFetchRefreshSuite — Phase 20 UAT automation (UAT-AUTO-01/02/03)', () => {
  it('UAT-AUTO-01: silent refresh — 401 triggers refresh and retries original request once', async () => {
    sessionStorage.setItem('emd-token', 'old-token');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockResp({ status: 401 }))
      .mockResolvedValueOnce(mockResp({ status: 200, body: { token: 'new-token', expiresAt: Date.now() + 600000 } }))
      .mockResolvedValueOnce(mockResp({ status: 200, body: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    const { authFetch } = await loadModule();
    const resp = await authFetch('/api/x');

    expect(resp.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const refreshCalls = fetchMock.mock.calls.filter(([u]) => u === '/api/auth/refresh').length;
    expect(refreshCalls).toBe(1);
    expect(sessionStorage.getItem('emd-token')).toBe('new-token');
  });

  it('UAT-AUTO-02: two tabs — single-flight refresh; non-poster tab receives refresh-success broadcast', async () => {
    // Tab B: passive listener opened BEFORE tab A triggers the refresh.
    // Uses the global BroadcastChannel shim (tests/setup.ts) which posts cross-instance
    // within the same process — matching MDN single-origin semantics (never to self).
    const tabBChannel = new BroadcastChannel('emd-auth');
    let tabBToken: string | null = null;
    let tabBMessages = 0;
    tabBChannel.addEventListener('message', (e: MessageEvent) => {
      const msg = (e as MessageEvent<{ type?: string; token?: string }>).data;
      tabBMessages += 1;
      if (msg?.type === 'refresh-success' && typeof msg.token === 'string') {
        tabBToken = msg.token;
      }
    });

    try {
      sessionStorage.setItem('emd-token', 'old-token');
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(mockResp({ status: 401 }))
        .mockResolvedValueOnce(mockResp({ status: 200, body: { token: 'fresh', expiresAt: Date.now() + 600000 } }))
        .mockResolvedValueOnce(mockResp({ status: 200, body: { ok: true } }));
      vi.stubGlobal('fetch', fetchMock);

      const tabA = await loadModule();
      const resp = await tabA.authFetch('/api/x');
      expect(resp.status).toBe(200);

      // Single-flight lock: exactly one refresh call despite two channel participants.
      const refreshCalls = fetchMock.mock.calls.filter(([u]) => u === '/api/auth/refresh').length;
      expect(refreshCalls).toBe(1);

      // Non-poster tab B received the refresh-success broadcast with the new token.
      expect(tabBMessages).toBeGreaterThanOrEqual(1);
      expect(tabBToken).toBe('fresh');
    } finally {
      tabBChannel.close();
    }
  });

  it('UAT-AUTO-03: auditMiddleware SKIP_AUDIT_IF_STATUS skips /api/auth/refresh 200 but audits 401', () => {
    // Audit-silence contract (T-20-19 DoS mitigation + T-20-21 repudiation guard):
    //   - 200 refresh: silenced (high-volume background event would flood audit log).
    //   - 401/403 refresh: NOT silenced (failed refresh attacks MUST remain visible).
    expect(SKIP_AUDIT_IF_STATUS['/api/auth/refresh']).toBeInstanceOf(Set);
    expect(SKIP_AUDIT_IF_STATUS['/api/auth/refresh'].has(200)).toBe(true);
    expect(SKIP_AUDIT_IF_STATUS['/api/auth/refresh'].has(401)).toBe(false);
    expect(SKIP_AUDIT_IF_STATUS['/api/auth/refresh'].has(403)).toBe(false);
  });
});
