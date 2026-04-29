---
phase: 25-terminology-resolver
plan: 02
type: execute
wave: 2
depends_on: []
files_modified:
  - server/terminologyApi.ts
  - server/index.ts
  - tests/terminologyApi.test.ts
autonomous: true
requirements:
  - TERM-03
  - TERM-05
must_haves:
  truths:
    - "POST /api/terminology/lookup is mounted on the existing JWT-authenticated /api/* router (D-02, D-14)"
    - "When terminology.enabled is false, the endpoint returns 503 with body {error: 'terminology lookup disabled'} (D-12)"
    - "When enabled, the endpoint forwards a FHIR $lookup-style request to terminology.serverUrl and returns {display, system, code, source} (D-13)"
    - "SSRF guard rejects requests where the resolved serverUrl points to private IP space; reuses the existing Blaze-proxy origin pattern (D-10, specifics §4)"
    - "LRU in-memory cache: max 10000 entries, TTL = terminology.cacheTtlMs (default 24h), per-process (D-11)"
    - "No audit logging for individual lookups (D-15)"
    - "Server tests cover 503-when-disabled, 200-when-enabled-with-mock, and SSRF rejection for private-IP serverUrl (D-22)"
    - "Plan does NOT modify src/ — parallel-safe with 25-01 (D-26)"
    - "Safety net green: test:ci + build + lint + knip"
  artifacts:
    - path: "server/terminologyApi.ts"
      provides: "Express router exposing POST /api/terminology/lookup with SSRF guard + LRU cache"
      exports: ["terminologyRouter"]
    - path: "tests/terminologyApi.test.ts"
      provides: "Server-side tests for proxy endpoint per D-22"
      contains: "describe"
  key_links:
    - from: "server/index.ts"
      to: "server/terminologyApi.ts"
      via: "app.use('/api/terminology', terminologyRouter)"
      pattern: "terminologyRouter"
    - from: "POST /api/terminology/lookup"
      to: "terminology.serverUrl (external FHIR $lookup)"
      via: "fetch with origin whitelist + AbortController timeout"
      pattern: "\\$lookup"
---

<objective>
Stand up the server-side terminology proxy at `server/terminologyApi.ts` (D-02) with SSRF-safe origin whitelist (D-10, reusing the Blaze-proxy pattern from `server/fhirApi.ts:282-323`), LRU in-memory cache (D-11), `terminology.enabled` 503 short-circuit (D-12), and the request/response contract from D-13. JWT-authenticated like every other `/api/*` route (D-14). No audit logging for individual lookups (D-15). Parallel-safe with plan 25-01 — different files, no overlap.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/25-terminology-resolver/25-CONTEXT.md
@.planning/REQUIREMENTS.md
@CLAUDE.md
@server/fhirApi.ts
@server/index.ts
@server/authMiddleware.ts
@server/constants.ts

<interfaces>
SSRF helper to reuse — `server/fhirApi.ts:281-323`:

```ts
async function fetchAllPages(url: string): Promise<unknown[]> {
  // SSRF guard: only follow pagination links that share the initial URL's origin
  const allowedOrigin = new URL(url).origin;
  // ... pagination loop checks `new URL(nextLink.url).origin === allowedOrigin` (line 320-321)
}
```

The "origin whitelist" pattern in fhirApi is origin-locked-to-config-URL. For terminology we apply the same shape: `allowedOrigin = new URL(settings.terminology.serverUrl).origin`, then assert the outbound fetch URL's origin matches before issuing it. **Additionally** for terminology we add an explicit private-IP guard (specifics §4 / Pitfall: SSRF discipline) — reject if the resolved hostname is `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `fc00::/7`, or `fe80::/10`. Implement this guard inline (small, focused) or, if Claude judges it shared with Blaze-proxy expansion would be warranted, extract to `server/proxyGuard.ts` (specifics §4 — "extract... if shared between Blaze + terminology becomes warranted"). For this phase: keep inline in `terminologyApi.ts` — Blaze-proxy already has its own variant; do not refactor Blaze in this plan.

Existing settings load pattern — `server/index.ts` reads `settings` (yaml.load output) once at boot. The router must read terminology config at request time (not boot time) so a settings-write via `/api/settings` takes effect without restart. Use the same `SETTINGS_FILE` constant from `server/constants.ts` and re-read on each request (or use a lightweight in-process invalidation hook similar to `invalidateFhirCache` in `fhirApi.ts:65`).

JWT middleware — `server/authMiddleware.ts` is mounted globally on `/api/*` from `server/index.ts`. Mounting `terminologyRouter` under `/api/terminology` automatically inherits JWT auth (D-14). No new auth surface.

Endpoint contract (D-13):
- Request: `POST /api/terminology/lookup`, body `{ system: string, code: string, locale?: string }` (Content-Type: application/json)
- Response 200: `{ display: string, system: string, code: string, source: 'cache' | 'remote' | 'seed' }`
- Response 503 (disabled): `{ error: 'terminology lookup disabled' }`
- Response 400: malformed body
- Response 502: outbound fetch failed or SSRF guard rejected outbound URL

LRU bounds (D-11): max 10000 entries; TTL from `terminology.cacheTtlMs` (default 24h = 86400000ms). Hand-rolled `Map` with insertion-order eviction is acceptable per CONTEXT Claude-discretion ("prefer hand-rolled if dep-free"). Each entry stores `{ display, expiresAt }`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create terminologyApi.ts skeleton + 503-disabled path + mount in index.ts</name>
  <files>server/terminologyApi.ts, server/index.ts, tests/terminologyApi.test.ts</files>
  <behavior>
    - When `settings.terminology?.enabled !== true` (default false per D-16), POST `/api/terminology/lookup` returns HTTP 503 with body `{ error: 'terminology lookup disabled' }`.
    - When body is missing `system` or `code`, returns 400.
    - When enabled is true but no `serverUrl` configured, returns 503 with same disabled body (treat unset URL as "not configured = disabled").
    - Endpoint mounted under `/api/terminology` so it inherits JWT middleware (D-14).
  </behavior>
  <action>
    Per D-02, D-12, D-13, D-14, CLAUDE.md throw-only error policy (D-03):
    1. Create `server/terminologyApi.ts`:
       - `import { Router } from 'express'`; `import fs from 'node:fs'`; `import yaml from 'js-yaml'`; `import { SETTINGS_FILE } from './constants.js'`.
       - Helper `readTerminologySettings()`: reads YAML, returns `{ enabled: boolean, serverUrl: string | undefined, cacheTtlMs: number }` with code defaults `enabled=false`, `cacheTtlMs=86400000` per D-17 (server/index.ts pattern of code-supplied defaults). Wrap in try/catch — fail safe to disabled.
       - Define `RequestBody = { system?: unknown; code?: unknown; locale?: unknown }`.
       - `terminologyRouter.post('/lookup', async (req, res) => { ... })`:
          - Validate body: if `typeof body.system !== 'string' || typeof body.code !== 'string'` → `res.status(400).json({ error: 'invalid body' })`.
          - Read settings. If `!settings.enabled || !settings.serverUrl` → `res.status(503).json({ error: 'terminology lookup disabled' })`.
          - (Remote path implemented in Task 2 — for this task, return a placeholder 501 if reach this point; tests only cover 503/400 here.)
       - Export `terminologyRouter`.
    2. Edit `server/index.ts`:
       - Mirror existing router mounts (e.g. `fhirApi`, `outcomesAggregateApi`). Locate where other `/api/*` routers are mounted; add `import { terminologyRouter } from './terminologyApi.js'` and `app.use('/api/terminology', terminologyRouter)` in the same block. Verify mount comes AFTER the global authMiddleware so JWT auth applies.
    3. Tests `tests/terminologyApi.test.ts` — first cases (D-22 case 1):
       - Use the existing supertest harness pattern from prior server tests (e.g. `tests/fhirApi.test.ts` if present, or `tests/auditApi.test.ts`). Authenticate with the same test JWT helper used elsewhere.
       - Test A: settings-fixture with `terminology.enabled: false` → POST `/api/terminology/lookup` `{system:'http://snomed.info/sct',code:'267718000'}` → 503, body `{error:'terminology lookup disabled'}`.
       - Test B: missing `code` field → 400.
       - Test C: settings with `enabled: true` but no `serverUrl` → 503 (unset URL treated as disabled).
       - Test D: unauthenticated request (no JWT) → 401 (asserts JWT auth applies via global middleware).
  </action>
  <verify>
    <automated>npx vitest run tests/terminologyApi.test.ts -t '503|400|401'</automated>
  </verify>
  <done>
    503/400/401 tests green. Endpoint mounted in `server/index.ts`. Atomic commit: `feat(25-02): add /api/terminology/lookup with disabled-503 short-circuit (TERM-03)`.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add LRU cache + SSRF-guarded outbound $lookup + remote 200 path</name>
  <files>server/terminologyApi.ts, tests/terminologyApi.test.ts</files>
  <behavior>
    - When `terminology.enabled: true` and `serverUrl` set, the endpoint translates the request to a FHIR `$lookup` GET against `${serverUrl}/CodeSystem/$lookup?system={system}&code={code}` (Accept: application/fhir+json), parses the `parameter` array for `name === 'display'`, and returns `{ display, system, code, source: 'remote' }`.
    - SSRF guard: outbound URL's origin must equal the configured serverUrl's origin (D-10 mirror of fhirApi pattern). Additionally, reject if hostname is in the private-IP / loopback / link-local set listed in `<interfaces>`. On rejection → 502 `{ error: 'ssrf blocked' }`.
    - LRU cache (D-11): hand-rolled `Map<string, { display: string; expiresAt: number }>` keyed `${system}|${code}|${locale ?? 'de'}`. Max 10000 entries — on insert past cap, delete the oldest insertion-order entry. TTL = `terminology.cacheTtlMs`.
    - Cache hit returns `source: 'cache'`. Cache miss → fetch → write to cache → return `source: 'remote'`.
    - Outbound fetch has 10-second AbortController timeout (matches `PAGE_TIMEOUT_MS` style in fhirApi:295 but tighter — single lookup, not paginated). Failure → 502 `{ error: 'remote lookup failed' }`.
    - No audit logging for these lookups (D-15) — do not call any auditMiddleware-touching code path.
  </behavior>
  <action>
    Per D-10, D-11, D-13, D-15, specifics §4:
    1. Add to `server/terminologyApi.ts`:
       - Module-level `const _cache = new Map<string, { display: string; expiresAt: number }>()`.
       - Const `MAX_CACHE_ENTRIES = 10000`.
       - Helper `cacheGet(key, now)`: if entry and `entry.expiresAt > now` → return display; else `_cache.delete(key)` (evict-on-stale) → return undefined.
       - Helper `cacheSet(key, display, ttlMs)`: if `_cache.size >= MAX_CACHE_ENTRIES` → delete the first key from `_cache.keys().next().value` (insertion-order eviction). Then `_cache.set(key, { display, expiresAt: Date.now() + ttlMs })`.
       - Helper `isPrivateHostname(hostname)`: checks `localhost`, `127.x`, `10.x`, `172.{16-31}.x`, `192.168.x.x`, `169.254.x.x`, `::1`, `fc00::/7`, `fe80::/10`. Use simple string-prefix + regex checks; do NOT do DNS resolution (synchronous private-IP guard only).
       - Helper `fetchLookup(serverUrl, system, code, locale)`:
           - `const url = `${serverUrl.replace(/\/$/, '')}/CodeSystem/$lookup?system=${encodeURIComponent(system)}&code=${encodeURIComponent(code)}``;
           - Parse `new URL(url)` — assert `.origin === new URL(serverUrl).origin` (origin lock per D-10) and `!isPrivateHostname(parsed.hostname)`. Throw `'ssrf blocked'` if either fails.
           - `AbortController` with 10s timeout. `fetch(url, { headers: { Accept: 'application/fhir+json', 'Accept-Language': locale } })`. On `!resp.ok` → throw.
           - Parse JSON: extract `parameter.find(p => p.name === 'display').valueString` (FHIR $lookup contract). On missing → throw.
           - Return display string.
    2. Replace the Task-1 placeholder with the full handler:
       - Read settings; 503 if disabled.
       - Compute `cacheKey = `${system}|${code}|${locale ?? 'de'}``.
       - Cache hit → 200 `{display, system, code, source:'cache'}`.
       - Else `await fetchLookup(...)` inside try/catch:
            - On `ssrf blocked` → 502 `{error:'ssrf blocked'}`.
            - On other error → 502 `{error:'remote lookup failed'}`.
            - On success → `cacheSet(key, display, settings.cacheTtlMs)` → 200 `{display, system, code, source:'remote'}`.
    3. Tests (extend `tests/terminologyApi.test.ts` per D-22):
       - Test E (200 enabled): settings `{enabled:true, serverUrl:'https://example.test/fhir'}`; mock `globalThis.fetch` to resolve `{ok:true, json: () => ({parameter:[{name:'display',valueString:'AMD'}]})}`. POST → 200, body `{display:'AMD', source:'remote', ...}`.
       - Test F (cache hit): repeat the same request immediately after Test E (or seed `_cache` directly via an exported `_resetCacheForTests()` helper). Asserts second response has `source:'cache'` AND `globalThis.fetch` mock was called only once.
       - Test G (SSRF private IP): settings `{enabled:true, serverUrl:'http://192.168.1.5/fhir'}`. POST → 502 `{error:'ssrf blocked'}`. `fetch` mock NOT called.
       - Test H (SSRF localhost): settings `{enabled:true, serverUrl:'http://localhost:8080/fhir'}` → 502.
       - Use `vi.mock('node:fs')` or read from a tmp `settings.yaml` per existing test pattern; whichever matches the existing harness in `tests/auditApi.test.ts` / `tests/fhirApi.test.ts`.
    4. Run final safety net:
       - `npm run test:ci` green.
       - `npm run build` green (Pitfall 3 — Vite/rolldown can break server-side dynamic imports; explicit check).
       - `npm run lint` clean.
       - `npm run knip` clean.
  </action>
  <verify>
    <automated>npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run lint &amp;&amp; npm run knip</automated>
  </verify>
  <done>
    All 7+ server tests pass (4 from Task 1 + 4 from Task 2). Safety net green. Atomic commit: `feat(25-02): add SSRF-guarded outbound $lookup + LRU cache (TERM-03, TERM-05)`.
  </done>
</task>

</tasks>

<verification>
- `server/terminologyApi.ts` exists; `terminologyRouter` mounted in `server/index.ts` under `/api/terminology` (after authMiddleware).
- 503 returned when disabled; 200 with `{display, system, code, source}` when enabled and remote responds.
- SSRF guard rejects private-IP and origin-mismatched URLs (502).
- LRU cache: capped at 10000 entries; TTL honors `terminology.cacheTtlMs`.
- No call into auditMiddleware from this router (D-15).
- No `src/` files modified — confirms parallel safety with 25-01 (`git diff --name-only main...HEAD` shows only `server/` and `tests/`).
</verification>

<success_criteria>
- TERM-03 fully satisfied: SSRF-safe origin whitelist, LRU + TTL cache, FHIR $lookup translation, disabled-by-default 503 contract.
- TERM-05 advanced: server tests for 503/200/SSRF (D-22 cases 1–3) all green.
- Safety net green at end of plan.
- Endpoint is JWT-protected (proven by Test D 401 case).
</success_criteria>

<output>
After completion, create `.planning/phases/25-terminology-resolver/25-02-SUMMARY.md` per the standard summary template.
</output>
