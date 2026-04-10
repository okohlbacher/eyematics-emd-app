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
