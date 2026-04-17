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
  const headers = { ...getAuthHeaders(), ...(init?.headers as Record<string, string> ?? {}) };
  const resp = await fetch(input, { ...init, headers });

  if (resp.status === 401) {
    sessionStorage.removeItem('emd-token');
    // Only redirect if not already on the login page
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  return resp;
}
