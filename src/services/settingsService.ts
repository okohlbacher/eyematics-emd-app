import yaml from 'js-yaml';

import { authFetch } from './authHeaders';
import {
  PLAUSIBILITY_DEFAULTS,
  THRESHOLD_DEFAULTS,
  type PlausibilityConfig,
  type ThresholdConfig,
} from '../../shared/thresholdConfig';

export type { ThresholdConfig, PlausibilityConfig };

export interface AppSettings {
  twoFactorEnabled: boolean;
  therapyInterrupterDays: number;
  therapyBreakerDays: number;
  /** Phase 33 / COH-03: CRT implausibility threshold in µm (default 400, matches CRITICAL_CRT_THRESHOLD) */
  crtImplausibleThresholdUm: number;
  dataSource: {
    type: 'local' | 'blaze';
    blazeUrl: string;
  };
  outcomes?: {
    serverAggregationThresholdPatients?: number;
    aggregateCacheTtlMs?: number;
  };
  auth?: {
    refreshTokenTtlMs?: number;
    refreshAbsoluteCapMs?: number;
    /** AUTHCFG-03: inactivity timeout in ms (default 10 min) */
    inactivityTimeoutMs?: number;
    /** AUTHCFG-02: warning lead time before auto-logout in ms (default 3 min) */
    warningBeforeMs?: number;
    /** AUTHCFG-04: max failed login attempts before lockout */
    maxLoginAttempts?: number;
  };
  /** CFG-01: critical/action clinical thresholds (admin-configurable). */
  thresholds?: ThresholdConfig;
  /** CFG-02: plausibility range configuration (admin-configurable). */
  plausibility?: PlausibilityConfig;
}

const DEFAULTS: AppSettings = {
  twoFactorEnabled: false,
  therapyInterrupterDays: 120,
  therapyBreakerDays: 365,
  crtImplausibleThresholdUm: 400,
  dataSource: {
    type: 'local',
    blazeUrl: 'http://localhost:8080/fhir',
  },
  outcomes: {
    serverAggregationThresholdPatients: 1000,
    aggregateCacheTtlMs: 1800000,
  },
  auth: {
    refreshTokenTtlMs: 28_800_000,
    refreshAbsoluteCapMs: 43_200_000,
    inactivityTimeoutMs: 600_000,  // 10 min (AUTHCFG-03 safe default)
    warningBeforeMs: 180_000,      // 3 min (AUTHCFG-02 — was 60 s hardcoded)
    maxLoginAttempts: 5,
  },
  // CFG-01/CFG-02: use shared defaults as single source of truth
  thresholds: THRESHOLD_DEFAULTS,
  plausibility: PLAUSIBILITY_DEFAULTS,
};

/** Cached merged settings */
let _cached: AppSettings | null = null;

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** Deep merge patch into base (patch wins) */
function merge(base: AppSettings, patch: DeepPartial<AppSettings>): AppSettings {
  const out = { ...base };
  for (const key of Object.keys(patch) as (keyof AppSettings)[]) {
    const patchVal = patch[key];
    if (patchVal !== undefined && patchVal !== null && typeof patchVal === 'object' && !Array.isArray(patchVal) && typeof out[key] === 'object') {
      (out as Record<string, unknown>)[key] = merge(
        out[key] as unknown as AppSettings,
        patchVal as DeepPartial<AppSettings>,
      );
    } else if (patchVal !== undefined) {
      (out as Record<string, unknown>)[key] = patchVal;
    }
  }
  return out;
}

/**
 * Load settings from the server (settings.yaml via API).
 * Falls back to fetching public/settings.yaml directly if API unavailable.
 */
export async function loadSettings(): Promise<AppSettings> {
  let fromYaml: Partial<AppSettings> = {};
  try {
    // Try server API first (supports write-back)
    const resp = await authFetch('/api/settings');
    if (resp.ok) {
      const text = await resp.text();
      fromYaml = (yaml.load(text, { schema: yaml.JSON_SCHEMA }) as Partial<AppSettings>) ?? {};
    }
  } catch {
    // API unavailable — use defaults
  }

  _cached = merge(DEFAULTS, fromYaml);
  return _cached;
}

/**
 * Get the current settings synchronously.
 * Returns cached value if loadSettings() was called, otherwise defaults.
 */
export function getSettings(): AppSettings {
  if (_cached) return _cached;
  return { ...DEFAULTS };
}

/** F-23: persist helper returns promise; callers resync on failure */
async function persistSettings(settings: AppSettings): Promise<void> {
  const yamlStr = yaml.dump(settings, { indent: 2, lineWidth: 120, noRefs: true });
  const resp = await authFetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'text/yaml' },
    body: yamlStr,
  });
  if (!resp.ok) {
    throw new Error(`Failed to persist settings: ${resp.status}`);
  }
}

/**
 * Update a subset of settings. Persists to server-side settings.yaml.
 * On server rejection, reloads the cache from the server AND rethrows so
 * callers can surface the error — otherwise UI state (radios, toggles)
 * silently diverges from server state.
 */
export async function updateSettings(patch: DeepPartial<AppSettings>): Promise<AppSettings> {
  const previous = _cached;
  _cached = merge(_cached ?? DEFAULTS, patch);
  try {
    await persistSettings(_cached);
    return _cached;
  } catch (err) {
    console.error('[settingsService] Persist failed, reloading from server:', err);
    _cached = previous;
    await loadSettings();
    throw err;
  }
}

/**
 * Reset all settings to defaults and persist.
 * On server rejection, reloads settings to resync client cache and rethrows.
 */
export async function resetSettings(): Promise<AppSettings> {
  const previous = _cached;
  _cached = { ...DEFAULTS };
  try {
    await persistSettings(_cached);
    return _cached;
  } catch (err) {
    console.error('[settingsService] Persist failed, reloading from server:', err);
    _cached = previous;
    await loadSettings();
    throw err;
  }
}

/**
 * Export current settings as a YAML string for download.
 */
export function exportSettingsYaml(): string {
  const settings = getSettings();
  return yaml.dump(settings, { indent: 2, lineWidth: 120, noRefs: true });
}
