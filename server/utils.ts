/**
 * Shared utilities for Vite server plugins.
 */

/** Maximum request body size in bytes (10 MB). */
const MAX_BODY_SIZE = 10 * 1024 * 1024;

/**
 * Read the full request body with a size limit.
 * Rejects with a 413-appropriate error if the body exceeds MAX_BODY_SIZE.
 */
export function readBody(req: import('http').IncomingMessage, maxSize = MAX_BODY_SIZE): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxSize) {
        req.destroy();
        reject(new Error(`Request body too large (max ${maxSize} bytes)`));
        return;
      }
      data += chunk.toString();
    });
    req.on('end', () => {
      // H-07: Expose captured body for auditMiddleware to log mutation details
      (req as unknown as Record<string, unknown>)._capturedBody = data;
      resolve(data);
    });
    req.on('error', reject);
  });
}

/**
 * Validate a Bearer token from the Authorization header.
 * Returns the decoded user object if valid, or null.
 *
 * Expected format: `Authorization: Bearer <base64(JSON({ username, role }))>`
 *
 * IMPORTANT: This validates the token against a known user list for the demonstrator.
 * In production, use signed JWTs or server-side sessions.
 */
export function validateAuth(
  req: import('http').IncomingMessage,
  requiredRole?: string,
): { username: string; role: string } | null {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.slice(7);
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    if (!decoded || typeof decoded.username !== 'string' || typeof decoded.role !== 'string') {
      return null;
    }
    // Validate username AND role against the known demonstrator user list
    const knownUser = KNOWN_USERS[decoded.username.toLowerCase()];
    if (!knownUser) {
      return null;
    }
    // Verify the claimed role matches the actual role — prevents role forgery
    if (decoded.role !== knownUser.role) {
      return null;
    }
    if (requiredRole && decoded.role !== requiredRole) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/** Known users with their roles for token validation (must match AuthContext defaults). */
const KNOWN_USERS: Record<string, { role: string }> = {
  admin:        { role: 'admin' },
  forscher1:    { role: 'researcher' },
  forscher2:    { role: 'researcher' },
  epidemiologe: { role: 'epidemiologist' },
  kliniker:     { role: 'clinician' },
  diz_manager:  { role: 'data_manager' },
  klinikleitung:{ role: 'clinic_lead' },
};

/**
 * Send a JSON error response with a generic message.
 * Logs the detailed error server-side only.
 */
export function sendError(
  res: import('http').ServerResponse,
  status: number,
  publicMessage: string,
  internalError?: unknown,
): void {
  if (internalError) {
    console.error(`[server] ${publicMessage}:`, internalError);
  }
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: publicMessage }));
}
