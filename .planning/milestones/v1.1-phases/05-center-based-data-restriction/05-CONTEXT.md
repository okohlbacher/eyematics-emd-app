# Phase 5: Center-Based Data Restriction - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Server-enforced center filtering on all data endpoints. Unauthorized center data never leaves the server. Local FHIR bundles and Blaze proxy responses are filtered server-side before reaching the client. Data API endpoints validate center permissions on write operations. CohortBuilder shows only permitted centers.

</domain>

<decisions>
## Implementation Decisions

### FHIR Data Filtering Architecture
- **D-01:** New server-side FHIR proxy at /api/fhir/bundles — server loads bundles (local) or proxies Blaze, filters by user's centers from JWT, returns only permitted FHIR bundles to client
- **D-02:** Local FHIR bundles: server reads center-*.json from data/ directory on disk, filters to only bundles matching user's centers, serves via API. Bundle files no longer exposed as static assets.
- **D-03:** Blaze FHIR proxy: server fetches all resources from Blaze, then filters by Patient.meta.source matching user's center IDs (same logic as existing extractCenters()). Post-fetch filtering, not query-param filtering.
- **D-04:** Client-side dataSource.ts replaced with server API calls — DataContext fetches pre-filtered data from /api/fhir/bundles instead of loading bundles directly
- **D-05:** API returns filtered FHIR bundles (standard FHIR format) — client-side fhirLoader.ts still extracts PatientCases, centers, etc. from the response
- **D-06:** Single /api/fhir/bundles endpoint returns all filtered bundles in one call
- **D-07:** Server caches loaded FHIR bundles in memory — load once on first request, serve filtered subsets from cache. Invalidate on settings change (data source switch).
- **D-08:** Remove Vite dev proxy for /fhir/* — all FHIR access goes through Express /api/fhir/* in both dev and prod. Consistent behavior, center filtering always active.

### Data API Center Enforcement
- **D-09:** Per-user scoping on /api/data/* is sufficient — quality flags, saved searches, etc. are already per-user via req.auth.preferred_username. No additional center-based scoping needed on these endpoints.
- **D-10:** Validate case IDs on write operations — when user creates a quality flag or saves a search referencing a case ID, server checks that case belongs to user's permitted centers. Return 403 if not. Read operations return user's own data (already safe).
- **D-11:** req.auth.centers already available from authMiddleware — handlers that need center checks read req.auth.centers directly. No new middleware abstraction needed.

### Admin & Bypass Behavior
- **D-12:** Bypass condition: role === 'admin' OR user's centers array includes all valid centers (all 5 org-* IDs). Two paths to full access.
- **D-13:** Bypass means server skips filtering entirely — return everything without running filter logic. Check bypass first, then filter if not bypassed.
- **D-14:** Only admin role gets automatic bypass. Other roles (clinic_lead, epidemiologist, etc.) with all centers get bypass through their centers array, not through role-based exception. Principle of least privilege.

### Client-Side Behavior
- **D-15:** CohortBuilder center filter dropdown shows only permitted centers — since server returns only permitted data, extractCenters() from the response yields only the user's centers. No non-permitted centers visible.
- **D-16:** Trust server completely, remove redundant client-side center filtering — server only returns permitted data, so client-side filtering is unnecessary. CohortBuilder filter operates on already-permitted data.
- **D-17:** Client derives permitted centers from server response data — extractCenters() already extracts centers from FHIR bundles. No extra API call or JWT decoding needed.

### Claude's Discretion
- Server-side FHIR loading implementation details (file reading, HTTP client for Blaze)
- Cache invalidation strategy (timer-based, event-based, or on-demand)
- Error handling for Blaze connectivity failures during center-filtered proxy
- How to map center-*.json filenames to org-* center IDs
- Whether to move FHIR loading logic to a new server module or extend existing files

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Server-side auth & filtering
- `server/authMiddleware.ts` — AuthPayload type with centers: string[], JWT validation, req.auth attachment
- `server/authApi.ts` — VALID_CENTERS allowlist (org-uka..org-ukm), signSessionToken() includes centers in JWT
- `server/dataApi.ts` — Existing per-user data endpoints; add case ID validation on writes (D-10)
- `server/index.ts` — Server setup, mount points, seed data with center assignments per user

### FHIR data loading (current client-side, to be moved server-side)
- `src/services/dataSource.ts` — loadBundlesFromSource(), local file discovery (center-*.json), Blaze loader, DataSourceConfig
- `src/services/fhirLoader.ts` — extractCenters(), extractPatientCases(), CENTER_SHORTHANDS, applyFilters() with center filtering
- `src/context/DataContext.tsx` — DataProvider, FHIR data state, calls loadAllBundles()

### Client center UI
- `src/pages/CohortBuilderPage.tsx` — Center filter checkboxes (lines 263-295), uses centers from DataContext
- `src/types/fhir.ts` — CenterInfo, PatientCase, CohortFilter type definitions

### Auth integration
- `src/services/authHeaders.ts` — getAuthHeaders() for Bearer token on API calls
- `server/initAuth.ts` — UserRecord type with centers: string[]

### Build & dev config
- `vite.config.ts` — Dev proxy for /fhir/* (to be removed per D-08)

### Requirements
- `.planning/REQUIREMENTS.md` — CENTER-01..09

### Prior phase decisions
- `.planning/phases/04-user-management-data-persistence/04-CONTEXT.md` — D-07 (SQLite data.db), D-09 (DataContext fetch pattern), D-10 (fire-and-sync mutations)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/authMiddleware.ts:AuthPayload` — Already includes centers array; handlers can use req.auth.centers directly
- `server/authApi.ts:VALID_CENTERS` — Set of valid center IDs; reuse for bypass check (D-12)
- `src/services/fhirLoader.ts:extractCenters()` — Center extraction logic; reference for server-side filtering
- `src/services/fhirLoader.ts:CENTER_SHORTHANDS` — Maps org-uka→UKA etc.; server needs this mapping for local file loading
- `src/services/dataSource.ts:discoverLocalFiles()` — Lists center-*.json files; move this logic server-side
- `src/services/dataSource.ts:loadFromBlaze()` — Blaze fetching with pagination; move to server-side proxy

### Established Patterns
- Express Router pattern (authApi.ts, dataApi.ts) — new fhirApi router follows same pattern
- Auth middleware attaches req.auth with username, role, centers — all endpoints have center info
- DataContext parallel fetch on mount (D-09 from Phase 4) — same pattern for new /api/fhir/bundles call
- better-sqlite3 patterns in auditDb.ts/dataDb.ts — reference for any new data layer

### Integration Points
- `server/index.ts` — Mount new /api/fhir routes (after auth middleware)
- `src/context/DataContext.tsx` — Replace loadAllBundles() with fetch to /api/fhir/bundles
- `src/services/dataSource.ts` — Remove or repurpose (FHIR loading moves server-side)
- `vite.config.ts` — Remove /fhir dev proxy

</code_context>

<specifics>
## Specific Ideas

- Server-side FHIR proxy: single /api/fhir/bundles endpoint replaces both local file serving and Blaze proxy
- Memory cache with invalidation on settings change avoids re-reading files on every request
- Patient.meta.source is the center identifier across the codebase (extractCenters uses it, CENTER_SHORTHANDS maps it)
- Local bundle filenames (center-aachen.json etc.) need mapping to org-* IDs for permission checking
- Bypass check: `if (role === 'admin' || userCenters.length >= VALID_CENTERS.size)` — simple condition before filtering

</specifics>

<deferred>
## Deferred Ideas

- Center-based data API restrictions beyond case ID validation (full resource-level center scoping) — unnecessary given per-user isolation
- Blaze query-param filtering (pushing center filter to FHIR server) — depends on Blaze support, optimize later if needed
- Per-center data.db isolation (separate databases per center) — per-user is sufficient for v1

None beyond planned phases — discussion stayed within Phase 5 scope.

</deferred>

---

*Phase: 05-center-based-data-restriction*
*Context gathered: 2026-04-10*
