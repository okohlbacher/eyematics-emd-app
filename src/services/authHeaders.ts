import { safeJsonParse } from '../utils/safeJson';

/**
 * Build Authorization header from the current session user.
 * Returns `{ Authorization: 'Bearer <base64>' }` if a user is logged in, or empty object.
 * The token is a base64-encoded JSON `{ username, role }`.
 */
export function getAuthHeaders(): Record<string, string> {
  const stored = sessionStorage.getItem('emd-user');
  if (stored) {
    const user = safeJsonParse<{ username?: string; role?: string } | null>(stored, null);
    if (user?.username && user?.role) {
      const token = btoa(JSON.stringify({ username: user.username, role: user.role }));
      return { Authorization: `Bearer ${token}` };
    }
  }
  return {};
}
