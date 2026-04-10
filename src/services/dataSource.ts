// DEPRECATED (Phase 5): FHIR bundle loading moved to server/fhirApi.ts
// Only getDataSourceConfig() and testBlazeConnection() remain for settings UI

export type DataSourceType = 'local' | 'blaze';

export interface DataSourceConfig {
  type: DataSourceType;
  blazeUrl?: string;
}

import { getSettings } from './settingsService';

const DEFAULT_BLAZE_URL = 'http://localhost:8080/fhir';

/**
 * Rewrite absolute localhost FHIR URLs to a same-origin proxy path.
 * Kept only for testBlazeConnection() which still needs it.
 */
function proxyUrl(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      return u.pathname + u.search;
    }
  } catch {
    // Not a valid URL — return as-is
  }
  return url;
}

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
// REMOVED (Phase 5): loadBundlesFromSource, discoverLocalFiles,
// loadFromLocalFiles, loadFromBlaze, fetchAllPages
// FHIR bundle loading is now server-side only (server/fhirApi.ts).
// DataContext.tsx fetches from /api/fhir/bundles via fetch + JWT.
// ---------------------------------------------------------------------------

/**
 * Test connectivity to a FHIR server by fetching its capability statement.
 * Returns the server software name/version string on success, or throws.
 * Used by the settings page to validate the Blaze URL before saving.
 */
export async function testBlazeConnection(blazeUrl: string): Promise<string> {
  const url = proxyUrl(`${blazeUrl}/metadata`);
  const resp = await fetch(url, {
    headers: { Accept: 'application/fhir+json' },
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
