/**
 * Server-side terminology proxy (Phase 25 / Plan 02 — TERM-03, TERM-05).
 *
 * Exposes POST /api/terminology/lookup. JWT-authenticated by virtue of being
 * mounted under /api in server/index.ts (D-14). Behavior contract:
 *
 *   - 400 when body is missing/malformed `system` or `code`.
 *   - 503 with {error:'terminology lookup disabled'} when terminology.enabled
 *     is false OR serverUrl is unset (D-12).
 *   - 200 with {display, system, code, source:'cache'|'remote'} on a successful
 *     FHIR $lookup (D-13). source='seed' is reserved for the client-side
 *     resolver (plan 25-01); the server only emits 'cache' or 'remote'.
 *   - 502 with {error:'ssrf blocked'} when the configured serverUrl resolves
 *     to a private/loopback/link-local address or its origin doesn't match
 *     the outbound URL (D-10).
 *   - 502 with {error:'remote lookup failed'} on outbound fetch errors,
 *     non-2xx responses, or a response missing the `display` parameter.
 *
 * Caching (D-11): hand-rolled insertion-order LRU keyed by `system|code|locale`,
 * capped at 10000 entries, TTL = terminology.cacheTtlMs (default 24h). No
 * external dependency. No audit logging for individual lookups (D-15).
 *
 * Settings are re-read on every request so PUT /api/settings takes effect
 * without a server restart — mirrors the invalidation hook approach used by
 * server/fhirApi.ts.
 */

import fs from 'node:fs';

import { Router } from 'express';
import yaml from 'js-yaml';

import { SETTINGS_FILE } from './constants.js';

// ---------------------------------------------------------------------------
// Settings — read at request time, fail safe to disabled
// ---------------------------------------------------------------------------

interface TerminologySettings {
  enabled: boolean;
  serverUrl: string | undefined;
  cacheTtlMs: number;
}

const DEFAULT_CACHE_TTL_MS = 86_400_000; // 24h (D-17)

function readTerminologySettings(): TerminologySettings {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const parsed = yaml.load(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { enabled: false, serverUrl: undefined, cacheTtlMs: DEFAULT_CACHE_TTL_MS };
    }
    const root = parsed as Record<string, unknown>;
    const term = (root.terminology ?? {}) as Record<string, unknown>;
    const enabled = term.enabled === true;
    const serverUrl = typeof term.serverUrl === 'string' && term.serverUrl.length > 0
      ? term.serverUrl
      : undefined;
    const cacheTtlMs = typeof term.cacheTtlMs === 'number' && term.cacheTtlMs > 0
      ? term.cacheTtlMs
      : DEFAULT_CACHE_TTL_MS;
    return { enabled, serverUrl, cacheTtlMs };
  } catch {
    // Fail safe: treat any read/parse failure as disabled.
    return { enabled: false, serverUrl: undefined, cacheTtlMs: DEFAULT_CACHE_TTL_MS };
  }
}

// ---------------------------------------------------------------------------
// LRU cache (D-11) — hand-rolled, insertion-order eviction
// ---------------------------------------------------------------------------

interface CacheEntry {
  display: string;
  expiresAt: number;
}

const MAX_CACHE_ENTRIES = 10_000;
const _cache: Map<string, CacheEntry> = new Map();

function cacheGet(key: string, now: number): string | undefined {
  const entry = _cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    _cache.delete(key); // evict-on-stale
    return undefined;
  }
  return entry.display;
}

function cacheSet(key: string, display: string, ttlMs: number): void {
  if (_cache.size >= MAX_CACHE_ENTRIES) {
    // Evict the oldest insertion-order entry (Map preserves insertion order).
    const oldest = _cache.keys().next();
    if (!oldest.done) _cache.delete(oldest.value);
  }
  _cache.set(key, { display, expiresAt: Date.now() + ttlMs });
}

/** Test-only: reset cache between cases. NOT part of the public API. */
export function _resetCacheForTests(): void {
  _cache.clear();
}

// ---------------------------------------------------------------------------
// SSRF guard — synchronous private-address rejection (D-10)
// ---------------------------------------------------------------------------

/**
 * Returns true if `hostname` is a loopback / private / link-local address
 * that the proxy must refuse to contact. Synchronous check only — no DNS
 * resolution. Hostnames that look like DNS names are accepted (the deployer
 * is responsible for not pointing serverUrl at internal CNAMEs).
 */
function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '::1' || h === '0.0.0.0') return true;

  // IPv4 dotted-quad checks
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 127) return true;                       // 127.0.0.0/8
    if (a === 10) return true;                        // 10.0.0.0/8
    if (a === 192 && b === 168) return true;          // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 169 && b === 254) return true;          // 169.254.0.0/16 link-local
    if (a === 0) return true;                         // 0.0.0.0/8
  }

  // IPv6 prefixes — fc00::/7 (unique-local) and fe80::/10 (link-local)
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // fc00::/7
  if (h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) {
    return true; // fe80::/10
  }

  return false;
}

// ---------------------------------------------------------------------------
// Outbound $lookup (D-10, D-13)
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 10_000;

class SsrfBlockedError extends Error {
  constructor() {
    super('ssrf blocked');
    this.name = 'SsrfBlockedError';
  }
}

async function fetchLookup(
  serverUrl: string,
  system: string,
  code: string,
  locale: string,
): Promise<string> {
  const baseOrigin = new URL(serverUrl).origin;
  const trimmed = serverUrl.replace(/\/$/, '');
  const url = `${trimmed}/CodeSystem/$lookup?system=${encodeURIComponent(system)}&code=${encodeURIComponent(code)}`;

  const parsed = new URL(url);
  if (parsed.origin !== baseOrigin) throw new SsrfBlockedError();
  if (isPrivateHostname(parsed.hostname)) throw new SsrfBlockedError();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      headers: {
        Accept: 'application/fhir+json',
        'Accept-Language': locale,
      },
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new Error(`remote lookup non-2xx: ${resp.status}`);
    }
    const body = (await resp.json()) as {
      parameter?: Array<{ name?: string; valueString?: unknown }>;
    };
    const display = body.parameter?.find((p) => p.name === 'display')?.valueString;
    if (typeof display !== 'string' || display.length === 0) {
      throw new Error('remote lookup missing display parameter');
    }
    return display;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const terminologyRouter: Router = Router();

terminologyRouter.post('/lookup', async (req, res) => {
  const body = (req.body ?? {}) as { system?: unknown; code?: unknown; locale?: unknown };

  if (typeof body.system !== 'string' || body.system.length === 0
   || typeof body.code !== 'string' || body.code.length === 0) {
    res.status(400).json({ error: 'invalid body' });
    return;
  }

  const settings = readTerminologySettings();
  if (!settings.enabled || !settings.serverUrl) {
    res.status(503).json({ error: 'terminology lookup disabled' });
    return;
  }

  const system = body.system;
  const code = body.code;
  const locale = typeof body.locale === 'string' && body.locale.length > 0 ? body.locale : 'de';

  const cacheKey = `${system}|${code}|${locale}`;
  const now = Date.now();
  const hit = cacheGet(cacheKey, now);
  if (hit !== undefined) {
    res.status(200).json({ display: hit, system, code, source: 'cache' });
    return;
  }

  try {
    const display = await fetchLookup(settings.serverUrl, system, code, locale);
    cacheSet(cacheKey, display, settings.cacheTtlMs);
    res.status(200).json({ display, system, code, source: 'remote' });
  } catch (err) {
    if (err instanceof SsrfBlockedError) {
      res.status(502).json({ error: 'ssrf blocked' });
      return;
    }
    res.status(502).json({ error: 'remote lookup failed' });
  }
});
