import type { FhirBundle } from '../types/fhir';
import { getSettings } from './settingsService';
import { getAuthHeaders } from './authHeaders';

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
  const resp = await fetch('/api/fhir/bundles', {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
  });

  if (resp.status === 401) {
    // The user's session has expired or the token is invalid.
    // Other mechanisms (auth interceptors) will handle logout; return empty
    // here so the UI degrades gracefully rather than throwing.
    return [];
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
 * Test connectivity to the FHIR server via the server-side proxy.
 * Returns the server software name/version string on success, or throws.
 */
export async function testBlazeConnection(_blazeUrl: string): Promise<string> {
  const resp = await fetch('/api/fhir-proxy/metadata', {
    headers: {
      Accept: 'application/fhir+json',
      ...getAuthHeaders(),
    },
  });

  if (!resp.ok) {
    throw new Error(`${resp.status} ${resp.statusText}`);
  }

  const capability = (await resp.json()) as {
    software?: { name?: string; version?: string };
    fhirVersion?: string;
  };
  const name = capability.software?.name ?? 'FHIR Server';
  const version = capability.software?.version ?? '';
  const fhir = capability.fhirVersion ? ` (FHIR ${capability.fhirVersion})` : '';
  return `${name}${version ? ' ' + version : ''}${fhir}`;
}
