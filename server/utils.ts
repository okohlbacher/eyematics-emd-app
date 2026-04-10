/**
 * Shared utilities for Vite server plugins and Express handlers.
 *
 * NOTE (AUTH-08): validateAuth() and KNOWN_USERS have been removed.
 * Authentication is now handled by server/authMiddleware.ts (JWT validation)
 * and server/authApi.ts. All /api/* routes are protected by authMiddleware
 * mounted in server/index.ts before any route handlers.
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
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

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
