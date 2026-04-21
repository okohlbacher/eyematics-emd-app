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
 * Authenticated fetch wrapper with global 401 interception.
 * On 401, clears the session and redirects to login.
 * Use this instead of raw fetch() for all authenticated API calls.
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const authHeaders = getAuthHeaders();
  // Capture at REQUEST time whether we had a session token.
  // A 401 on a request that was sent WITHOUT a token is expected (e.g. during
  // TOTP enrollment before the session is established) and must not trigger a
  // hard redirect — that would destroy the enrollment flow mid-flight.
  const sentWithToken = 'Authorization' in authHeaders;
  const headers = { ...authHeaders, ...(init?.headers as Record<string, string> ?? {}) };
  const resp = await fetch(input, { ...init, headers });

  if (resp.status === 401) {
    sessionStorage.removeItem('emd-token');
    if (sentWithToken && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  return resp;
}
