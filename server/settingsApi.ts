/**
 * Settings API — Express Router.
 * Settings are stored in config/settings.yaml (outside webroot).
 *
 * Endpoints:
 *   GET  /api/settings                      — read current settings (authenticated users)
 *   PUT  /api/settings                      — update settings (admin-only)
 *   GET  /api/settings/fhir-connection-test — test FHIR server connectivity (admin-only)
 */

import fs from 'node:fs';

import type { Request, Response } from 'express';
import { Router } from 'express';
import yaml from 'js-yaml';

import type {} from './authMiddleware.js'; // triggers Request.auth augmentation
import { SETTINGS_FILE } from './constants.js';
import { invalidateFhirCache } from './fhirApi.js';
import { initHashCohortId } from './hashCohortId.js';
import { updateAuthConfig } from './initAuth.js';
import { initOutcomesAggregateCache, invalidateAllAggregates } from './outcomesAggregateCache.js';

// M4: DATA_DIR is required to re-init the cohort-hash secret (file-based path).
// Captured at server boot via configureSettingsApi so the PUT handler can pass
// it through to initHashCohortId without reading it from settings on every call.
let _dataDir: string | null = null;
export function configureSettingsApi(dataDir: string): void {
  _dataDir = dataDir;
}

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
  // Phase 20 / D-23, D-24 — optional auth namespace (refresh-token configuration)
  if (obj.auth !== undefined) {
    if (obj.auth === null || typeof obj.auth !== 'object') return 'auth must be an object';
    const auth = obj.auth as Record<string, unknown>;
    const ttl = auth.refreshTokenTtlMs;
    const cap = auth.refreshAbsoluteCapMs;
    if (ttl !== undefined && (typeof ttl !== 'number' || !Number.isInteger(ttl) || ttl <= 0)) {
      return 'auth.refreshTokenTtlMs must be a positive integer';
    }
    if (cap !== undefined && (typeof cap !== 'number' || !Number.isInteger(cap) || cap <= 0)) {
      return 'auth.refreshAbsoluteCapMs must be a positive integer';
    }
    if (typeof ttl === 'number' && typeof cap === 'number' && ttl > cap) {
      return 'auth.refreshTokenTtlMs must be <= auth.refreshAbsoluteCapMs';
    }
    if (auth.refreshCookieSecure !== undefined && typeof auth.refreshCookieSecure !== 'boolean') {
      return 'auth.refreshCookieSecure must be a boolean';
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Phase 20 / D-23 — auth settings reader for refresh endpoint
// ---------------------------------------------------------------------------

export interface AuthSettings {
  refreshTokenTtlMs: number;
  refreshAbsoluteCapMs: number;
  refreshCookieSecure: boolean;
}

const AUTH_DEFAULTS: AuthSettings = {
  refreshTokenTtlMs: 28_800_000,   // 8h
  refreshAbsoluteCapMs: 43_200_000, // 12h
  refreshCookieSecure: true,
};

/**
 * Reads `auth.*` from settings.yaml at call time (NOT boot-cached) so an
 * operator edit + reload picks up new values without restarting the server.
 * Returns AUTH_DEFAULTS for any missing field, including when settings.yaml
 * is unreadable.
 */
export function getAuthSettings(): AuthSettings {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const parsed = yaml.load(raw) as { auth?: Partial<AuthSettings> } | null;
    return { ...AUTH_DEFAULTS, ...(parsed?.auth ?? {}) };
  } catch {
    return AUTH_DEFAULTS;
  }
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
    const parsedObj = parsed as Record<string, unknown>;
    updateAuthConfig(parsedObj);
    // M4: refresh cohort-hash secret (honors a rotated settings.audit.cohortHashSecret
    // or a newly dropped-in data/cohort-hash-secret.txt) and re-read the aggregate
    // cache TTL. Drop all cached aggregates so responses can't outlive the config
    // snapshot they were computed under — cheap because the cache is small.
    if (_dataDir) initHashCohortId(parsedObj, _dataDir);
    initOutcomesAggregateCache(parsedObj);
    invalidateAllAggregates();
    res.json({ ok: true });
  } catch (err) {
    console.error('[settings-api] Failed to write settings:', err);
    res.status(500).json({ error: 'Failed to write settings' });
  }
});

/**
 * GET /api/settings/fhir-connection-test — admin-only.
 * Reads the current blazeUrl from settings.yaml and probes the FHIR
 * capability endpoint directly (avoids the startup-time-fixed proxy target).
 */
settingsApiRouter.get('/fhir-connection-test', async (req: Request, res: Response): Promise<void> => {
  if (req.auth?.role !== 'admin') {
    res.status(403).json({ error: 'FHIR connection test is restricted to administrators' });
    return;
  }
  let blazeUrl = 'http://localhost:8080/fhir';
  try {
    const raw = readSettings();
    const parsed = yaml.load(raw) as Record<string, unknown> | null;
    const ds = parsed?.dataSource as Record<string, unknown> | undefined;
    if (typeof ds?.blazeUrl === 'string' && ds.blazeUrl) blazeUrl = ds.blazeUrl;
  } catch {
    // fall through to default
  }
  const metadataUrl = blazeUrl.replace(/\/$/, '') + '/metadata';
  try {
    const resp = await fetch(metadataUrl, {
      headers: { Accept: 'application/fhir+json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) {
      res.status(502).json({ error: `FHIR server returned ${resp.status} ${resp.statusText}` });
      return;
    }
    const capability = await resp.json() as {
      software?: { name?: string; version?: string };
      fhirVersion?: string;
    };
    const name = capability.software?.name ?? 'FHIR Server';
    const version = capability.software?.version ?? '';
    const fhir = capability.fhirVersion ? ` (FHIR ${capability.fhirVersion})` : '';
    res.json({ ok: true, detail: `${name}${version ? ' ' + version : ''}${fhir}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `Cannot reach FHIR server at ${metadataUrl}: ${msg}` });
  }
});

