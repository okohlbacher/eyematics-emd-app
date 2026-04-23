// @vitest-environment jsdom
/**
 * v1.9 Phase 21 Plan 03 — Session timer UAT automation.
 *
 * Automates the last two Phase 20 UAT items:
 *   - UAT-AUTO-04: 10-minute inactivity triggers auto-logout (client idle timer)
 *   - UAT-AUTO-05: refresh 401 "Session cap exceeded" clears session and redirects to /login
 *
 * Establishes the fake-timer pattern for the codebase per CONTEXT D-05/D-06:
 *   - vi.useFakeTimers({ toFake: [setTimeout, setInterval, clearTimeout, clearInterval, Date] })
 *   - afterEach vi.useRealTimers() — non-negotiable (D-06; leaks break downstream files)
 *
 * INACTIVITY_TIMEOUT is imported from AuthContext (Task 1 export) — no magic number.
 */

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, INACTIVITY_TIMEOUT, useAuth } from '../src/context/AuthContext';

// ---- Helpers ----------------------------------------------------------------

interface MockResponseInit { status?: number; body?: unknown }
function mockResp(init: MockResponseInit): Response {
  const status = init.status ?? 200;
  const body = init.body !== undefined ? JSON.stringify(init.body) : '{}';
  return new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
}

/**
 * Build a syntactically well-formed JWT. `userFromToken` only decodes (no signature
 * verification — server is authoritative), so any base64url payload is accepted.
 */
function buildTestJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fake-signature`;
}

/** Fresh module reload so module-level refreshPromise + BroadcastChannel are per-test. */
async function loadModule() {
  vi.resetModules();
  return await import('../src/services/authHeaders');
}

function Probe() {
  const { user } = useAuth();
  return <div data-testid="user">{user?.username ?? 'null'}</div>;
}

// ---- Global lifecycle -------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'],
  });
  vi.setSystemTime(new Date('2026-04-23T10:00:00Z'));
  sessionStorage.clear();
  sessionStorage.setItem(
    'emd-token',
    buildTestJwt({ sub: 'alice', preferred_username: 'alice', role: 'researcher', centers: [] }),
  );
  // AuthProvider fires fetch('/api/auth/users/me') on user hydrate — stub to resolve (RESEARCH Pitfall 4).
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(mockResp({
      status: 200,
      body: { user: { firstName: 'A', lastName: 'B', username: 'alice' } },
    }))),
  );
  // Normalize window.location so UAT-AUTO-05 href assertion is deterministic.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...window.location,
      href: 'http://localhost/',
      pathname: '/dashboard',
      assign: vi.fn(),
    },
  });
});

afterEach(() => {
  vi.useRealTimers(); // D-06 — non-negotiable
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

// ---- UAT-AUTO-04 ------------------------------------------------------------

describe('UAT-AUTO-04: idle-logout timer', () => {
  it('UAT-AUTO-04: 10-minute inactivity triggers auto-logout', async () => {
    const { getByTestId } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    // Flush microtasks so the users/me fetch resolves and user hydrates.
    await act(async () => {
      await Promise.resolve();
    });
    expect(getByTestId('user').textContent).toBe('alice');

    // Advance fake timers by INACTIVITY_TIMEOUT — the idle useEffect's setTimeout fires performLogout.
    act(() => {
      vi.advanceTimersByTime(INACTIVITY_TIMEOUT);
    });

    // performLogout synchronously removes the token from sessionStorage.
    expect(sessionStorage.getItem('emd-token')).toBeNull();
  });
});

// ---- UAT-AUTO-05 ------------------------------------------------------------

describe('UAT-AUTO-05: absolute-cap re-auth', () => {
  it("UAT-AUTO-05: refresh 401 'Session cap exceeded' clears session and redirects to /login", async () => {
    sessionStorage.setItem('emd-token', 'stale');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockResp({ status: 401 })) // original request
      .mockResolvedValueOnce(mockResp({ status: 401, body: { error: 'Session cap exceeded' } })); // refresh denial
    vi.stubGlobal('fetch', fetchMock);

    const { authFetch } = await loadModule();
    await authFetch('/api/x');

    expect(sessionStorage.getItem('emd-token')).toBeNull();
    expect(window.location.href).toBe('/login');
  });
});
