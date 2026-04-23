/**
 * Phase 20 / D-02, D-09..D-12: client-side refresh state machine.
 *
 * - Single-flight refreshPromise dedupes concurrent 401s within a tab (D-11, Pattern 1).
 * - Retry-guard header X-EMD-Retry-After-Refresh prevents refresh loops (D-10).
 * - BroadcastChannel('emd-auth') coordinates across tabs (D-12, Pattern 3):
 *     * 'refresh-success' → sibling tabs adopt new access token from sessionStorage.
 *     * 'logout'          → sibling tabs clear sessionStorage and redirect to /login.
 * - getCsrfFromCookie reads non-httpOnly emd-csrf cookie for double-submit (D-14).
 * - refreshPromise resets in `finally` so a failed refresh never permanently blocks the tab.
 */

const RETRY_GUARD_HEADER = 'X-EMD-Retry-After-Refresh';
const REFRESH_URL = '/api/auth/refresh';

// Module-level state — shared across all authFetch callers in this tab.
let refreshPromise: Promise<string> | null = null;

// BroadcastChannel — null in non-browser test environments lacking the global.
const bc: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('emd-auth') : null;

bc?.addEventListener('message', (e: MessageEvent) => {
  const msg = e.data as { type?: string; token?: string } | null | undefined;
  if (!msg || typeof msg.type !== 'string') return;
  if (msg.type === 'refresh-success' && typeof msg.token === 'string') {
    sessionStorage.setItem('emd-token', msg.token);
  } else if (msg.type === 'logout') {
    sessionStorage.removeItem('emd-token');
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }
});

function getCsrfFromCookie(): string {
  if (typeof document === 'undefined') return '';
  const match = /(?:^|;\s*)emd-csrf=([^;]+)/.exec(document.cookie);
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Build Authorization header from the stored JWT session token.
 * Returns { Authorization: 'Bearer <jwt>' } if a token exists, or empty object.
 */
export function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('emd-token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * Broadcast a logout to sibling tabs (consumed by AuthContext.logout).
 * Same-origin browsers receive the {type:'logout'} message and clear their own session.
 */
export function broadcastLogout(): void {
  bc?.postMessage({ type: 'logout' });
}

/**
 * Server-side logout: notify the server to clear the refresh + CSRF cookies and bump
 * the user's tokenVersion (invalidates all outstanding refresh tokens for this user).
 *
 * Network or non-OK responses are SWALLOWED: the caller MUST proceed to clear local
 * state regardless. A failed network request must never trap the user in a half-logged-in
 * state (T-20-28 mitigation).
 *
 * Extracted from AuthContext.logout so it can be unit-tested without mounting an
 * AuthProvider RTL harness.
 */
export async function serverLogout(): Promise<void> {
  try {
    const csrf = getCsrfFromCookie();
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...getAuthHeaders(),
        'X-CSRF-Token': csrf,
      },
    });
  } catch {
    // Intentional swallow — see contract above.
  }
}

/**
 * Single-flight refresh. Concurrent 401 callers `await` the same in-flight promise so
 * only one POST /api/auth/refresh is sent per tab even under refresh storms.
 *
 * On success: writes new access token to sessionStorage and broadcasts to sibling tabs.
 * On failure: throws, with refreshPromise reset so the next 401 can attempt again.
 */
export async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const csrf = getCsrfFromCookie();
      const resp = await fetch(REFRESH_URL, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrf },
      });
      if (!resp.ok) throw new Error(`refresh_failed_${resp.status}`);
      const data = await resp.json() as { token: string; expiresAt: number };
      sessionStorage.setItem('emd-token', data.token);
      bc?.postMessage({ type: 'refresh-success', token: data.token, expiresAt: data.expiresAt });
      return data.token;
    } finally {
      // CRITICAL (anti-pattern guard): reset on BOTH success and failure to avoid
      // permanently blocking the tab after a transient failure.
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

function handleAuthFailure(): void {
  sessionStorage.removeItem('emd-token');
  bc?.postMessage({ type: 'logout' });
  if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
}

/**
 * Authenticated fetch wrapper with silent refresh on 401.
 *
 * Flow:
 *   1. Send request with current access token.
 *   2. If 200 (or any non-401), return as-is.
 *   3. If 401 and request was NOT already a retry → call refreshAccessToken() under
 *      single-flight lock, then retry the original request EXACTLY ONCE with the new
 *      token + the X-EMD-Retry-After-Refresh guard header.
 *   4. If retry returns 401 (caller sees the guard header) → fall through to logout.
 *   5. If refresh itself fails → fall through to logout.
 *
 * Use this instead of raw fetch() for all authenticated API calls.
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const baseHeaders = (init?.headers ?? {}) as Record<string, string>;
  const headers = { ...getAuthHeaders(), ...baseHeaders };
  const resp = await fetch(input, { ...init, headers });

  if (resp.status !== 401) return resp;

  // Already a retry → do NOT refresh again (D-10 retry guard).
  if (baseHeaders[RETRY_GUARD_HEADER]) {
    handleAuthFailure();
    return resp;
  }

  // First 401 → attempt single-flight refresh.
  try {
    const newToken = await refreshAccessToken();
    const retryHeaders = {
      ...baseHeaders,
      Authorization: `Bearer ${newToken}`,
      [RETRY_GUARD_HEADER]: '1',
    };
    const retryResp = await fetch(input, { ...init, headers: retryHeaders });
    if (retryResp.status === 401) {
      // Retried request still 401 — refresh succeeded but the new access token is also rejected.
      // Fall through to logout (D-10 retry guard semantics).
      handleAuthFailure();
    }
    return retryResp;
  } catch {
    handleAuthFailure();
    return resp;
  }
}
