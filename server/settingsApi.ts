/**
 * Settings API — Express Router + Vite dev plugin.
 * Settings are stored in config/settings.yaml (outside webroot).
 *
 * Endpoints:
 *   GET  /api/settings   — read current settings (authenticated users)
 *   PUT  /api/settings   — update settings (admin-only)
 *
 * H-01: Shared core logic between production Router and Vite plugin.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { readBody, validateAuth, sendError } from './utils.js';
import type {} from './authMiddleware.js'; // triggers Request.auth augmentation
import { invalidateFhirCache } from './fhirApi.js';
import { SETTINGS_FILE as SETTINGS_REL } from './constants.js';

const SETTINGS_FILE = path.resolve(process.cwd(), SETTINGS_REL);

// ---------------------------------------------------------------------------
// Shared core logic
// ---------------------------------------------------------------------------

function readSettings(): string {
  return fs.existsSync(SETTINGS_FILE) ? fs.readFileSync(SETTINGS_FILE, 'utf-8') : '';
}

function writeSettings(yamlBody: string, updatedBy: string): void {
  fs.writeFileSync(SETTINGS_FILE, yamlBody, 'utf-8');
  invalidateFhirCache();
  console.log(`[settings-api] Settings updated by ${updatedBy}`);
}

function validateSettingsSchema(parsed: unknown): string | null {
  if (parsed === null || typeof parsed !== 'object') return 'Settings must be a YAML object';
  const obj = parsed as Record<string, unknown>;
  // Auth fields (flat structure — F-10)
  if (typeof obj.twoFactorEnabled !== 'boolean') return 'twoFactorEnabled must be a boolean';
  if (obj.provider !== undefined && typeof obj.provider !== 'string') return 'provider must be a string';
  // Clinical thresholds
  if (typeof obj.therapyInterrupterDays !== 'number' || !Number.isFinite(obj.therapyInterrupterDays)) return 'therapyInterrupterDays must be a number';
  if (typeof obj.therapyBreakerDays !== 'number' || !Number.isFinite(obj.therapyBreakerDays)) return 'therapyBreakerDays must be a number';
  // Data source
  if (obj.dataSource === null || typeof obj.dataSource !== 'object') return 'dataSource must be an object';
  const ds = obj.dataSource as Record<string, unknown>;
  if (typeof ds.type !== 'string' || ds.type.length === 0) return 'dataSource.type must be a non-empty string';
  if (typeof ds.blazeUrl !== 'string' || ds.blazeUrl.length === 0) return 'dataSource.blazeUrl must be a non-empty string';
  return null;
}

function parseAndValidateYaml(body: string): { parsed: unknown; error?: string } {
  let parsed: unknown;
  try {
    parsed = yaml.load(body);
  } catch {
    return { parsed: null, error: 'Invalid YAML syntax' };
  }
  const schemaError = validateSettingsSchema(parsed);
  if (schemaError) return { parsed, error: schemaError };
  return { parsed };
}

// ---------------------------------------------------------------------------
// Express Router (production)
// ---------------------------------------------------------------------------

export const settingsApiRouter = Router();

settingsApiRouter.get('/', (_req: Request, res: Response): void => {
  try {
    res.setHeader('Content-Type', 'text/yaml');
    res.send(readSettings());
  } catch (err) {
    console.error('[settings-api] Failed to read settings:', err);
    res.status(500).json({ error: 'Failed to read settings' });
  }
});

settingsApiRouter.put('/', (req: Request, res: Response): void => {
  if (req.auth?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: admin role required' });
    return;
  }

  // Read raw body since content-type is text/yaml
  readBody(req as unknown as import('http').IncomingMessage)
    .then((body) => {
      const { error } = parseAndValidateYaml(body);
      if (error) {
        res.status(400).json({ error });
        return;
      }
      try {
        writeSettings(body, req.auth!.preferred_username);
        res.json({ ok: true });
      } catch (err) {
        console.error('[settings-api] Failed to write settings:', err);
        res.status(500).json({ error: 'Failed to write settings' });
      }
    })
    .catch((err) => {
      res.status(err instanceof Error && err.message.includes('too large') ? 413 : 500)
        .json({ error: err instanceof Error && err.message.includes('too large') ? 'Request body too large' : 'Failed to read request body' });
    });
});

// ---------------------------------------------------------------------------
// Vite dev plugin (reuses shared logic)
// ---------------------------------------------------------------------------

export function settingsApiPlugin(): Plugin {
  return {
    name: 'settings-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api/settings') return next();

        if (req.method === 'GET') {
          if (!validateAuth(req)) { sendError(res, 401, 'Authentication required'); return; }
          try {
            res.writeHead(200, { 'Content-Type': 'text/yaml' });
            res.end(readSettings());
          } catch (err) {
            sendError(res, 500, 'Failed to read settings', err);
          }
          return;
        }

        if (req.method === 'PUT') {
          const authUser = validateAuth(req, 'admin');
          if (!authUser) { sendError(res, 403, 'Forbidden: admin role required'); return; }

          readBody(req)
            .then((body) => {
              const { error } = parseAndValidateYaml(body);
              if (error) { sendError(res, 400, error); return; }
              try {
                writeSettings(body, authUser.username);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
              } catch (err) {
                sendError(res, 500, 'Failed to write settings', err);
              }
            })
            .catch((err) => {
              sendError(res, err instanceof Error && err.message.includes('too large') ? 413 : 500,
                err instanceof Error && err.message.includes('too large') ? 'Request body too large' : 'Failed to read request body', err);
            });
          return;
        }

        next();
      });
    },
  };
}
