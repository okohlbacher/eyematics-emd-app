# Phase 25: Terminology Resolver — Context

**Gathered:** 2026-04-28
**Status:** Ready for planning
**Mode:** architecture pre-decided in post-v1.9.3 review (no `--auto` discuss needed)
**Scope trigger:** Hardcoded display-name mapping in `src/services/fhirLoader.ts` is not scalable; should resolve via terminology server with offline fallback.

<domain>
## Phase Boundary

Replace the hardcoded `getDiagnosisLabel` / `getDiagnosisFullText` switch statements in `fhirLoader.ts` with a dedicated, layered terminology resolver:

1. Build a `(system → Set<code>)` dictionary by walking loaded bundles (Condition.code.coding, Observation.code.coding, Procedure.code.coding)
2. Resolve display names via 3-tier strategy: in-memory cache → server-proxied FHIR `$lookup` → well-known seed map
3. Move all hardcoded display strings out of `fhirLoader.ts` into the new module
4. Update 5 caller files to use the new sync helper or React hook
5. Add server-side proxy (`server/terminologyApi.ts`) with SSRF-safe origin whitelist + LRU cache (matches Blaze-proxy pattern)
6. Document new `terminology.*` settings keys

**Out of scope:**
- Wiring up an actual external terminology server (the proxy is shipped; users opt in via `terminology.enabled: true` and a real `serverUrl`)
- LOINC display names (Observation codes) — phase scope is diagnosis codes only; LOINC follows in a future phase if needed
- IndexedDB persistence — in-memory cache only for v1.9.4
- UI for terminology server status / connection test
- Bundling the well-known seed into a separate JSON file — keep it as TS const for now

</domain>

<decisions>
## Implementation Decisions

### Module structure

- **D-01:** New module at `src/services/terminology.ts` — sibling of `fhirLoader.ts`. Browser-side only; no server imports.
- **D-02:** Server proxy at `server/terminologyApi.ts` — sibling of `server/fhirApi.ts`. Mounted at `POST /api/terminology/lookup`.
- **D-03:** Keep all `(system, code) → display` knowledge OUT of `fhirLoader.ts`. The loader's only job is resource extraction.

### Public API (terminology.ts)

- **D-04:** Exports:
  - `collectCodings(bundles: FhirBundle[]): Map<string, Set<string>>` — pure, called once after `loadAllBundles()`
  - `resolveDisplay({ system, code, locale }): Promise<string>` — async; cache → server → seed → raw code
  - `getCachedDisplay(system: string | undefined, code: string, locale: string): string` — sync; returns L1/L3 hit or raw code; fires async lookup as side effect when L1 misses
  - `useDiagnosisDisplay(code, system?, locale): { label: string, fullText: string, isResolving: boolean }` — React hook; re-renders when L1 fills
  - `_seedMap` (internal, exported only for tests) — the well-known fallback
- **D-05:** Cache key is `${system ?? '_'}|${code}|${locale}` (underscore for missing system).
- **D-06:** Sync `getCachedDisplay` MUST NOT block render. Falls through to raw code if no seed hit; async fetch is fire-and-forget.

### Seed scope

- **D-07:** Migrate the existing 9 hardcoded entries (SNOMED AMD, SNOMED DR, ICD E11.9, E10.9, H40.1, H25.1, H33.0, I10, E78.0, I25.1) into `_seedMap` keyed by `system|code` where:
  - SNOMED system = `http://snomed.info/sct`
  - ICD-10-GM system = `http://fhir.de/CodeSystem/bfarm/icd-10-gm` (BfArM canonical) OR fall back to `http://hl7.org/fhir/sid/icd-10` if GM not detected. Phase research clarifies which actually appears in bundles.
- **D-08:** Seed values store both `label` (short, ~"AMD") and `fullText` (long, ~"Altersbedingte Makuladegeneration (267718000)") per locale. Locale set: `de`, `en`.
- **D-09:** Codes encountered in bundles but absent from seed AND absent from cache are returned as the raw code string (preserving current behavior for unmapped codes).

### Server proxy

- **D-10:** SSRF guard: hardcoded scheme/host whitelist derived from `terminology.serverUrl` config. Reject if request resolves to private IP space (matches Blaze-proxy `isUrlSafeForProxy` pattern). Reuse the existing helper.
- **D-11:** LRU cache: in-memory `Map`, max 10000 entries, TTL = `terminology.cacheTtlMs` (default 24h). Per-process; no Redis.
- **D-12:** Disabled response: when `terminology.enabled: false`, endpoint returns **503 Service Unavailable** with body `{ error: 'terminology lookup disabled' }`. Client treats 503 as "fall through to seed".
- **D-13:** Endpoint contract: `POST /api/terminology/lookup` body `{ system: string, code: string, locale?: string }`, response `{ display: string, system, code, source: 'cache' | 'remote' | 'seed' }` (200) or 4xx/5xx error.
- **D-14:** Authenticated route — JWT-protected like other `/api/*` paths. Reuse existing middleware.
- **D-15:** No audit logging for individual lookups (high volume, low signal). Aggregate counts logged on a per-process timer if at all (deferred — out of scope).

### Settings

- **D-16:** New keys in `config/settings.yaml`:
  ```yaml
  terminology:
    enabled: false                                          # default OFF — preserves offline behavior
    serverUrl: 'https://r4.ontoserver.csiro.au/fhir'        # placeholder default; real server set per-deployment
    cacheTtlMs: 86400000                                    # 24h
  ```
- **D-17:** Defaults are code-supplied via the same `server/index.ts` pattern as `provider`/`maxLoginAttempts` (per Phase 23 D-17 — minimal YAML, code-defaulted keys).
- **D-18:** Document all three keys in `docs/Konfiguration.md` (German), with the same "minimal vs full" note pattern.

### Caller migration

- **D-19:** The 5 callers split into two groups:
  - **Tooltip + label combined (high-frequency render)** — `CohortBuilderPage`, `AnalysisPage`, `PatientHeader`: use `useDiagnosisDisplay()` hook; render label inline, fullText in `title=`.
  - **Lazy/CSV-export contexts** — `QualityPage`, `QualityCaseDetail`: use `getCachedDisplay()` sync helper directly (CSV exports don't trigger React re-render).
- **D-20:** Caller signature change: callers MUST now pass `cond.code.coding[0]?.system` alongside `code`. Use a small `pickCoding(cond)` helper if it pops up >2x.

### Testing

- **D-21:** New test file `tests/terminology.test.ts`:
  - `collectCodings` from fixture bundle returns expected `Map<string, Set<string>>`
  - `getCachedDisplay` returns seed value for SNOMED_AMD without firing fetch (mock `fetch` to assert no call)
  - `getCachedDisplay` returns raw code for unknown `(system, code)` AND fires async fetch (mock fetch returns 503; verify L1 stays empty)
  - `resolveDisplay` populates L1 on 200 server response; subsequent sync calls hit cache
  - `useDiagnosisDisplay` re-renders when L1 fills (RTL test with `act`)
- **D-22:** New server test `tests/terminologyApi.test.ts`:
  - 503 when `terminology.enabled: false`
  - 200 with shaped response when enabled (mock outbound fetch)
  - SSRF rejection for private-IP `serverUrl`
- **D-23:** Update or replace any existing tests that imported `getDiagnosisLabel` / `getDiagnosisFullText` from `fhirLoader.ts`.

### Cross-cutting

- **D-24:** Safety net per commit: `npm run test:ci` (619 baseline → ~624 after TERM-05) + `npm run build` + `npm run lint` + `npm run knip`.
- **D-25:** Atomic commits per task; one task per logical concern (module create / proxy create / migrate caller / settings / tests).
- **D-26:** Wave grouping suggestion: Wave 1 = module + seed + tests (no callers yet). Wave 2 = server proxy + tests (parallel-safe with Wave 1's caller migration). Wave 3 = caller migration + remove from fhirLoader. Final wave = settings + docs.

### Claude's Discretion

- Exact LRU library vs hand-rolled Map+timestamp — Claude judges; prefer hand-rolled if dep-free.
- Whether `pickCoding(cond)` becomes a new helper in `shared/fhirQueries.ts` or stays inline at call sites — Claude decides during planning.
- Specific ICD-10 system URL (GM vs international) — Claude inspects the actual bundles in `public/data/center-*.json` during planning to pick correctly.
- Test count target may shift ±2 from "624" — exact final count is Claude's call.

</decisions>

<specifics>
## Specific Ideas

- The 5 callers cover both render paths (label + tooltip) and non-render paths (CSV export). The hook covers the former cleanly; the sync helper covers the latter without React.
- The well-known seed already encodes the German + English copy that's been UAT'd over multiple milestones. Keep the strings byte-identical when migrating to avoid spurious diff in screenshot/snapshot tests.
- Ontoserver (`https://r4.ontoserver.csiro.au/fhir`) supports anonymous `$lookup` with SNOMED CT and is a good default placeholder. Real production deployments would set `serverUrl` to a national or institutional terminology server.
- The Blaze-proxy SSRF helper at `server/blazeProxy.ts` (or wherever `isUrlSafeForProxy` lives) is reusable — extract to `server/proxyGuard.ts` if shared between Blaze + terminology becomes warranted.

</specifics>

<canonical_refs>
**Downstream agents MUST read these before planning or implementing.**

### ROADMAP & requirements
- `.planning/ROADMAP.md` §Phase 25 — phase goal + success criteria
- `.planning/REQUIREMENTS.md` TERM-01..TERM-05 — binding requirement text

### Existing code (to be modified)
- `src/services/fhirLoader.ts` — currently hosts `getDiagnosisLabel`, `getDiagnosisFullText` (lines 112-170 in current main); also contains `_seedMap`-equivalent constants
- `src/pages/CohortBuilderPage.tsx`, `src/pages/AnalysisPage.tsx`, `src/pages/QualityPage.tsx`, `src/components/quality/QualityCaseDetail.tsx`, `src/components/case-detail/PatientHeader.tsx` — 5 callers
- `server/fhirApi.ts` — pattern reference for SSRF guard + caching
- `server/index.ts` — pattern for code-defaulted settings keys (Phase 23 D-17)
- `docs/Konfiguration.md` — pattern for documenting new settings keys

### Phase history (pattern references)
- Phase 23 minimal-YAML/code-defaulted settings convention
- Phase 22 atomic-commit pattern + safety-net cadence
- Phase 11 (CRREV-01) hashCohortId / server-proxy pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- Existing 9-entry hardcoded display map in `fhirLoader.ts:112-170` is the seed set verbatim
- Existing JWT-auth middleware applies to all `/api/*` — no new auth surface
- Existing settings persistence pattern (`PUT /api/settings` writes back to `settings.yaml`) accommodates new `terminology.*` keys without code changes

### Known pitfalls (from prior phases)
- **Pitfall 3 (Phase 22):** `npm run build` catches Vite/rolldown dynamic-import breakage tests miss. Run after every commit.
- **Pitfall 6 (Phase 24):** Worktree Edit/Write tools may silently fail; fall back to `git apply` heredoc patches.
- **SSRF discipline (Phase 14):** Origin whitelist must use the same helper Blaze-proxy uses; do not roll a new one.

</code_context>

<deferred_ideas>
## Deferred Ideas

- **LOINC display names** for Observation codes — same architecture, different code set; future phase.
- **Procedure code display names** — same pattern.
- **IndexedDB persistence** for the L1 cache (survives reload) — defer; in-memory is sufficient for v1.9.4.
- **Terminology server health-check / status indicator** in Settings UI — defer.
- **Per-organization terminology overrides** (different sites map ICD-10-GM differently) — premature.
- **Audit logging of terminology lookups** — defer; high volume / low signal.

</deferred_ideas>
