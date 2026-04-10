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
import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { readBody, validateAuth, sendError } from './utils';

const SETTINGS_FILE = path.resolve(process.cwd(), 'public', 'settings.yaml');

/**
 * Validate parsed YAML settings have the expected structure.
 * Returns an error message string if invalid, or null if valid.
 */
function validateSettingsSchema(parsed: unknown): string | null {
  if (parsed === null || typeof parsed !== 'object') {
    return 'Settings must be a YAML object';
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.twoFactorEnabled !== 'boolean') {
    return 'twoFactorEnabled must be a boolean';
  }
  if (typeof obj.therapyInterrupterDays !== 'number' || !Number.isFinite(obj.therapyInterrupterDays)) {
    return 'therapyInterrupterDays must be a number';
  }
  if (typeof obj.therapyBreakerDays !== 'number' || !Number.isFinite(obj.therapyBreakerDays)) {
    return 'therapyBreakerDays must be a number';
  }

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

  return null;
}

export function settingsApiHandler(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  // GET /api/settings — read settings.yaml (requires authenticated user)
  if (req.method === 'GET' && req.url === '/api/settings') {
    const user = validateAuth(req);
    if (!user) {
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
  if (req.method === 'PUT' && req.url === '/api/settings') {
    const authUser = validateAuth(req, 'admin');
    if (!authUser) {
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
          console.log(`[settings-api] Settings updated by ${authUser.username}`);
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
      server.middlewares.use(settingsApiHandler);
    },
  };
}
