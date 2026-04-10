# Phase 5: Center-Based Data Restriction - Research

**Researched:** 2026-04-10
**Domain:** Server-side FHIR data filtering, Express router patterns, center permission enforcement
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**FHIR Data Filtering Architecture**
- D-01: New server-side FHIR proxy at /api/fhir/bundles — server loads bundles (local) or proxies Blaze, filters by user's centers from JWT, returns only permitted FHIR bundles to client
- D-02: Local FHIR bundles: server reads center-*.json from data/ directory on disk, filters to only bundles matching user's centers, serves via API. Bundle files no longer exposed as static assets.
- D-03: Blaze FHIR proxy: server fetches all resources from Blaze, then filters by Patient.meta.source matching user's center IDs (same logic as existing extractCenters()). Post-fetch filtering, not query-param filtering.
- D-04: Client-side dataSource.ts replaced with server API calls — DataContext fetches pre-filtered data from /api/fhir/bundles instead of loading bundles directly
- D-05: API returns filtered FHIR bundles (standard FHIR format) — client-side fhirLoader.ts still extracts PatientCases, centers, etc. from the response
- D-06: Single /api/fhir/bundles endpoint returns all filtered bundles in one call
- D-07: Server caches loaded FHIR bundles in memory — load once on first request, serve filtered subsets from cache. Invalidate on settings change (data source switch).
- D-08: Remove Vite dev proxy for /fhir/* — all FHIR access goes through Express /api/fhir/* in both dev and prod. Consistent behavior, center filtering always active.

**Data API Center Enforcement**
- D-09: Per-user scoping on /api/data/* is sufficient — quality flags, saved searches, etc. are already per-user via req.auth.preferred_username. No additional center-based scoping needed on these endpoints.
- D-10: Validate case IDs on write operations — when user creates a quality flag or saves a search referencing a case ID, server checks that case belongs to user's permitted centers. Return 403 if not. Read operations return user's own data (already safe).
- D-11: req.auth.centers already available from authMiddleware — handlers that need center checks read req.auth.centers directly. No new middleware abstraction needed.

**Admin & Bypass Behavior**
- D-12: Bypass condition: role === 'admin' OR user's centers array includes all valid centers (all 5 org-* IDs). Two paths to full access.
- D-13: Bypass means server skips filtering entirely — return everything without running filter logic. Check bypass first, then filter if not bypassed.
- D-14: Only admin role gets automatic bypass. Other roles (clinic_lead, epidemiologist, etc.) with all centers get bypass through their centers array, not through role-based exception. Principle of least privilege.

**Client-Side Behavior**
- D-15: CohortBuilder center filter dropdown shows only permitted centers — since server returns only permitted data, extractCenters() from the response yields only the user's centers. No non-permitted centers visible.
- D-16: Trust server completely, remove redundant client-side center filtering — server only returns permitted data, so client-side filtering is unnecessary. CohortBuilder filter operates on already-permitted data.
- D-17: Client derives permitted centers from server response data — extractCenters() already extracts centers from FHIR bundles. No extra API call or JWT decoding needed.

### Claude's Discretion
- Server-side FHIR loading implementation details (file reading, HTTP client for Blaze)
- Cache invalidation strategy (timer-based, event-based, or on-demand)
- Error handling for Blaze connectivity failures during center-filtered proxy
- How to map center-*.json filenames to org-* center IDs
- Whether to move FHIR loading logic to a new server module or extend existing files

### Deferred Ideas (OUT OF SCOPE)
- Center-based data API restrictions beyond case ID validation (full resource-level center scoping) — unnecessary given per-user isolation
- Blaze query-param filtering (pushing center filter to FHIR server) — depends on Blaze support, optimize later if needed
- Per-center data.db isolation (separate databases per center) — per-user is sufficient for v1
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CENTER-01 | User's assigned centers stored in JWT payload and in data/users.json | JWT already carries centers array; users.json has centers field. **CRITICAL: users.json currently stores shorthands (UKA, UKB) not org-* IDs (org-uka, org-ukb) — requires data migration in this phase.** |
| CENTER-02 | Server-side FHIR data endpoint filters cases by user's centers before sending to client | New fhirApi.ts router with /api/fhir/bundles endpoint; reads req.auth.centers, filters bundles before response |
| CENTER-03 | Server-side center permission check on all data API endpoints (/api/data/*) — reject requests for data outside user's centers with 403 | Case ID validation on write operations in dataApi.ts; requires the FHIR cache to be queryable by caseId→centerId |
| CENTER-04 | Local FHIR bundle loading: server loads only bundles matching user's centers | Server reads center-*.json from public/data/ using filename→org-ID map; filters to user's centers |
| CENTER-05 | Blaze FHIR proxy: server filters response resources by Patient.meta.source matching user's center IDs | Server fetches all resources from Blaze, filters entries where Patient.meta.source is in req.auth.centers |
| CENTER-06 | Admin users and users with all centers assigned bypass center filtering | Bypass check: role === 'admin' OR centers.length >= VALID_CENTERS.size |
| CENTER-07 | Frontend DataContext receives pre-filtered data from server — client-side filtering is defense-in-depth only | Replace loadAllBundles() with fetch('/api/fhir/bundles') in DataContext.tsx |
| CENTER-08 | CohortBuilder center filter only shows centers the user has permission for | No code change needed — extractCenters() already reads from returned bundles; server returns only permitted bundles |
| CENTER-09 | Center permission enforced at API layer (authMiddleware extracts centers from JWT, passes to handlers) | authMiddleware already populates req.auth.centers; fhirApi reads it directly per D-11 |
</phase_requirements>

---

## Summary

Phase 5 moves FHIR data loading from the client to the server, adding center-based access control as data travels through the new `/api/fhir/bundles` endpoint. All the necessary building blocks already exist in the codebase: `req.auth.centers` from the JWT, `CENTER_SHORTHANDS` mapping in fhirLoader.ts, the local file discovery logic in dataSource.ts, and the Blaze pagination loop. The work is primarily about assembling these pieces server-side in a new `server/fhirApi.ts` router, then wiring DataContext to call it instead of loading bundles directly.

There is one critical data integrity issue discovered during research: the existing `data/users.json` and seed data in `server/index.ts` use **shorthand center codes** (`"UKA"`, `"UKB"`) while `VALID_CENTERS` in authApi.ts and all FHIR resource metadata use **org-* IDs** (`"org-uka"`, `"org-ukb"`). The filtering logic in CENTER-02 through CENTER-05 uses `Patient.meta.source === req.auth.centers[i]` — this comparison will silently pass no data for all existing non-admin users unless the center IDs in users.json are migrated to org-* format before or during this phase.

**Primary recommendation:** Create `server/fhirApi.ts` following the existing Express Router pattern (authApi.ts, dataApi.ts), move FHIR loading logic from client dataSource.ts to server, add bypass check before filtering, migrate users.json center values to org-* IDs.

---

## Standard Stack

### Core (all already in the project)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| express | existing | HTTP router for /api/fhir/* | Follow Router pattern from authApi.ts/dataApi.ts |
| node:fs | built-in | Read center-*.json files from disk server-side | sync readFileSync acceptable at cache-fill time |
| node:path | built-in | Resolve data directory path | Use process.cwd() + dataDir from settings |
| jsonwebtoken | existing | JWT already decoded by authMiddleware; centers in req.auth | No new JWT work needed |

### Supporting (for Blaze proxy path)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node-fetch or built-in fetch | Node 18+ built-in | HTTP client for Blaze requests server-side | Used only when dataSource.type === 'blaze' |

**Note:** Node 18+ `fetch` is available globally. The existing server already uses it implicitly. No new dependencies required. [VERIFIED: server/index.ts imports show no HTTP client library — Blaze fetching currently happens client-side via browser fetch]

### No Additional Packages
This phase requires zero new npm dependencies. All required capabilities exist in the project or Node.js built-ins. [VERIFIED: codebase inspection]

---

## Architecture Patterns

### Recommended Project Structure

New file to create:
```
server/
├── fhirApi.ts           # NEW: /api/fhir/bundles endpoint + cache + filtering
├── authApi.ts           # existing: reference for Router pattern
├── dataApi.ts           # existing: reference for per-user patterns, add case validation
├── index.ts             # existing: mount /api/fhir after authMiddleware
```

Client changes:
```
src/
├── context/
│   └── DataContext.tsx  # Replace loadAllBundles() with fetch('/api/fhir/bundles')
├── services/
│   └── dataSource.ts    # Remove or gut — FHIR loading moves server-side
```

Config change:
```
vite.config.ts           # Remove /fhir proxy entry
```

### Pattern 1: Express Router (matches authApi.ts / dataApi.ts)

```typescript
// server/fhirApi.ts — follows exact pattern of dataApi.ts
import { Router } from 'express';
import type { Request, Response } from 'express';

export const fhirApiRouter = Router();

fhirApiRouter.get('/bundles', (req: Request, res: Response): void => {
  const { role, centers } = req.auth!;
  // bypass check first (D-13)
  const bypass = role === 'admin' || centers.length >= VALID_CENTERS.size;
  const bundles = getCachedBundles(); // module-level cache (D-07)
  const filtered = bypass ? bundles : filterBundlesByCenters(bundles, centers);
  res.json({ bundles: filtered });
});
```

[VERIFIED: codebase inspection of authApi.ts, dataApi.ts]

### Pattern 2: Module-Level Cache with Invalidation (D-07)

```typescript
// server/fhirApi.ts
let _bundleCache: FhirBundle[] | null = null;

/** Call after settings change (data source switch) */
export function invalidateFhirCache(): void {
  _bundleCache = null;
}

async function getCachedBundles(): Promise<FhirBundle[]> {
  if (_bundleCache) return _bundleCache;
  _bundleCache = await loadBundlesFromServer(); // reads disk or proxies Blaze
  return _bundleCache;
}
```

This mirrors the existing client-side pattern in `fhirLoader.ts` (lines 17-25) exactly.

### Pattern 3: Filename-to-OrgID Mapping (D-04, Claude's Discretion)

**Verified mapping from codebase inspection of actual bundle files:**

| Filename | OrgID |
|----------|-------|
| center-aachen.json | org-uka |
| center-bonn.json | org-ukb |
| center-muenchen.json | org-lmu |
| center-tuebingen.json | org-ukt |
| center-muenster.json | org-ukm |

[VERIFIED: inspected each bundle file's Organization resource]

**Implementation approach:** Read the Organization resource from each bundle to determine its org-ID dynamically, OR use a hardcoded map. Dynamic reading is more robust:

```typescript
function getOrgIdFromBundle(bundle: FhirBundle): string | null {
  const orgEntry = bundle.entry.find(e => e.resource.resourceType === 'Organization');
  return orgEntry ? orgEntry.resource.id : null;
}
```

This is safer than a hardcoded filename map — if a new center file is added, it works automatically.

### Pattern 4: Bypass Check (D-12, D-13, D-14)

```typescript
const VALID_CENTERS = new Set(['org-uka', 'org-ukb', 'org-lmu', 'org-ukt', 'org-ukm']);

function isBypass(role: string, centers: string[]): boolean {
  return role === 'admin' || centers.length >= VALID_CENTERS.size;
}
```

Import `VALID_CENTERS` from authApi.ts or redefine it in fhirApi.ts (small duplication is acceptable; the set is small and stable).

### Pattern 5: DataContext FHIR Fetch (D-04, D-07)

Replace `loadAllBundles()` call in DataContext.tsx with:

```typescript
// In fetchData() callback, replacing loadAllBundles():
const headers = getAuthHeaders();
const resp = await fetch('/api/fhir/bundles', { headers });
if (!resp.ok) throw new Error(`FHIR bundles: ${resp.status}`);
const data = await resp.json() as { bundles: FhirBundle[] };
// bundles, centers, cases extraction unchanged — fhirLoader.ts still used
setBundles(data.bundles);
setCenters(extractCenters(data.bundles));
setCases(extractPatientCases(data.bundles));
```

### Pattern 6: Local Bundle Loading Server-Side (D-02, D-04)

```typescript
// server/fhirApi.ts — server-side equivalent of dataSource.ts:discoverLocalFiles()
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'public', 'data');

function loadLocalBundles(): FhirBundle[] {
  const bundles: FhirBundle[] = [];
  const candidates = [
    'center-aachen.json', 'center-bonn.json', 'center-muenchen.json',
    'center-tuebingen.json', 'center-muenster.json',
  ];
  // Also check manifest.json
  const manifestPath = path.join(DATA_DIR, 'manifest.json');
  const files = fs.existsSync(manifestPath)
    ? (JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as string[])
    : candidates.filter(f => fs.existsSync(path.join(DATA_DIR, f)));

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    if (fs.existsSync(filePath)) {
      bundles.push(JSON.parse(fs.readFileSync(filePath, 'utf-8')) as FhirBundle);
    }
  }
  return bundles;
}
```

**Note:** FHIR bundles are in `public/data/` (served as static assets currently), not in the `data/` runtime directory. The planner must be explicit about which directory: `public/data/` for FHIR bundles, `data/` for runtime data (users.json, audit.db, data.db).

### Pattern 7: Blaze Proxy Server-Side (D-03, D-05)

Move the pagination loop from client `dataSource.ts:loadFromBlaze()` to server. Use Node.js built-in `fetch` (available in Node 18+). The server already imports nothing for HTTP client — use global `fetch`.

```typescript
async function loadBlazeResources(blazeUrl: string): Promise<FhirBundle[]> {
  const RESOURCE_TYPES = [
    { type: 'Patient', count: 500 },
    { type: 'Condition', count: 1000 },
    { type: 'Observation', count: 5000 },
    { type: 'Procedure', count: 2000 },
    { type: 'MedicationStatement', count: 1000 },
    { type: 'ImagingStudy', count: 500 },
    { type: 'Organization', count: 50 },
  ];
  const allResources: FhirResource[] = [];
  for (const { type, count } of RESOURCE_TYPES) {
    const resources = await fetchAllPages(`${blazeUrl}/${type}?_count=${count}`);
    allResources.push(...resources);
  }
  // Return as single synthetic bundle (same as client-side logic)
  return [{ resourceType: 'Bundle', type: 'searchset',
    meta: { lastUpdated: new Date().toISOString(), source: blazeUrl },
    entry: allResources.map(r => ({ resource: r })) }];
}
```

Blaze errors (connectivity failure) should be caught and returned as 502 with a descriptive JSON body. Do not propagate the raw Blaze error message to clients.

### Pattern 8: Case ID Validation on Writes (D-10, CENTER-03)

For `/api/data/quality-flags` PUT and `/api/data/saved-searches` POST, the handler needs to verify that referenced caseIds belong to the user's permitted centers. This requires the server to know which centerId a caseId belongs to — this information comes from the FHIR bundle cache.

```typescript
// in dataApi.ts: validate caseId before write
function getCenterForCase(caseId: string): string | null {
  return getFhirCaseIndex().get(caseId) ?? null; // caseId → centerId lookup
}

// In quality-flags PUT:
for (const flag of qualityFlags) {
  const caseCenterId = getCenterForCase(flag.caseId);
  if (caseCenterId && !bypass && !userCenters.includes(caseCenterId)) {
    res.status(403).json({ error: `Case ${flag.caseId} not in user's permitted centers` });
    return;
  }
}
```

**Key design decision (Claude's discretion):** The FHIR module must expose a `caseId → centerId` index for use by dataApi.ts. This means fhirApi.ts exports a function like `getCaseToCenter(): Map<string, string>` that dataApi.ts can call.

### Anti-Patterns to Avoid

- **Filtering in the client after receiving full data:** The whole point is server-side filtering — never return unfiltered bundles and rely on the client to hide unauthorized data.
- **Using the Vite dev proxy for center-filtered FHIR:** D-08 explicitly removes the /fhir Vite proxy. In dev, all FHIR goes through Express /api/fhir/bundles too.
- **Hardcoding center/filename mapping without verifying against actual bundles:** Use dynamic org-ID extraction from the bundle's Organization resource as primary approach; hardcoded map as fallback only.
- **Not invalidating cache on settings change:** If the data source changes from local to blaze (or vice versa), the old cached bundles are stale and will serve wrong data.
- **Treating `_bundleCache` as a per-user cache:** The cache stores ALL bundles (unfiltered). Filtering happens at request time, per user. The cache is the expensive I/O operation; filtering is cheap in-memory.

---

## Critical Finding: Center ID Format Mismatch

**This is a blocking issue for Phase 5.**

**What was found:** `data/users.json` and `server/index.ts` seed data store center values as **shorthand codes** (`"UKA"`, `"UKB"`, `"LMU"`, `"UKT"`, `"UKM"`). The JWT payload carries these values via `signSessionToken()` in authApi.ts.

**What FHIR data uses:** `Patient.meta.source` stores **org-* IDs** (`"org-uka"`, `"org-ukb"`, `"org-lmu"`, `"org-ukt"`, `"org-ukm"`). The `VALID_CENTERS` set in authApi.ts also uses org-* IDs.

**Impact:** If filtering compares `req.auth.centers` (containing `"UKA"`) against `Patient.meta.source` (containing `"org-uka"`), the comparison always fails. Non-admin users would receive zero data.

**Contradiction in authApi.ts:** The comment on `VALID_CENTERS` says "Must match CENTER_SHORTHANDS keys in fhirLoader.ts" — but `CENTER_SHORTHANDS` keys ARE the org-* IDs (`'org-uka': 'UKA'`). The VALID_CENTERS set correctly uses org-* IDs; the users.json seed data incorrectly uses the shorthand values.

**Resolution (two sub-tasks required):**
1. Migrate `data/users.json` center values from shorthand to org-* format (one-time data migration)
2. Update `server/index.ts` seed data to use org-* IDs for future installs
3. The `initAuth.ts:_migrateUsersJson()` function is a good template for adding a center-format migration step

[VERIFIED: inspected users.json, authApi.ts VALID_CENTERS, fhirLoader.ts CENTER_SHORTHANDS, all actual bundle files]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FHIR bundle filtering by center | Custom recursive FHIR parser | Filter by `Patient.meta.source` and cascade to linked resources | extractCenters() in fhirLoader.ts already shows the pattern; Patient.meta.source is the established center identifier |
| Case ID → center lookup | Re-read files per request | Module-level Map built at cache-fill time | O(1) lookup; avoid file I/O on every quality-flag write |
| HTTP client for Blaze | Import axios/node-fetch | Node 18+ built-in `fetch` | Already the runtime; zero new dependencies |
| Center ID validation | Custom validation logic | Reuse `VALID_CENTERS` from authApi.ts | Single source of truth for valid center codes |
| FHIR bundle file discovery | glob or recursive fs.walk | Read manifest.json first, fallback to well-known filenames | Same pattern already in client dataSource.ts; manifest.json already exists in public/data/ |

**Key insight:** The client already has all the logic needed (dataSource.ts, fhirLoader.ts). The server work is mostly a port of that logic — different runtime (Node.js fs vs browser fetch), same data model.

---

## Common Pitfalls

### Pitfall 1: Filtering Only Patients, Not Linked Resources
**What goes wrong:** Server filters Patient resources by meta.source but returns all Condition/Observation/Procedure resources — a user sees clinical data for patients they have no access to by following the resource reference.
**Why it happens:** Filtering is applied at the Patient list, not at the entry level of the bundle.
**How to avoid:** When filtering a bundle, either (a) remove all non-Patient entries whose patient reference points to a patient not in the permitted set, or (b) filter at the whole-bundle level (local files: include/exclude entire center bundle; Blaze: build permitted-patient-ID set, then filter all entries). For local bundles (one bundle per center), filtering is trivially: include or exclude the entire bundle. For Blaze (one synthetic bundle with all resources), you must build a `Set<string>` of permitted patient IDs and filter all entries.
**Warning signs:** A restricted user can see Conditions or Observations in the UI but no Patient demographics.

### Pitfall 2: Cache Not Invalidated After Settings Change
**What goes wrong:** Admin switches data source from `local` to `blaze` (or changes blazeUrl). Server continues to serve cached local bundles indefinitely.
**Why it happens:** The cache has no TTL or event-based invalidation.
**How to avoid:** The settings PUT handler (`server/settingsApi.ts`) must call `invalidateFhirCache()` after a successful write. This requires settingsApi to import from fhirApi — check for circular dependency risk. Alternative: emit an event or use a shared module-level flag.
**Warning signs:** Changing data source in the UI has no effect on the data shown.

### Pitfall 3: Center ID Format Mismatch (documented above)
**What goes wrong:** JWT carries shorthand codes; filtering compares them against org-* IDs; all non-admin users get zero results.
**How to avoid:** Migrate users.json before or as part of this phase. Confirm the mapping: `UKA→org-uka`, `UKB→org-ukb`, `LMU→org-lmu`, `UKT→org-ukt`, `UKM→org-ukm`.

### Pitfall 4: Vite Dev Server Not Routing /api/fhir/* to Express
**What goes wrong:** In dev mode, the Vite dev server handles requests. Without configuration, `/api/fhir/bundles` won't reach Express.
**Why it happens:** vite.config.ts currently proxies `/fhir` but not `/api/fhir`. The new endpoint is at `/api/fhir/bundles` — this goes through the existing `/api` proxy (if one exists) or needs one added.
**How to avoid:** Check vite.config.ts. Currently it only proxies `/fhir` (which will be removed per D-08). Add a `/api` proxy to Vite config pointing at Express, or verify the existing issueApiPlugin/settingsApiPlugin pattern handles this. The existing server plugins (issueApiPlugin, settingsApiPlugin) intercept directly in Vite's middleware chain — fhirApi should follow the same approach for dev, OR the Express dev server should be started separately.
**Warning signs:** 404 from `/api/fhir/bundles` in dev, 200 in prod.

**Investigation needed:** The current authApi, dataApi, auditApi — they use Express Router mounted in `server/index.ts` (the production server). In dev, how do they reach Express? Looking at vite.config.ts, it only has `issueApiPlugin()` and `settingsApiPlugin()` as Vite plugins. The other routes (authApi, dataApi, auditApi) are NOT available as Vite plugins. **This means the dev server currently only supports issue and settings endpoints — all other server routes require running the production build.** The fhirApi will be in the same boat. The planner should document this as-is, not try to fix it in this phase.

[VERIFIED: vite.config.ts inspection; server/index.ts inspection]

### Pitfall 5: DataContext Fetch Before Auth Token Exists
**What goes wrong:** DataContext calls `/api/fhir/bundles` on mount, but the user may not be logged in yet (no JWT in sessionStorage).
**Why it happens:** `fetchData()` in DataContext is called from `useEffect` on mount, independent of auth state.
**How to avoid:** The existing `fetchPersistedData` already gates on `if (!user) return;` — apply the same guard to the FHIR fetch. Or rely on the server returning 401, and handle it as an error in the catch block (already done via `setError()`). The existing error handling is adequate.

### Pitfall 6: FHIR Bundle Files Location
**What goes wrong:** Server reads from `data/center-*.json` instead of `public/data/center-*.json`.
**Why it happens:** There are two data directories: `data/` (runtime: users.json, audit.db, data.db) and `public/data/` (FHIR bundles, manifest.json). They serve different purposes.
**How to avoid:** FHIR bundles are in `public/data/`. The server path is `path.resolve(process.cwd(), 'public', 'data')`. Do not use the runtime `DATA_DIR` (which points to `./data`).

---

## Code Examples

### Bypass Check
```typescript
// Source: authApi.ts VALID_CENTERS + CONTEXT.md D-12
const VALID_CENTERS = new Set(['org-uka', 'org-ukb', 'org-lmu', 'org-ukt', 'org-ukm']);

function isBypass(role: string, centers: string[]): boolean {
  // Admin always bypasses; users with all centers bypass via their assignment (D-14)
  return role === 'admin' || centers.length >= VALID_CENTERS.size;
}
```

### Filter Bundles by Permitted Centers
```typescript
// Source: fhirLoader.ts extractCenters() pattern + CONTEXT.md D-03
function filterBundlesByCenters(bundles: FhirBundle[], userCenters: string[]): FhirBundle[] {
  const permitted = new Set(userCenters);
  const result: FhirBundle[] = [];

  for (const bundle of bundles) {
    // Get the org ID from this bundle's Organization resource
    const orgEntry = bundle.entry.find(e => e.resource.resourceType === 'Organization');
    const orgId = orgEntry?.resource.id;

    if (orgId && !permitted.has(orgId)) {
      // Entire bundle is for a non-permitted center — skip
      continue;
    }

    if (!orgId) {
      // Synthetic Blaze bundle: filter by Patient.meta.source (D-05)
      const permittedPatientIds = new Set<string>();
      const filteredEntries = bundle.entry.filter(e => {
        if (e.resource.resourceType === 'Patient') {
          if (permitted.has(e.resource.meta?.source ?? '')) {
            permittedPatientIds.add(e.resource.id);
            return true;
          }
          return false;
        }
        // For non-Patient resources, keep if subject references a permitted patient
        // (resources reference patients as "Patient/ID")
        const ref = (e.resource as { subject?: { reference?: string } }).subject?.reference;
        if (ref) {
          const patientId = ref.startsWith('Patient/') ? ref.slice(8) : ref;
          return permittedPatientIds.has(patientId);
        }
        // Organization and other top-level resources: keep them
        return true;
      });
      result.push({ ...bundle, entry: filteredEntries });
    } else {
      result.push(bundle); // Entire center bundle is permitted
    }
  }
  return result;
}
```

**Note:** For local bundles (one per center, each with one Organization), the filter is trivially include/exclude the whole bundle. The `orgId` check handles this. The Blaze path (no orgId in synthetic bundle) uses Patient.meta.source filtering with cascaded exclusion of linked resources.

### Center ID Migration in users.json
```typescript
// To be run in initAuth.ts or a migration step in server/index.ts
const SHORTHAND_TO_ORG: Record<string, string> = {
  'UKA': 'org-uka', 'UKB': 'org-ukb', 'LMU': 'org-lmu',
  'UKT': 'org-ukt', 'UKM': 'org-ukm',
};

function migrateCenterIds(users: UserRecord[]): { users: UserRecord[], changed: boolean } {
  let changed = false;
  const migrated = users.map(u => {
    const newCenters = u.centers.map(c => SHORTHAND_TO_ORG[c] ?? c);
    if (newCenters.some((c, i) => c !== u.centers[i])) changed = true;
    return { ...u, centers: newCenters };
  });
  return { users: migrated, changed };
}
```

### Mount fhirApiRouter in server/index.ts
```typescript
// After: app.use('/api/data', dataApiRouter);
// Add:
import { fhirApiRouter, invalidateFhirCache } from './fhirApi.js';
app.use('/api/fhir', fhirApiRouter);
// When settings change: call invalidateFhirCache() from settingsApi PUT handler
```

### DataContext: Replace loadAllBundles
```typescript
// src/context/DataContext.tsx — fetchData callback
const fetchData = useCallback(() => {
  setFhirLoading(true);
  setError(null);
  if (!user) { setFhirLoading(false); return; }
  fetch('/api/fhir/bundles', { headers: getAuthHeaders() })
    .then(r => {
      if (!r.ok) throw new Error(`FHIR bundles: ${r.status}`);
      return r.json() as Promise<{ bundles: FhirBundle[] }>;
    })
    .then(data => {
      setBundles(data.bundles);
      setCenters(extractCenters(data.bundles));
      setCases(extractPatientCases(data.bundles));
      setFhirLoading(false);
    })
    .catch(err => {
      setError(err instanceof Error ? err.message : String(err));
      setFhirLoading(false);
    });
}, [user]);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client loads FHIR bundles directly from /data/*.json static files | Server loads and filters bundles, client receives only permitted data | This phase | Eliminates client-side trust; center filtering becomes server-enforced |
| Vite dev proxy forwards /fhir to Blaze | Express /api/fhir/* handles FHIR in both dev and prod | This phase (D-08) | Consistent behavior; center filtering always active |
| Client-side center filtering in CohortBuilder (applyFilters) | Client shows only what server sends; server is the enforcement point | This phase | Client filter becomes optional UX feature, not security control |

**Deprecated/outdated after this phase:**
- `/fhir/*` Vite dev proxy: remove from vite.config.ts
- `src/services/dataSource.ts:loadBundlesFromSource()`: remove or repurpose for test use only
- `src/services/fhirLoader.ts:loadAllBundles()`: replace call in DataContext with API fetch
- `public/data/` directory served as static assets (FHIR bundles): still present but no longer the primary access path — bundles accessed via /api/fhir/bundles

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Node 18+ built-in `fetch` is available for server-side Blaze requests | Standard Stack | If Node < 18 is used, need to add node-fetch package |
| A2 | public/data/ is the correct location for FHIR bundle files on the production server | Architecture Patterns | Wrong directory means server cannot find bundle files |
| A3 | The Blaze synthetic bundle has no top-level Organization resource (all resources in flat entry list) | Code Examples (filtering) | If Blaze returns per-center bundles with Organization resources, the filtering branch logic needs adjustment |
| A4 | settingsApi.ts can import from fhirApi.ts without circular dependency | Common Pitfalls | If circular, need event-based invalidation instead |

---

## Open Questions

1. **How does /api/fhir/bundles reach Express in dev mode?**
   - What we know: Vite dev server uses `issueApiPlugin()` and `settingsApiPlugin()` as Vite middleware plugins. Other API routes (authApi, dataApi) appear to only be available when running the Express production server.
   - What's unclear: Do developers currently run `npm run dev` or the Express server for testing auth/data endpoints? The plan needs to address dev vs. prod parity.
   - Recommendation: The new fhirApiRouter should also be exposed as a Vite plugin (following issueApiPlugin pattern) for dev parity, or the README should clarify that dev requires the Express server.

2. **Should center format migration (shorthand→org-*) happen at startup or at first login?**
   - What we know: `initAuth.ts:_migrateUsersJson()` runs at startup and already transforms users.json.
   - What's unclear: Startup migration is safest (applies before any request is served). First-login migration risks race conditions.
   - Recommendation: Add migration to `_migrateUsersJson()` in initAuth.ts — it runs at startup, already has the atomic write pattern, and is the established migration point.

3. **What happens to quality flags / saved searches for caseIds that become inaccessible after center reassignment?**
   - What we know: Case ID validation on writes (D-10) blocks new flags for inaccessible cases. Existing flags are per-user in dataDb.
   - What's unclear: If a user loses center access (admin changes their centers), their existing quality flags for cases in that center remain in dataDb but the caseIds won't validate against FHIR.
   - Recommendation: This is a deferred concern (per CONTEXT.md deferred section). For now, GET reads return all user's flags; the filter just prevents new ones. Flag this as a known limitation.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 18+ | Built-in fetch for Blaze proxy | ✓ | Confirm at runtime | Add node-fetch if < 18 |
| public/data/center-*.json | Local bundle loading (CENTER-04) | ✓ | 5 files present | — |
| public/data/manifest.json | File discovery | ✓ | Present | Fallback to hardcoded filenames |
| data/users.json | Center format migration | ✓ | Present (shorthand format) | — |

[VERIFIED: directory listing of /public/data/ and /data/]

**Missing dependencies with no fallback:** None.

**Data migration required:** `data/users.json` center values must be migrated from shorthand to org-* format. This is a data change, not a dependency installation.

---

## Validation Architecture

> `workflow.nyquist_validation` is absent from `.planning/config.json` — treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no test config files found in project |
| Config file | None (Wave 0 gap) |
| Quick run command | To be established in Wave 0 |
| Full suite command | To be established in Wave 0 |

[VERIFIED: glob search found no jest.config.*, vitest.config.*, pytest.ini, or __tests__/ directories]

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Notes |
|--------|----------|-----------|-------|
| CENTER-01 | centers in JWT match org-* format after migration | integration | Test that login returns JWT with org-* center IDs |
| CENTER-02 | /api/fhir/bundles returns only permitted bundles | integration | Mock req.auth with single-center user; verify bundle count/org IDs |
| CENTER-03 | Quality flag write with unauthorized caseId returns 403 | integration | Test with caseId from non-permitted center |
| CENTER-04 | Local bundle loading reads correct files | unit | Test getOrgIdFromBundle() + filterBundlesByCenters() |
| CENTER-05 | Blaze post-fetch filter removes non-permitted resources | unit | Test filterBundlesByCenters() with synthetic bundle |
| CENTER-06 | Admin bypasses center filtering | integration | Admin receives all bundles |
| CENTER-07 | DataContext fetches from /api/fhir/bundles (not file) | integration/smoke | Can be verified manually in dev |
| CENTER-08 | CohortBuilder shows only permitted centers | smoke | Derived from CENTER-02; no separate test needed |
| CENTER-09 | /api/fhir/bundles requires auth (returns 401 without JWT) | integration | Call without Authorization header |

### Wave 0 Gaps
- [ ] No test framework installed — establish vitest (matches existing Vite/TypeScript stack) or jest
- [ ] No test files exist — all test files are Wave 0 gaps
- [ ] `tests/fhirApi.test.ts` — covers CENTER-02, CENTER-04, CENTER-05, CENTER-06, CENTER-09
- [ ] `tests/centerMigration.test.ts` — covers CENTER-01 (migration logic)
- [ ] `tests/dataApiCenterValidation.test.ts` — covers CENTER-03

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | JWT validated by existing authMiddleware; no new auth paths |
| V3 Session Management | No | Session handling unchanged from Phase 2/4 |
| V4 Access Control | Yes — primary concern | Center membership check in fhirApiRouter; 403 on unauthorized caseId writes |
| V5 Input Validation | Yes | Validate req.auth.centers is an array before use; validate caseId strings |
| V6 Cryptography | No | No new crypto; JWT secret unchanged |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client-supplied caseId referencing unauthorized patient | Tampering | Server validates caseId → centerId against req.auth.centers before write (D-10) |
| JWT token with forged centers array | Spoofing | authMiddleware verifies JWT signature; centers come from verified payload only |
| Unauthorized FHIR bundle access | Information Disclosure | Server returns 401 if no JWT; returns only permitted bundles if JWT valid |
| Cache poisoning (stale unfiltered cache after settings change) | Information Disclosure | Explicit cache invalidation required on settings PUT |
| Bypass via large centers array | Elevation of Privilege | Bypass condition: `centers.length >= VALID_CENTERS.size` — only valid if user actually has all centers assigned; VALID_CENTERS is server-side constant, cannot be spoofed |

**Security note:** The bypass condition `centers.length >= VALID_CENTERS.size` assumes the centers array in the JWT only contains valid center IDs. The VALID_CENTERS validation in `POST /api/auth/users` ensures this for new users. However, existing users.json may have shorthand codes which are NOT in VALID_CENTERS — this means the bypass check `centers.length >= 5` would fail for admin (who has 5 shorthand codes, all failing VALID_CENTERS membership). This reinforces the urgency of the center ID migration.

---

## Sources

### Primary (HIGH confidence)
- `server/authMiddleware.ts` — AuthPayload type with centers: string[]; middleware behavior confirmed
- `server/authApi.ts` — VALID_CENTERS set, signSessionToken() including centers in JWT, Router pattern
- `server/dataApi.ts` — per-user data patterns, mutation lock pattern, write validation baseline
- `server/index.ts` — middleware mount order, seed data with shorthand center codes (bug)
- `server/dataDb.ts` — better-sqlite3 patterns, transaction usage
- `src/services/dataSource.ts` — loadBundlesFromSource(), discoverLocalFiles(), Blaze pagination loop
- `src/services/fhirLoader.ts` — extractCenters(), CENTER_SHORTHANDS, extractPatientCases()
- `src/context/DataContext.tsx` — loadAllBundles() call site, fetchData pattern, getAuthHeaders usage
- `public/data/*.json` — actual FHIR bundle structure verified; org-ID to filename mapping confirmed
- `data/users.json` — center format confirmed as shorthands (UKA, UKB) — mismatch with org-* IDs
- `vite.config.ts` — /fhir proxy confirmed present; /api/* NOT proxied via Vite plugins

### Secondary (MEDIUM confidence)
- `src/pages/CohortBuilderPage.tsx` lines 263-295 — center filter uses `centers` from DataContext; no changes needed as extractCenters() will naturally return only permitted centers from filtered bundles

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all code verified by direct inspection
- Architecture: HIGH — patterns derived from existing codebase; no external libraries
- Pitfalls: HIGH — center ID mismatch is a verified data bug, not speculation
- Center ID mismatch: HIGH — directly observed in users.json vs authApi.ts VALID_CENTERS

**Research date:** 2026-04-10
**Valid until:** 2026-06-10 (stable domain; only risk is upstream phases changing server patterns)
