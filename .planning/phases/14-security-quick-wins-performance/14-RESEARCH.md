# Phase 14: Security Quick Wins & Performance — Research

**Researched:** 2026-04-17
**Domain:** Express/Node.js security hardening + React/TypeScript chart accessibility + shared TypeScript performance refactor
**Confidence:** HIGH (all findings based on direct codebase reads, not training assumptions)

---

## Summary

Phase 14 delivers six independently implementable changes across three layers of the stack. All six are non-breaking: they add new behaviors without altering public API contracts or data shapes that tests depend on. The highest-value change is the JWT algorithm pin (SEC-01/SEC-02), which closes an algorithm-confusion attack window that exists as long as `jwt.verify()` runs without an `algorithms` option. The cohortHashSecret auto-generation (SEC-02) eliminates the current fatal-on-missing behavior by replicating the already-proven `jwt-secret.txt` file pattern. The forced password change (SEC-03) requires a new `UserRecord` field plus a new Express route and a POST-login guard. The O(N+M) refactor (PERF-01) is a pure internal transformation with identical output. Cache warming (PERF-02) is a single `getCachedBundles()` call inserted in `server/index.ts` after database init. The ARIA change (A11Y-01) is a single `aria-label` attribute added to the `<ResponsiveContainer>` wrapper div in `OutcomesPanel.tsx`.

All six changes are verified to be independent of each other and of Phase 15 (TOTP). They can be planned as sequential tasks within a single phase or parallelised.

**Primary recommendation:** Implement in dependency order: SEC-01 → SEC-02 → SEC-03 → PERF-01 → PERF-02 → A11Y-01. Each change is fast; total phase size is small.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | JWT algorithm pinned to HS256 on all local token verification call sites | Exactly 2 unpinned call sites confirmed by grep: `authMiddleware.ts:59` + `authApi.ts:181`. Keycloak path already pinned. |
| SEC-02 | `cohortHashSecret` auto-generated into `data/cohort-hash-secret.txt` on first startup if absent; settings fallback removed | `initHashCohortId` signature + call site in `index.ts:123` fully mapped. File-generation pattern from `initAuth.ts:60-68` is directly replicable. |
| SEC-03 | Users with default migrated password (`changeme2025!`) forced to change password on first login | `_migrateUsersJson` in `initAuth.ts:300-313` sets the default password. New `mustChangePassword?: boolean` field + enforcement route required. |
| PERF-01 | `extractPatientCases` refactored from O(N×M) to O(N+M) via Map pre-grouping | Five `.filter()` calls confirmed at `patientCases.ts:66-71`. Exact 5 resource types: conditions, observations, procedures, imagingStudies, medications. `groupBySubject<T>` pattern is the correct solution. |
| PERF-02 | FHIR bundle cache warmed on server startup immediately after databases are initialized | `getCachedBundles()` exported from `fhirApi.ts:368`. `_bundleCache` is `null` at startup. No warm call exists in `index.ts`. Correct insertion point is after `initDataDb(DATA_DIR)` (line 136). |
| A11Y-01 | All Recharts trajectory chart containers have `aria-label` attributes describing the metric name, eye side, and cohort patient count | `OutcomesPanel.tsx` has exactly **1** `ComposedChart` instance wrapped in `<ResponsiveContainer>`. The wrapping `<div>` (line 120) is the correct element to receive `aria-label`. Props `titleKey`, `eye`, `panel.summary.patientCount` are already available in scope. |
</phase_requirements>

---

## Confirmed Code Locations

### SEC-01: JWT Algorithm Pin

**Unpinned call sites (VERIFIED by grep):**

| File | Line | Code |
|------|------|------|
| `server/authMiddleware.ts` | 59 | `jwt.verify(token, getJwtSecret()) as AuthPayload` |
| `server/authApi.ts` | 181 | `jwt.verify(challengeToken, getJwtSecret()) as { sub: string; purpose?: string }` |

**Already pinned (do NOT touch):**

| File | Lines | Algorithm |
|------|-------|-----------|
| `server/authMiddleware.ts` | 101 | `{ algorithms: ['RS256'] }` — Keycloak path, correct |
| `server/authApi.ts` | 65 | `jwt.sign(..., { algorithm: 'HS256' })` — sign-only, not verify, no change |
| `server/authApi.ts` | 71 | `jwt.sign(..., { algorithm: 'HS256' })` — sign-only, not verify, no change |

**Exact change — authMiddleware.ts line 59:**
```typescript
// BEFORE:
const payload = jwt.verify(token, getJwtSecret()) as AuthPayload;

// AFTER:
const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as AuthPayload;
```

**Exact change — authApi.ts line 181:**
```typescript
// BEFORE:
const payload = jwt.verify(challengeToken, getJwtSecret()) as { sub: string; purpose?: string };

// AFTER:
const payload = jwt.verify(challengeToken, getJwtSecret(), { algorithms: ['HS256'] }) as { sub: string; purpose?: string };
```

**Test impact:** `authMiddlewareLocal.test.ts` currently signs tokens with `{ algorithm: 'HS256' }` — pinning will not break these tests. A new test case should assert that an RS256-signed token (wrong algorithm) is rejected with 401 when the server is in local mode.

---

### SEC-02: cohortHashSecret Auto-Generation

**Current state of `server/hashCohortId.ts` (VERIFIED by read):**
- `initHashCohortId(settings: Record<string, unknown>)` — single argument
- Reads `settings.audit.cohortHashSecret`
- Throws if missing or shorter than 32 characters
- No file fallback, no auto-generation

**Current call site in `server/index.ts` (line 123, VERIFIED):**
```typescript
initHashCohortId(settings);
```

**Pattern to replicate from `server/initAuth.ts` lines 60-68 (VERIFIED):**
```typescript
const secretFile = path.join(dataDir, 'jwt-secret.txt');
if (fs.existsSync(secretFile)) {
  _jwtSecret = fs.readFileSync(secretFile, 'utf-8').trim();
  if (!_jwtSecret) throw new Error('...');
} else {
  _jwtSecret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretFile, _jwtSecret, { encoding: 'utf-8', mode: 0o600 });
  console.log(`[initAuth] Generated new JWT secret at ${secretFile}`);
}
```

**New function signature:**
```typescript
export function initHashCohortId(dataDir: string, settings: Record<string, unknown>): void
```

**Behavior change:**
1. Check `data/cohort-hash-secret.txt` first (≥32 chars → use it)
2. Fall back to `settings.audit.cohortHashSecret` if file absent (backward compat for existing deployments)
3. Auto-generate `crypto.randomBytes(32).toString('hex')` (64 hex chars) if both absent
4. Write generated secret to `data/cohort-hash-secret.txt` with `mode: 0o600`
5. After auto-generation: no longer throw on missing settings value — the file is now the source of truth

**Call site change in `server/index.ts`:**
```typescript
// BEFORE (line 123):
initHashCohortId(settings);

// AFTER:
initHashCohortId(DATA_DIR, settings);
```

**Startup ordering: no reorder needed.** `initHashCohortId` stays at line 123, after `initAuth` (line 120) and before `initAuditDb` (line 135). `DATA_DIR` is already resolved at line 87.

**`settings.yaml` current value (VERIFIED):**
```yaml
audit:
  cohortHashSecret: 'dev-cohort-hash-secret-please-replace-in-prod-xxxxxxxxxxxxxx'
```
The placeholder is 56 characters (≥32), so the settings fallback path will work for existing local dev environments until the file is created.

**Test impact:** `hashCohortId.test.ts` calls `initHashCohortId({ audit: { cohortHashSecret: VALID_SECRET } })` with a single argument. Tests must be updated to pass a `dataDir` argument (use a temp directory via `os.tmpdir()`). The `_resetForTesting()` helper remains useful — no removal needed.

**Dev placeholder detection (OPTIONAL but recommended):** Add a startup `console.warn` (not a throw) if the active secret equals the known dev placeholder string. This guides operators without blocking startup.

---

### SEC-03: Forced Password Change

**Default password evidence (VERIFIED in `server/initAuth.ts` lines 300-313):**
```typescript
// _migrateUsersJson:
const hash = bcrypt.hashSync('changeme2025!', 12);
return { ...user, passwordHash: hash };
```

Any user in `data/users.json` that had no `passwordHash` at startup was given `bcrypt('changeme2025!')`. All 7 seed users currently have hashes (VERIFIED in `data/users.json`), but the hashes were generated from `changeme2025!` on the initial seeding — we cannot distinguish this from a user who already changed their password without a flag.

**Strategy:** Add a `mustChangePassword?: boolean` field to `UserRecord`. Set it to `true` during `_migrateUsersJson` for any user whose password hash is newly added in this migration pass.

**`UserRecord` interface change (VERIFIED current shape in `initAuth.ts:20-29`):**
```typescript
export interface UserRecord {
  username: string;
  passwordHash?: string;
  role: string;
  centers: string[];
  firstName?: string;
  lastName?: string;
  createdAt: string;
  lastLogin?: string;
  mustChangePassword?: boolean;   // ADD — true = user has default password and must change it
}
```

**Detection during migration:** In `_migrateUsersJson`, when setting a new `passwordHash` (because it was missing), also set `mustChangePassword: true`. Existing users who already have a hash (like the current 7 users) are NOT flagged — this applies only to new migrations going forward.

**For currently-deployed users with the default hash:** The system cannot retroactively detect them without re-hashing every user's stored hash against `'changeme2025!'` (a bcrypt compare). This is feasible at startup: compare each user's `passwordHash` against `'changeme2025!'` using `bcrypt.compare()`. If it matches and `mustChangePassword` is not already set, set it to `true`.

**Implementation decision — startup detection (recommended):**
```typescript
// In _migrateUsersJson: after setting hashes
for (const user of workingUsers) {
  if (user.passwordHash && !user.mustChangePassword) {
    const isDefault = await bcrypt.compare('changeme2025!', user.passwordHash);
    if (isDefault) {
      user.mustChangePassword = true;
      needsWrite = true;
    }
  }
}
```
Note: `_migrateUsersJson` currently runs synchronously. Adding bcrypt compares makes it async. The startup call in `initAuth` is already synchronous — this requires making `_migrateUsersJson` async and awaiting it, or using `bcrypt.compareSync`. Since this is one-time startup work, `bcrypt.compareSync` is acceptable.

**Enforcement gate:** After a successful `POST /api/auth/login` (2FA disabled path) or `POST /api/auth/verify` (2FA success path), check `user.mustChangePassword`. If `true`, return a different response shape:
```typescript
res.json({ mustChangePassword: true, changeToken: <short-lived JWT with purpose='change-password'> });
// instead of: res.json({ token })
```

The `changeToken` is a limited JWT (purpose: 'change-password', 5-minute expiry) that the frontend exchanges at the new `POST /api/auth/change-password` endpoint.

**New route — `POST /api/auth/change-password`:**
- Accepts `{ changeToken, newPassword }`
- Verifies `changeToken` has `purpose: 'change-password'`
- Validates `newPassword` length/complexity (minimum 8 chars, not equal to `'changeme2025!'`)
- Hashes new password with bcrypt (12 rounds)
- Clears `mustChangePassword: false` in `UserRecord`
- Returns `{ token }` (full session JWT)

**Public paths:** `POST /api/auth/change-password` must be added to `PUBLIC_PATHS` in `authMiddleware.ts` since the user has no session token at this point.

**Frontend impact:** The React `LoginPage.tsx` (or `AuthContext`) must detect `mustChangePassword: true` in the login response and redirect to a password-change screen. This is frontend work scoped to this phase.

---

### PERF-01: O(N+M) extractPatientCases Refactor

**Current algorithm (VERIFIED in `shared/patientCases.ts` lines 46-73):**

Five `.filter()` calls inside `patients.map()` at lines 66-71:
```typescript
conditions: conditions.filter((c) => c.subject.reference === ref),
observations: observations.filter((o) => o.subject.reference === ref),
procedures: procedures.filter((p) => p.subject.reference === ref),
imagingStudies: imaging.filter((i) => i.subject.reference === ref),
medications: medications.filter((m) => m.subject.reference === ref),
```

Each `.filter()` scans the entire resource array for every patient → O(N×M).

**Exact 5 resource types filtered:** conditions, observations, procedures, imagingStudies (variable named `imaging`), medications.

**Organization lookup (line 57):**
```typescript
const org = orgs.find((o) => o.id === pat.meta?.source);
```
This is also O(N×orgs) but `orgs` is typically 7 (one per center). Apply the same Map pattern for consistency, but it is not a performance bottleneck.

**Refactor — new private helper (not exported):**
```typescript
function groupBySubject<T extends { subject: { reference: string } }>(
  resources: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of resources) {
    const key = r.subject.reference;
    const bucket = map.get(key);
    if (bucket) bucket.push(r);
    else map.set(key, [r]);
  }
  return map;
}
```

**Refactored `extractPatientCases` body:**
```typescript
export function extractPatientCases(bundles: BundleLike[]): PatientCase[] {
  const patients = resourcesOfType<Patient>(bundles, 'Patient');
  const conditions = resourcesOfType<Condition>(bundles, 'Condition');
  const observations = resourcesOfType<Observation>(bundles, 'Observation');
  const procedures = resourcesOfType<Procedure>(bundles, 'Procedure');
  const imaging = resourcesOfType<ImagingStudy>(bundles, 'ImagingStudy');
  const medications = resourcesOfType<MedicationStatement>(bundles, 'MedicationStatement');
  const orgs = resourcesOfType<Organization>(bundles, 'Organization');

  // O(M): build lookup maps before iterating patients
  const conditionsBySubject = groupBySubject(conditions);
  const observationsBySubject = groupBySubject(observations);
  const proceduresBySubject = groupBySubject(procedures);
  const imagingBySubject = groupBySubject(imaging);
  const medicationsBySubject = groupBySubject(medications);

  return patients.map((pat) => {
    const ref = `Patient/${pat.id}`;
    const org = orgs.find((o) => o.id === pat.meta?.source); // orgs is small (7), find is fine
    return {
      id: pat.id,
      pseudonym: pat.identifier?.find((i) => i.system === 'urn:eyematics:pseudonym')?.value ?? pat.id,
      gender: pat.gender ?? 'unknown',
      birthDate: pat.birthDate ?? '',
      centerId: pat.meta?.source ?? '',
      centerName: org?.name ?? pat.meta?.source ?? '',
      conditions: conditionsBySubject.get(ref) ?? [],
      observations: observationsBySubject.get(ref) ?? [],
      procedures: proceduresBySubject.get(ref) ?? [],
      imagingStudies: imagingBySubject.get(ref) ?? [],
      medications: medicationsBySubject.get(ref) ?? [],
    };
  });
}
```

**Output contract:** Identical `PatientCase[]` shape. Tests using `toEqual` (structural equality) will pass without change. Any test using `toBe` (reference equality) on returned arrays would break — verify none exist. The current test suite uses `toEqual` throughout for these assertions.

**Type constraint on groupBySubject:** The generic `T extends { subject: { reference: string } }` will not match `Organization` (which does not have `subject`). This is by design — orgs are not grouped this way.

---

### PERF-02: Cache Warming on Startup

**`getCachedBundles()` function (VERIFIED in `server/fhirApi.ts` lines 368-376):**
```typescript
export async function getCachedBundles(): Promise<FhirBundle[]> {
  if (_bundleCache !== null) {
    return _bundleCache;
  }
  const bundles = await loadBundlesFromServer();
  _bundleCache = bundles;
  _caseIndex = buildCaseIndex(bundles);
  return bundles;
}
```

**`_bundleCache` initial state (VERIFIED in `fhirApi.ts` line 53):** `let _bundleCache: FhirBundle[] | null = null;` — null at startup, populated on first call to `getCachedBundles()`.

**Current `server/index.ts` startup sequence (VERIFIED, lines 116-143):**
```
line 117: initCenters(DATA_DIR)
line 120: initAuth(DATA_DIR, settings)
line 123: initHashCohortId(settings)           ← becomes initHashCohortId(DATA_DIR, settings) in SEC-02
line 126: initOutcomesAggregateCache(settings)
line 135: initAuditDb(DATA_DIR, retentionDays)
line 136: initDataDb(DATA_DIR)
line 142: startPurgeInterval()
```

**Correct insertion point:** After `initDataDb(DATA_DIR)` (line 136) and after `startPurgeInterval()` (line 142), before `app.listen()` (line 280).

The server listen call at line 280 is synchronous — the startup sequence runs to completion before any requests are accepted. `getCachedBundles()` must be awaited; the top-level `index.ts` is already a module (uses `import`) so top-level await is supported in Node ESM. Alternatively, wrap in an immediately-invoked async function.

**Insertion point code:**
```typescript
// After startPurgeInterval() — warm FHIR bundle cache before accepting requests
try {
  await getCachedBundles();
  console.log('[server] FHIR bundle cache warmed on startup');
} catch (err) {
  console.warn('[server] FHIR bundle cache warm failed — will retry on first request:', (err as Error).message);
  // Non-fatal: getCachedBundles() will retry on first /api/fhir/bundles request
}
```

**Non-fatal design:** Blaze may be unavailable at startup (common in dev). The warm failure must not prevent the server from starting. The existing `getCachedBundles()` retry-on-request behavior is the fallback.

**Import addition in `server/index.ts`:**
```typescript
import { getCachedBundles } from './fhirApi.js';    // ADD
```

**ESM top-level await:** `server/index.ts` does not currently use `async` or top-level `await`. To insert an `await` at module level, either:
1. Wrap the cache warm call in a `void (async () => { ... })()` IIFE (simplest — no structural change)
2. Convert the bottom of `index.ts` to an `async main()` function (cleaner but larger diff)

Recommend option 1 (IIFE) to minimize diff size.

---

### A11Y-01: ARIA Labels on Chart Containers

**OutcomesPanel.tsx structure (VERIFIED):**

There is **exactly 1** `ComposedChart` instance in `OutcomesPanel.tsx`. It is wrapped in:
```tsx
<ResponsiveContainer width="100%" height={320}>
  <ComposedChart data={panel.medianGrid}>
    ...
  </ComposedChart>
</ResponsiveContainer>
```

The `<ResponsiveContainer>` renders a `<div>` in the DOM. Recharts does not expose `aria-label` on `<ComposedChart>` directly — the correct approach is to add `role="img"` and `aria-label` to the wrapping `<div>` that contains the `<ResponsiveContainer>`.

The outer panel `<div>` at line 120:
```tsx
<div
  data-testid={`outcomes-panel-${eye}`}
  className="bg-white rounded-xl border border-gray-200 p-5"
>
```

**ARIA label content requirements (from A11Y-01):** metric name, eye side, cohort patient count.

**Available props in scope:**
- `t(titleKey)` → metric name + eye side (e.g., "Right Eye (OD) — Visus logMAR")
- `panel.summary.patientCount` → cohort patient count (number)
- `eye` → 'od' | 'os' | 'combined'

**Implementation — add `aria-label` to `<ResponsiveContainer>` wrapper:**

Recharts `<ResponsiveContainer>` accepts arbitrary props that pass through to its container `<div>`. The simplest approach:
```tsx
<div
  data-testid={`outcomes-panel-${eye}`}
  className="bg-white rounded-xl border border-gray-200 p-5"
>
  ...
  <ResponsiveContainer
    width="100%"
    height={320}
    role="img"
    aria-label={`${t(titleKey)} — ${panel.summary.patientCount} ${t('outcomesPanelPatientCount')}`}
  >
```

If `<ResponsiveContainer>` does not forward `role`/`aria-label` to its DOM container (verify at implementation time), the fallback is to wrap `<ResponsiveContainer>` in a `<div role="img" aria-label={...}>`.

**Label format example:**
- `"Right Eye (OD) — Visus logMAR — 42 patients"`
- Use an i18n key for "patients" to remain consistent with the app's translation pattern.

**Note on empty state panel:** The empty state branch (lines 91-103) also renders a `<div>` but no chart — no ARIA needed there (the text content is already accessible).

**Test impact:** Add a Vitest/RTL test asserting that each rendered `OutcomesPanel` has a container element with a non-empty `aria-label` matching the expected format.

---

## Standard Stack

All libraries below are already installed in the project. No new dependencies are required for Phase 14.

| Library | Already Used | Purpose in This Phase |
|---------|-------------|----------------------|
| `jsonwebtoken` | Yes | Add `{ algorithms: ['HS256'] }` to 2 existing `jwt.verify()` calls |
| `node:crypto` | Yes | `crypto.randomBytes(32).toString('hex')` for cohortHashSecret auto-gen |
| `node:fs` | Yes | Read/write `data/cohort-hash-secret.txt` |
| `bcryptjs` | Yes | `bcrypt.compareSync('changeme2025!', hash)` for SEC-03 detection |
| Recharts | Yes | `<ResponsiveContainer>` aria props |

**No new `npm install` required for Phase 14.** (Phase 15 TOTP will add `otplib`.)

---

## Architecture Patterns

### Project Structure Context

```
server/
├── authMiddleware.ts     — SEC-01: pin jwt.verify at line 59
├── authApi.ts            — SEC-01: pin jwt.verify at line 181; SEC-03: gate login response
├── initAuth.ts           — SEC-03: add mustChangePassword to UserRecord; detection in _migrateUsersJson
├── hashCohortId.ts       — SEC-02: new signature initHashCohortId(dataDir, settings)
├── fhirApi.ts            — PERF-02: getCachedBundles() called at startup
└── index.ts              — SEC-02: update call site; PERF-02: add cache warm

shared/
└── patientCases.ts       — PERF-01: add groupBySubject<T>, replace 5 .filter() calls

src/components/outcomes/
└── OutcomesPanel.tsx     — A11Y-01: add aria-label to ResponsiveContainer
```

### Startup Sequence After Phase 14

```
1. Read settings.yaml
2. initCenters(DATA_DIR)
3. initAuth(DATA_DIR, settings)              — unchanged
4. initHashCohortId(DATA_DIR, settings)      — SEC-02: new signature
5. initOutcomesAggregateCache(settings)
6. initAuditDb(DATA_DIR, retentionDays)
7. initDataDb(DATA_DIR)
8. startPurgeInterval()
9. [NEW] getCachedBundles() — non-fatal warm  — PERF-02
10. app.listen(PORT, HOST)
```

### SEC-03 Login Flow After Phase 14

```
POST /login (password correct)
  → user.mustChangePassword === true?
    YES: return { mustChangePassword: true, changeToken: <5-min JWT purpose='change-password'> }
      → Frontend detects mustChangePassword, shows change-password form
      → POST /api/auth/change-password with { changeToken, newPassword }
        → verify changeToken, hash newPassword, clear flag, return { token }
    NO: return { token } (existing behavior unchanged)
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Secret generation | Custom random string | `crypto.randomBytes(32).toString('hex')` — already used in `initAuth.ts` |
| HMAC for cohort hash | Manual crypto ops | Existing `hashCohortId()` function — no change needed |
| bcrypt comparison | Custom hash comparison | `bcrypt.compareSync()` from `bcryptjs` — already installed |
| Algorithm pin | Manual alg header check | `{ algorithms: ['HS256'] }` option in `jwt.verify()` — one argument |
| Map grouping | Custom indexer | Standard JS `Map` with manual loop — simple and has no external dep |

---

## Common Pitfalls

### Pitfall 1: Adding `algorithms` Option Breaks Existing Tests
**What goes wrong:** Existing tests in `authMiddlewareLocal.test.ts` sign tokens with `{ algorithm: 'HS256' }` and verify them. Adding `{ algorithms: ['HS256'] }` to `jwt.verify()` should NOT break these — HS256 tokens will still pass. Only a mismatch (e.g., RS256 token against HS256 pin) would fail.
**Verify:** Run `vitest run tests/authMiddlewareLocal.test.ts` immediately after the SEC-01 change. All 8 existing tests should pass.
**New test needed:** Assert that a token signed with RS256 (using a different key) is rejected with 401 in local mode after the pin.

### Pitfall 2: `hashCohortId.test.ts` Signature Mismatch After SEC-02
**What goes wrong:** All 7 tests in `tests/hashCohortId.test.ts` call `initHashCohortId({ audit: { cohortHashSecret: VALID_SECRET } })` — single argument. After changing the signature to `(dataDir, settings)`, these calls become incorrect.
**Prevention:** Update all test call sites to pass a temp directory as the first argument. Use `os.tmpdir()` or `import { mkdtempSync } from 'node:fs'` for an isolated temp dir.
**Regression risk:** LOW — the behavioral contract (determinism, length check, error on missing) is unchanged. Only the signature changes.

### Pitfall 3: bcrypt Compare in `_migrateUsersJson` Is Slow
**What goes wrong:** `bcrypt.compareSync('changeme2025!', hash)` takes ~100ms per user at cost factor 12. With 7 users, that's ~700ms of blocking startup time.
**Prevention:** This is one-time work that only runs if `mustChangePassword` is not yet set. After the first startup, all users have the field and no comparison is needed. Accept the one-time cost or run comparisons asynchronously before `app.listen()`.
**Alternative:** Instead of detecting the default password at startup, mark users during `_migrateUsersJson` when the hash is first created (i.e., only mark new migrations, not retroactive detection). For already-deployed users with the default password, accept that they won't be flagged until their next `_migrateUsersJson` pass adds the field.

### Pitfall 4: `getCachedBundles()` Fails Fatally at Startup in Blaze Environments
**What goes wrong:** If Blaze is configured (`dataSource.type: blaze`) but not running, `getCachedBundles()` throws an error. If this error propagates to module scope without a try/catch, it crashes the server.
**Prevention:** Wrap the warm call in try/catch and `console.warn` — do NOT rethrow. The server must start even if Blaze is unavailable.
**Current behavior:** The current code has no warm call, so it never fails at startup. The new code must preserve the "lazy fallback" behavior as a safety net.

### Pitfall 5: `<ResponsiveContainer>` May Not Forward `aria-label` to DOM
**What goes wrong:** Some versions of Recharts filter arbitrary props before passing them to the DOM container div. If `aria-label` is dropped, the ARIA requirement is silently not met.
**Detection:** After implementing, inspect the rendered DOM in the browser or via RTL `getByRole('img', { name: /.../ })` to confirm the attribute is present.
**Fallback:** Wrap `<ResponsiveContainer>` in `<div role="img" aria-label={...}>` — this is guaranteed to render in the DOM.

### Pitfall 6: O(N+M) Refactor Assumes `subject.reference` Format Is Always `Patient/ID`
**What goes wrong:** The existing `.filter()` calls use `c.subject.reference === ref` where `ref = 'Patient/${pat.id}'`. The `groupBySubject` Map keys must match this format exactly. If any resource uses a different reference format (e.g., relative URL without `Patient/` prefix), the Map lookup returns `undefined` and that resource is silently dropped.
**Prevention:** The format is consistent in the FHIR bundles — verified by the existing filter logic working correctly. No format change is introduced by the Map approach. Still: add a test with a fixture that has resources using the `Patient/ID` format explicitly.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.ts` (or detected from `package.json`) |
| Quick run command | `npm test -- --testNamePattern="<pattern>"` or `npx vitest run tests/<file>.test.ts` |
| Full suite command | `npm test` (runs `vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | `jwt.verify` with wrong algorithm returns 401 | unit | `npx vitest run tests/authMiddlewareLocal.test.ts` | Partial — existing tests pass HS256; new RS256 rejection test needed |
| SEC-01 | `authApi.ts /verify` challenge token rejected if RS256-signed | unit | `npx vitest run tests/authApi.test.ts` (or new file) | New test needed |
| SEC-02 | `initHashCohortId` generates file if absent | unit | `npx vitest run tests/hashCohortId.test.ts` | Partial — exists but needs new signature + auto-gen test |
| SEC-02 | Generated file has mode 0o600 | unit | same file | New assertion needed |
| SEC-02 | Settings fallback still works when file absent | unit | same file | New test case needed |
| SEC-03 | `UserRecord.mustChangePassword` set for default-password users | unit | `npx vitest run tests/initAuthMigration.test.ts` | Partial — add mustChangePassword assertions |
| SEC-03 | POST /login returns `{ mustChangePassword, changeToken }` not `{ token }` | integration | new test in authApi or separate file | New |
| SEC-03 | POST /auth/change-password clears flag + returns full JWT | integration | new test | New |
| PERF-01 | `extractPatientCases` output matches O(N×M) output on fixture | unit | `npx vitest run tests/outcomesAggregateParity.test.ts` (or new) | New parity test needed |
| PERF-01 | No `.filter()` calls inside `patients.map()` (static assertion) | grep-based | `grep -n ".filter" shared/patientCases.ts` → should find 0 inside the map body | Manual / CI grep |
| PERF-02 | `getCachedBundles()` called at startup — cache populated before first request | integration | Inspect `_bundleCache` state via module — or add a `getCacheState()` export for test | New export + test |
| PERF-02 | Startup does not fail if Blaze is unavailable | unit | Mock `loadBundlesFromServer` to throw; assert server still starts | New |
| A11Y-01 | Each `OutcomesPanel` has container with `aria-label` matching expected format | unit (RTL) | `npx vitest run tests/OutcomesPage.test.tsx` or new file | New test case |

### Sampling Rate
- **Per task commit:** Run targeted test file for the changed module
- **Per wave merge:** `npm test` — full 430+ test suite
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] New test cases in `tests/authMiddlewareLocal.test.ts` — SEC-01 algorithm mismatch rejection
- [ ] Updated `tests/hashCohortId.test.ts` — new 2-argument signature + auto-gen behavior
- [ ] New `tests/mustChangePassword.test.ts` (or additions to `tests/userCrud.test.ts`) — SEC-03 flow
- [ ] New PERF-01 parity test — structural equality of refactored vs. original output
- [ ] New A11Y-01 assertion in `tests/OutcomesPage.test.tsx` or `tests/components.test.tsx`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | SEC-03 forced change; bcryptjs already in use |
| V3 Session Management | Yes | SEC-01 algorithm pin; `changeToken` short-lived JWT |
| V4 Access Control | No | No role changes in this phase |
| V5 Input Validation | Yes | SEC-03 `newPassword` length/content validation |
| V6 Cryptography | Yes | SEC-01 HS256 pin; SEC-02 `crypto.randomBytes` |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| JWT algorithm confusion (HS256 vs RS256 vs none) | Elevation of privilege | `{ algorithms: ['HS256'] }` in `jwt.verify()` — SEC-01 |
| Weak/guessable cohort hash secret | Information disclosure | Auto-generate 64-char hex secret — SEC-02 |
| Default password brute-force | Authentication bypass | Force change on login; `mustChangePassword` flag — SEC-03 |
| Default password enumeration via hash comparison | Information disclosure | Only log "migrated" without exposing hash or plaintext |
| Cache warm crash → server down | Denial of service | Non-fatal try/catch on startup warm — PERF-02 |

---

## Open Questions

1. **SEC-03 retroactive detection vs. forward-only detection**
   - What we know: Current 7 users have hashes generated from `'changeme2025!'`
   - What's unclear: Should the startup detect existing default-password users via `bcrypt.compareSync`, or only flag users going forward when the migration creates a new hash?
   - Recommendation: Retroactive detection (bcrypt.compareSync at startup) is more complete and the ~700ms one-time cost is acceptable. But the planner should confirm this is the intended behavior — if all 7 current users have already changed their passwords manually, detection is pointless overhead.

2. **SEC-03 frontend scope**
   - What we know: The backend emits `{ mustChangePassword, changeToken }` and new `POST /change-password` route
   - What's unclear: Is the React `LoginPage.tsx` / `AuthContext` change in scope for Phase 14, or deferred?
   - Recommendation: Include the frontend password-change screen in Phase 14 — without it, the backend enforcement gate has no UI surface and users would be permanently stuck.

3. **PERF-02 startup impact in test environment**
   - What we know: `getCachedBundles()` reads from `public/data/` in local mode
   - What's unclear: The test suite mocks `loadBundlesFromServer` — does the warm call during server init (if tested) need a mock?
   - Recommendation: The warm call is in `server/index.ts` which is not directly imported by tests (they test individual modules). No test breakage expected. Verify by running full suite after adding the warm call.

4. **A11Y-01 label i18n key for "patients"**
   - What we know: `t('outcomesPanelPatientCount')` may not exist yet
   - What's unclear: Is there an existing i18n key for the patient count label?
   - Recommendation: Check `src/i18n/` for an existing key. If none, add `outcomesPanelAriaLabel` returning e.g. `"{title} — {count} Patienten"` with interpolation.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 14 is purely code modification. No new external tools, services, or CLIs required. All dependencies (Node.js, npm, jsonwebtoken, bcryptjs, Recharts) are already present.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `<ResponsiveContainer>` forwards `aria-label` prop to its DOM div container | A11Y-01 | If false, must use wrapping `<div>` instead — minor implementation adjustment, no design risk |
| A2 | All 7 current seed users have `passwordHash` set to bcrypt('changeme2025!') — confirmed by initAuth migration log but not directly verified by re-hashing | SEC-03 | If any user changed password before this phase, retroactive detection marks them false-positive. Flag: `mustChangePassword` is a safe default — user simply changes password again |

**All other claims are VERIFIED by direct code reads in this session.**

---

## Sources

### Primary (HIGH confidence)
- Direct read: `server/authMiddleware.ts` — confirmed 2 unpinned jwt.verify() call sites
- Direct read: `server/authApi.ts` — confirmed challenge token verify at line 181
- Direct read: `server/initAuth.ts` — confirmed jwt-secret.txt pattern, UserRecord shape, _migrateUsersJson behavior
- Direct read: `server/hashCohortId.ts` — confirmed current single-argument signature
- Direct read: `server/index.ts` — confirmed startup sequence, initHashCohortId call at line 123, no existing getCachedBundles() call
- Direct read: `server/fhirApi.ts` — confirmed getCachedBundles() export, _bundleCache init as null
- Direct read: `shared/patientCases.ts` — confirmed 5 .filter() calls inside patients.map(), exact variable names
- Direct read: `src/components/outcomes/OutcomesPanel.tsx` — confirmed 1 ComposedChart, ResponsiveContainer wrapper structure
- Direct read: `data/users.json` — confirmed 7 users, all have passwordHash, no mustChangePassword field
- Direct read: `config/settings.yaml` — confirmed cohortHashSecret is placeholder (56 chars, ≥32)
- Grep: `grep -rn "jwt.verify"` across `server/` — confirmed exactly 3 call sites (2 unpinned, 1 pinned)

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` — pre-existing analysis of all Phase 14 changes, consistent with codebase reads
- `.planning/research/PITFALLS.md` — pre-existing pitfall analysis, consistent with codebase reads

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present in package.json
- Architecture: HIGH — all call sites, line numbers, and signatures verified by direct read
- Pitfalls: HIGH — derived from verified code structure
- SEC-03 retroactive detection: MEDIUM — behavioral decision, not code certainty

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (stable codebase, no fast-moving dependencies in this phase)
