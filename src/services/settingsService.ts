import yaml from 'js-yaml';

import { authFetch } from './authHeaders';

export interface AppSettings {
  twoFactorEnabled: boolean;
  therapyInterrupterDays: number;
  therapyBreakerDays: number;
  dataSource: {
    type: 'local' | 'blaze';
    blazeUrl: string;
  };
}

const DEFAULTS: AppSettings = {
  twoFactorEnabled: false,
  therapyInterrupterDays: 120,
  therapyBreakerDays: 365,
  dataSource: {
    type: 'local',
    blazeUrl: 'http://localhost:8080/fhir',
  },
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
 * On server rejection, reloads settings to resync client cache.
 */
export async function updateSettings(patch: DeepPartial<AppSettings>): Promise<AppSettings> {
  _cached = merge(_cached ?? DEFAULTS, patch);
  try {
    await persistSettings(_cached);
  } catch (err) {
    console.error('[settingsService] Persist failed, reloading from server:', err);
    await loadSettings();
  }
  return _cached!;
}

/**
 * Reset all settings to defaults and persist.
 * On server rejection, reloads settings to resync client cache.
 */
export async function resetSettings(): Promise<AppSettings> {
  _cached = { ...DEFAULTS };
  try {
    await persistSettings(_cached);
  } catch (err) {
    console.error('[settingsService] Persist failed, reloading from server:', err);
    await loadSettings();
  }
  return _cached!;
}

/**
 * Export current settings as a YAML string for download.
 */
export function exportSettingsYaml(): string {
  const settings = getSettings();
  return yaml.dump(settings, { indent: 2, lineWidth: 120, noRefs: true });
}
