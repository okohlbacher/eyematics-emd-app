/**
 * Shared auth header utility. Reads JWT from sessionStorage and returns
 * Authorization Bearer header for API requests.
 *
 * Replaces duplicate getAuthHeaders() implementations in issueService.ts
 * and settingsService.ts (D-16).
 *
 * JWT is stored under key 'emd-jwt' after successful login via /api/auth/login.
 */

const JWT_KEY = 'emd-jwt';

/**
 * Returns { Authorization: 'Bearer <jwt>' } if a JWT is present in sessionStorage,
 * or an empty object if not authenticated.
 */
export function getAuthHeaders(): Record<string, string> {
  try {
    const token = sessionStorage.getItem(JWT_KEY);
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  } catch {
    // sessionStorage unavailable (e.g. SSR or privacy mode)
    return {};
  }
}

/**
 * Store a JWT in sessionStorage after successful login.
 */
export function setJwt(token: string): void {
  sessionStorage.setItem(JWT_KEY, token);
}

/**
 * Remove the JWT from sessionStorage on logout.
 */
export function clearJwt(): void {
  sessionStorage.removeItem(JWT_KEY);
}
