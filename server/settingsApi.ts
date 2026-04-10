/**
 * Vite server plugin that provides a REST API for server-side settings persistence.
 * Settings are stored in `public/settings.yaml`.
 *
 * Endpoints:
 *   GET  /api/settings   — read current settings from settings.yaml (authenticated users)
 *   PUT  /api/settings   — update settings and write back to settings.yaml (admin-only)
 *
 * Authorization:
 *   GET requests require any authenticated user.
 *   PUT requests require an admin role.
 */

import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { readBody, sendError } from './utils';

const SETTINGS_FILE = path.resolve(process.cwd(), 'public', 'settings.yaml');

/**
 * Validate parsed YAML settings have the expected structure.
 * Returns an error message string if invalid, or null if valid.
 *
 * Validates the canonical nested auth section structure that getAuthConfig()
 * in server/initAuth.ts consumes. Exported for direct use in unit tests (D-05).
 *
 * Note: jwtSecret is NOT validated here — it lives in data/jwt-secret.txt,
 * not in settings.yaml (per RESEARCH.md pitfall 4).
 */
export function validateSettingsSchema(parsed: unknown): string | null {
  if (parsed === null || typeof parsed !== 'object') {
    return 'Settings must be a YAML object';
  }

  const obj = parsed as Record<string, unknown>;

  // Top-level numeric fields
  if (typeof obj.therapyInterrupterDays !== 'number' || !Number.isFinite(obj.therapyInterrupterDays)) {
    return 'therapyInterrupterDays must be a number';
  }
  if (typeof obj.therapyBreakerDays !== 'number' || !Number.isFinite(obj.therapyBreakerDays)) {
    return 'therapyBreakerDays must be a number';
  }

  // dataSource section
  if (obj.dataSource === null || typeof obj.dataSource !== 'object') {
    return 'dataSource must be an object';
  }
  const ds = obj.dataSource as Record<string, unknown>;
  if (typeof ds.type !== 'string' || ds.type.length === 0) {
    return 'dataSource.type must be a non-empty string';
  }
  if (typeof ds.blazeUrl !== 'string' || ds.blazeUrl.length === 0) {
    return 'dataSource.blazeUrl must be a non-empty string';
  }

  // auth section (canonical nested structure — per D-03)
  // Matches what getAuthConfig() in server/initAuth.ts reads from settings.yaml
  if (obj.auth === null || typeof obj.auth !== 'object') {
    return 'auth must be an object';
  }
  const auth = obj.auth as Record<string, unknown>;
  if (typeof auth.twoFactorEnabled !== 'boolean') {
    return 'auth.twoFactorEnabled must be a boolean';
  }
  if (typeof auth.maxLoginAttempts !== 'number' || !Number.isInteger(auth.maxLoginAttempts) || auth.maxLoginAttempts < 1) {
    return 'auth.maxLoginAttempts must be a positive integer';
  }
  // otpCode is optional (defaults to '123456' in initAuth.ts)
  if (auth.otpCode !== undefined && typeof auth.otpCode !== 'string') {
    return 'auth.otpCode must be a string if provided';
  }

  return null;
}

/**
 * Express/Node http middleware handler for settings API routes.
 *
 * Used by the production Express server (server/index.ts).
 * Auth is guaranteed by authMiddleware (mounted before this handler) — no
 * need to call validateAuth() here. Role checks use (req as any).auth.
 */
export function settingsApiHandler(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  next: () => void,
): void {
  // GET /api/settings — read settings.yaml (auth guaranteed by middleware)
  if (req.method === 'GET' && req.url === '/api/settings') {
    try {
      const content = fs.existsSync(SETTINGS_FILE)
        ? fs.readFileSync(SETTINGS_FILE, 'utf-8')
        : '';
      res.writeHead(200, { 'Content-Type': 'text/yaml' });
      res.end(content);
    } catch (err) {
      sendError(res, 500, 'Failed to read settings', err);
    }
    return;
  }

  // PUT /api/settings — write settings.yaml (admin-only)
  if (req.method === 'PUT' && req.url === '/api/settings') {
    const auth = (req as unknown as Record<string, unknown>).auth as { role?: string; preferred_username?: string } | undefined;
    if (auth?.role !== 'admin') {
      sendError(res, 403, 'Forbidden: admin role required');
      return;
    }

    readBody(req)
      .then((body) => {
        // Validate YAML syntax
        let parsed: unknown;
        try {
          parsed = yaml.load(body);
        } catch (yamlErr) {
          sendError(res, 400, 'Invalid YAML syntax', yamlErr);
          return;
        }

        // Validate schema
        const schemaError = validateSettingsSchema(parsed);
        if (schemaError) {
          sendError(res, 400, schemaError);
          return;
        }

        try {
          fs.writeFileSync(SETTINGS_FILE, body, 'utf-8');
          console.log(`[settings-api] Settings updated by ${auth.preferred_username ?? 'unknown'}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          sendError(res, 500, 'Failed to write settings', err);
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.message.includes('too large')) {
          sendError(res, 413, 'Request body too large');
        } else {
          sendError(res, 500, 'Failed to read request body', err);
        }
      });
    return;
  }

  next();
}

export function settingsApiPlugin(): Plugin {
  return {
    name: 'settings-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // GET /api/settings — read settings.yaml (requires auth token present)
        if (req.method === 'GET' && req.url === '/api/settings') {
          const authHeader = req.headers['authorization'];
          if (!authHeader?.startsWith('Bearer ')) {
            sendError(res, 401, 'Authentication required');
            return;
          }

          try {
            const content = fs.existsSync(SETTINGS_FILE)
              ? fs.readFileSync(SETTINGS_FILE, 'utf-8')
              : '';
            res.writeHead(200, { 'Content-Type': 'text/yaml' });
            res.end(content);
          } catch (err) {
            sendError(res, 500, 'Failed to read settings', err);
          }
          return;
        }

        // PUT /api/settings — write settings.yaml (admin-only)
        // In dev mode, check for admin Bearer token (base64 JSON with role=admin)
        if (req.method === 'PUT' && req.url === '/api/settings') {
          const authHeader = req.headers['authorization'];
          let adminUsername: string | null = null;
          if (authHeader?.startsWith('Bearer ')) {
            try {
              const decoded = JSON.parse(Buffer.from(authHeader.slice(7), 'base64').toString('utf-8'));
              if (decoded?.role === 'admin') {
                adminUsername = decoded.username ?? 'unknown';
              }
            } catch { /* invalid token */ }
          }
          if (!adminUsername) {
            sendError(res, 403, 'Forbidden: admin role required');
            return;
          }

          readBody(req)
            .then((body) => {
              // Validate YAML syntax
              let parsed: unknown;
              try {
                parsed = yaml.load(body);
              } catch (yamlErr) {
                sendError(res, 400, 'Invalid YAML syntax', yamlErr);
                return;
              }

              // Validate schema
              const schemaError = validateSettingsSchema(parsed);
              if (schemaError) {
                sendError(res, 400, schemaError);
                return;
              }

              try {
                fs.writeFileSync(SETTINGS_FILE, body, 'utf-8');
                console.log(`[settings-api] Settings updated by ${adminUsername}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
              } catch (err) {
                sendError(res, 500, 'Failed to write settings', err);
              }
            })
            .catch((err) => {
              if (err instanceof Error && err.message.includes('too large')) {
                sendError(res, 413, 'Request body too large');
              } else {
                sendError(res, 500, 'Failed to read request body', err);
              }
            });
          return;
        }

        next();
      });
    },
  };
}
