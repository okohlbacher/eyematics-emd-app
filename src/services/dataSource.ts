import type { FhirBundle } from '../types/fhir';
import { authFetch } from './authHeaders';
import { getSettings } from './settingsService';

export type DataSourceType = 'local' | 'blaze';

export interface DataSourceConfig {
  type: DataSourceType;
  blazeUrl?: string;
}

const DEFAULT_BLAZE_URL = 'http://localhost:8080/fhir';

// ---------------------------------------------------------------------------
// Config – delegates to the central settings service
// ---------------------------------------------------------------------------

export function getDataSourceConfig(): DataSourceConfig {
  const s = getSettings();
  return {
    type: s.dataSource.type,
    blazeUrl: s.dataSource.blazeUrl || DEFAULT_BLAZE_URL,
  };
}

// ---------------------------------------------------------------------------
// Public entry point – all data loading goes through the authenticated server API
// ---------------------------------------------------------------------------

/**
 * Load FHIR bundles from the server API.
 * Center-based filtering is applied server-side; the client receives only the
 * bundles it is authorised to see.
 *
 * The `config` parameter is accepted for call-site compatibility but the
 * routing decision (local vs. Blaze) is now made entirely by the server.
 */
export async function loadBundlesFromSource(
  _config: DataSourceConfig
): Promise<FhirBundle[]> {
  const resp = await authFetch('/api/fhir/bundles', {
    headers: { Accept: 'application/json' },
  });

  if (resp.status === 401) {
    return []; // authFetch handles redirect; degrade gracefully
  }

  if (!resp.ok) {
    throw new Error(
      `Failed to load FHIR bundles from server: ${resp.status} ${resp.statusText}`
    );
  }

  const body = (await resp.json()) as { bundles: FhirBundle[] };
  return body.bundles;
}

// ---------------------------------------------------------------------------
// FHIR-proxy connectivity test
// ---------------------------------------------------------------------------

/**
 * Test connectivity to the FHIR server.
 * Delegates to the server-side test endpoint which reads the current blazeUrl
 * from settings.yaml and makes a direct outbound request (avoids the
 * startup-time-fixed proxy target).
 */
export async function testBlazeConnection(_blazeUrl: string): Promise<string> {
  const resp = await authFetch('/api/settings/fhir-connection-test');

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `${resp.status} ${resp.statusText}`);
  }

  const result = (await resp.json()) as { ok: boolean; detail?: string };
  return result.detail ?? 'Connected';
}
