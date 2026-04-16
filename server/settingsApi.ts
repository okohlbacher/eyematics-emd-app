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

import fs from 'node:fs';

import type { Request, Response } from 'express';
import { Router } from 'express';
import yaml from 'js-yaml';
import type { Plugin } from 'vite';

import type {} from './authMiddleware.js'; // triggers Request.auth augmentation
import { SETTINGS_FILE } from './constants.js';
import { invalidateFhirCache } from './fhirApi.js';
import { updateAuthConfig } from './initAuth.js';
import { readBody, sendError,validateAuth } from './utils.js';

// ---------------------------------------------------------------------------
// Shared core logic
// ---------------------------------------------------------------------------

function readSettings(): string {
  return fs.existsSync(SETTINGS_FILE) ? fs.readFileSync(SETTINGS_FILE, 'utf-8') : '';
}

/**
 * IN-05: Strip `cohortHashSecret` from the audit sub-object for non-admin GETs.
 * Returns the remaining audit fields (e.g. retentionDays) or undefined if the
 * object is empty / not an object at all. Pure helper; no side effects.
 */
function stripSensitiveAudit(audit: unknown): Record<string, unknown> | undefined {
  if (!audit || typeof audit !== 'object') return undefined;
  const { cohortHashSecret: _c, ...rest } = audit as Record<string, unknown>;
  return Object.keys(rest).length > 0 ? rest : undefined;
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
  if (obj.provider !== undefined && !['local', 'keycloak'].includes(obj.provider as string)) return "provider must be 'local' or 'keycloak'";
  // Clinical thresholds
  if (typeof obj.therapyInterrupterDays !== 'number' || !Number.isFinite(obj.therapyInterrupterDays)) return 'therapyInterrupterDays must be a number';
  if (typeof obj.therapyBreakerDays !== 'number' || !Number.isFinite(obj.therapyBreakerDays)) return 'therapyBreakerDays must be a number';
  // Data source
  if (obj.dataSource === null || typeof obj.dataSource !== 'object') return 'dataSource must be an object';
  const ds = obj.dataSource as Record<string, unknown>;
  if (typeof ds.type !== 'string' || !['local', 'blaze'].includes(ds.type)) return "dataSource.type must be 'local' or 'blaze'";
  if (typeof ds.blazeUrl !== 'string' || ds.blazeUrl.length === 0) return 'dataSource.blazeUrl must be a non-empty string';
  // Phase 12 / D-11 — optional outcomes section
  if (obj.outcomes !== undefined) {
    if (obj.outcomes === null || typeof obj.outcomes !== 'object') return 'outcomes must be an object';
    const out = obj.outcomes as Record<string, unknown>;
    if (out.serverAggregationThresholdPatients !== undefined) {
      if (typeof out.serverAggregationThresholdPatients !== 'number' || !Number.isFinite(out.serverAggregationThresholdPatients) || out.serverAggregationThresholdPatients < 1) {
        return 'outcomes.serverAggregationThresholdPatients must be a positive number';
      }
    }
    if (out.aggregateCacheTtlMs !== undefined) {
      if (typeof out.aggregateCacheTtlMs !== 'number' || !Number.isFinite(out.aggregateCacheTtlMs) || out.aggregateCacheTtlMs < 0) {
        return 'outcomes.aggregateCacheTtlMs must be a non-negative number';
      }
    }
  }
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

settingsApiRouter.get('/', (req: Request, res: Response): void => {
  try {
    const raw = readSettings();
    // F-12: strip sensitive fields for non-admin users
    if (req.auth?.role !== 'admin') {
      const parsed = yaml.load(raw) as Record<string, unknown> | null;
      if (parsed && typeof parsed === 'object') {
        const { otpCode: _o, maxLoginAttempts: _m, provider: _p, audit: rawAudit, ...safe } = parsed;
        // IN-05: preserve other audit fields (e.g. retentionDays) via a single helper.
        const safeAudit = stripSensitiveAudit(rawAudit);
        if (safeAudit) {
          (safe as Record<string, unknown>).audit = safeAudit;
        }
        res.setHeader('Content-Type', 'text/yaml');
        res.send(yaml.dump(safe));
        return;
      }
    }
    res.setHeader('Content-Type', 'text/yaml');
    res.send(raw);
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

  // F-08: body parsed by express.text() middleware mounted in index.ts
  const body = typeof req.body === 'string' ? req.body : '';
  if (!body) {
    res.status(400).json({ error: 'Empty request body' });
    return;
  }

  const { parsed, error } = parseAndValidateYaml(body);
  if (error) {
    res.status(400).json({ error });
    return;
  }
  try {
    writeSettings(body, req.auth!.preferred_username);
    updateAuthConfig(parsed as Record<string, unknown>);
    res.json({ ok: true });
  } catch (err) {
    console.error('[settings-api] Failed to write settings:', err);
    res.status(500).json({ error: 'Failed to write settings' });
  }
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
          // F-33: Vite plugin must explicitly check auth since production authMiddleware is not mounted in dev
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
              const { parsed: parsedSettings, error } = parseAndValidateYaml(body);
              if (error) { sendError(res, 400, error); return; }
              try {
                writeSettings(body, authUser.username);
                updateAuthConfig(parsedSettings as Record<string, unknown>);
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
