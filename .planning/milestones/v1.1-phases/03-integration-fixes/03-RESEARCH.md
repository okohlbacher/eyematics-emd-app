# Phase 3: Integration Fixes - Research

**Researched:** 2026-04-10
**Domain:** Express middleware ordering, TypeScript server-side bug fixes, Vitest unit testing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (Bug 1 — Audit body capture):** Fix `req.body` being null for `POST /api/issues` and `PUT /api/settings` audit entries. Root cause is `express.json()` only mounted on `/api/auth`. Approach is Claude's discretion — options: global body parsing with stream replay, capturing body inside `readBody()` and attaching to `req`, or a dedicated audit body-capture middleware.
- **D-02 (Bug 2 — Time filter params):** Fix client side only — change `auditService.ts` to send `fromTime`/`toTime` instead of `from`/`to`. Server API contract (`auditApi.ts` reading `fromTime`/`toTime`) stays as-is. Update the `fetchAuditEntries` filter interface and `URLSearchParams` construction.
- **D-03 (Bug 3 — Settings schema validator):** Full rewrite of `validateSettingsSchema()` in `settingsApi.ts` to validate the entire `auth` section: `twoFactorEnabled` (boolean), `maxLoginAttempts` (number), `jwtSecret` (string), `otpCode` (string, optional). Not just a path fix — validate all auth fields that `initAuth.ts:getAuthConfig()` consumes.
- **D-04 (Automated tests):** Write automated test files for USER-13 (rate limiting) and AUTH-05 (settings auth section). Rate limiting tests must cover: 5 consecutive failures → account lock, exponential backoff timing, reset on successful login, configurable `maxLoginAttempts`. Settings tests must cover: nested `auth.twoFactorEnabled` accepted, top-level `twoFactorEnabled` rejected or handled gracefully, full auth section validation.
- **D-05 (Test approach):** Tests should exercise the actual server functions (unit-level) rather than requiring a running server. Import `validateSettingsSchema` and rate limiting functions directly.

### Claude's Discretion

- Body capture fix approach (D-01) — choose the most compatible strategy with the existing `readBody()` pattern
- Test framework choice (CONTEXT.md says "vitest already in devDependencies — use it" — NOTE: vitest is NOT currently in package.json; it must be installed as Wave 0)
- Whether to consolidate `readBody()` into express middleware long-term (note for Phase 4)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUDIT-01 | Audit entries written server-side only via auditMiddleware | Bug 1 fix ensures non-auth mutations have body captured, not null |
| AUDIT-02 | GET /api/audit returns entries with filtering including time range | Bug 2 fix aligns client `from`/`to` → `fromTime`/`toTime` |
| AUDIT-09 | SQLite schema includes `body TEXT` column; audit captures mutation body | Bug 1 fix populates the body column for non-auth mutations |
| AUTH-05 | settings.yaml auth section configures twoFactorEnabled, maxLoginAttempts, otpCode | Bug 3 fix makes schema validator match the nested auth structure |
| USER-13 | Server-side failed login limiting with lock and exponential backoff | Rate limiting is already implemented; formal test coverage formalises the requirement |
</phase_requirements>

---

## Summary

Phase 3 is a targeted bug-fix and test-coverage phase. Three integration bugs from the milestone audit must be fixed, plus two requirements need automated test verification. No new features are built — only correctness repairs and test scaffolding.

The bugs are well-understood: (1) `auditMiddleware` reads `req.body` but only `/api/auth` routes have `express.json()` mounted, so non-auth mutation bodies arrive as `null` in the audit log; (2) the client sends `from`/`to` query params but the server reads `fromTime`/`toTime`, silently breaking date filtering; (3) `validateSettingsSchema()` checks for top-level `twoFactorEnabled` but `settings.yaml` has moved it under `auth.twoFactorEnabled`, risking a 400 error on any settings write-back.

The test gap is equally clear: rate limiting logic and the settings auth validator both exist in the codebase but have zero automated test coverage. Vitest is the chosen framework but is not yet installed — it must be added as part of Wave 0.

**Primary recommendation:** Fix bugs in isolation (one task per bug), wire up vitest with a minimal config, then write focused unit tests that import functions directly rather than spinning up a server.

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express | ^5.2.1 | HTTP server framework | Already in production use [VERIFIED: package.json] |
| better-sqlite3 | ^12.8.0 | SQLite driver | Already in production use [VERIFIED: package.json] |
| jsonwebtoken | ^9.0.3 | JWT sign/verify | Already in production use [VERIFIED: package.json] |
| bcryptjs | ^3.0.3 | Password hashing | Already in production use [VERIFIED: package.json] |
| js-yaml | ^4.1.1 | YAML parsing | Already in production use [VERIFIED: package.json] |
| TypeScript | ~6.0.2 | Type checking | Project language [VERIFIED: package.json] |

### New Dependency (Wave 0 install required)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.1.4 | Unit test runner | Vite-native, fast, ESM-compatible, configured in context [VERIFIED: npm registry 2026-04-10] |
| @vitest/coverage-v8 | 4.1.4 | Code coverage | Paired with vitest, V8 native coverage [VERIFIED: npm registry 2026-04-10] |

**CRITICAL NOTE:** The CONTEXT.md says "vitest already in devDependencies — use it." This is INCORRECT. [VERIFIED: package.json] — vitest is absent from both `dependencies` and `devDependencies`. The test framework must be installed in Wave 0 before any test files can run.

**Installation:**
```bash
npm install --save-dev vitest @vitest/coverage-v8
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vitest | jest | vitest is native ESM, no transform config needed for this `"type": "module"` project; jest requires more setup |
| vitest | node:test | vitest has better TypeScript support and a cleaner API |

---

## Architecture Patterns

### Bug 1: Audit Body Capture — Recommended Approach

**Problem:** `auditMiddleware` (line 115) reads `req.body` at `res.on('finish')` time. For `POST /api/issues` and `PUT /api/settings`, the raw stream is consumed by `readBody()` inside the route handlers — `express.json()` is only mounted on `/api/auth`, so `req.body` is never populated for other mutation routes. [VERIFIED: server/index.ts line 144, server/auditMiddleware.ts line 115]

**Chosen pattern — body-capture middleware:** The most compatible approach given the existing architecture is to add a lightweight middleware that attaches to non-auth mutation routes (`POST /api/issues`, `PUT /api/settings`) and reads the stream via `readBody()`, attaches the result to `req` as a custom property, then restores the stream for downstream handlers.

However, Node.js `IncomingMessage` streams are single-use — once consumed they cannot be replayed. This means body capture and body consumption must be unified. The cleanest approach **without breaking existing handlers** is:

**Option A (Recommended): Capture body in `readBody()`, attach to `req`**

Modify `readBody()` in `server/utils.ts` to attach the parsed body to `req` as a non-standard property after consumption:

```typescript
// Conceptual pattern — attach parsed string to req for audit capture
(req as unknown as Record<string, unknown>)._capturedBody = data;
```

Then in `auditMiddleware`, read `req._capturedBody ?? req.body` at finish time. This is stream-safe: `readBody()` already owns the stream, and the audit middleware reads the captured string at finish time (never the stream).

**Option B: Express body parsing middleware for non-auth routes**

Mount `express.json()` globally but only after `auditMiddleware` and `authMiddleware`. The issue is that `issueApiHandler` and `settingsApiHandler` are raw Node http handlers using `readBody()` on the raw stream — if `express.json()` already consumed the stream, `readBody()` gets an empty body and returns `''`, which means the handler receives blank YAML/JSON.

**Option B is NOT safe** unless `readBody()` is also refactored to check `req.body` first. Given D-05 says scope is limited, Option A is the right choice.

**Option A implementation pattern:**
```typescript
// server/utils.ts — augmented readBody()
// Source: direct code analysis [VERIFIED: server/utils.ts]
export function readBody(req: import('http').IncomingMessage, maxSize = MAX_BODY_SIZE): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxSize) { req.destroy(); reject(new Error(`...`)); return; }
      data += chunk.toString();
    });
    req.on('end', () => {
      // Attach to req for audit capture BEFORE resolving
      (req as unknown as Record<string, unknown>)._capturedBody = data;
      resolve(data);
    });
    req.on('error', reject);
  });
}
```

```typescript
// server/auditMiddleware.ts — read _capturedBody as fallback
// Source: direct code analysis [VERIFIED: server/auditMiddleware.ts line 114-115]
const capturedBody = (req as unknown as Record<string, unknown>)._capturedBody as string | undefined;
const rawBody = req.method !== 'GET'
  ? (req.body !== undefined && req.body !== null ? req.body : (capturedBody ? tryParseJson(capturedBody) : undefined))
  : undefined;
const bodyStr = req.method !== 'GET' ? redactBody(urlPath, rawBody) : null;
```

**Note:** `redactBody` accepts `unknown` and handles string/object/null. If the body is a YAML string (settings), it will be stored as-is (as a JSON-stringified string). This is acceptable for audit purposes — the body column documents what was sent, not parsed.

### Bug 2: Time Filter Param Fix (Client-Side Only)

Simple rename in `src/services/auditService.ts`. [VERIFIED: src/services/auditService.ts lines 23-24, 32-33]

```typescript
// BEFORE (broken)
export async function fetchAuditEntries(filters?: {
  user?: string; path?: string;
  from?: string; to?: string;    // ← wrong param names
  limit?: number; offset?: number;
}): Promise<...> {
  if (filters?.from) params.set('from', filters.from);     // ← sends wrong key
  if (filters?.to)   params.set('to',   filters.to);       // ← sends wrong key
```

```typescript
// AFTER (fixed)
export async function fetchAuditEntries(filters?: {
  user?: string; path?: string;
  fromTime?: string; toTime?: string;   // ← matches server contract
  limit?: number; offset?: number;
}): Promise<...> {
  if (filters?.fromTime) params.set('fromTime', filters.fromTime);
  if (filters?.toTime)   params.set('toTime',   filters.toTime);
```

Server contract is correct and stays unchanged. [VERIFIED: server/auditApi.ts lines 43-44, server/auditDb.ts lines 38-39]

### Bug 3: Settings Schema Validator Rewrite

Current `validateSettingsSchema()` checks `obj.twoFactorEnabled` (top-level) but the canonical structure in `settings.yaml` and consumed by `initAuth.ts:getAuthConfig()` uses `auth.twoFactorEnabled`. [VERIFIED: server/settingsApi.ts lines 33-35, public/settings.yaml, server/initAuth.ts lines 70-78]

`getAuthConfig()` already handles both top-level and nested `twoFactorEnabled` via fallback logic (lines 71-73 of initAuth.ts). Per D-03, the validator should enforce the **canonical nested path** rather than match the fallback permissiveness — this catches future mismatches early.

**Fields to validate in the rewritten function:**
- `auth` object must exist
- `auth.twoFactorEnabled`: boolean
- `auth.maxLoginAttempts`: number (positive integer)
- `auth.otpCode`: string (optional — has default)
- Existing top-level fields: `therapyInterrupterDays`, `therapyBreakerDays`, `dataSource.type`, `dataSource.blazeUrl`
- Remove the obsolete top-level `twoFactorEnabled` check

**Note:** `jwtSecret` listed in D-03 does NOT appear in `public/settings.yaml` or `initAuth.ts:getAuthConfig()`. The JWT secret lives in `data/jwt-secret.txt` (explicitly NOT in settings.yaml per the CRITICAL comment in initAuth.ts line 5). The validator should NOT validate `jwtSecret` — this would be incorrect and potentially insecure.

### Test Architecture (D-04, D-05)

Tests must import functions directly — no running server required.

**Rate limiting functions in `server/authApi.ts`:** [VERIFIED: server/authApi.ts lines 27-49]
The `loginAttempts` Map, `getLockState`, `isLocked`, `recordFailure`, `resetAttempts` are module-level private functions. They are NOT exported. To test them without a running server, two options:

- **Option A:** Export the rate limiting helpers from `authApi.ts` (or a new `server/rateLimiting.ts` module). Cleanest for D-05.
- **Option B:** Test via the Express router by calling `authApiRouter` with a mock `req`/`res` (supertest pattern). Does not require a running server but needs more setup.

Given D-05 says "import functions directly", Option A is required: extract or export the rate limiting functions so tests can call them in isolation.

**Settings validator in `server/settingsApi.ts`:** `validateSettingsSchema` is currently not exported (line 26: `function validateSettingsSchema`). It must be exported for direct import in tests. [VERIFIED: server/settingsApi.ts line 26]

**Vitest config for server-side TypeScript:**

```typescript
// vitest.config.ts (new file)
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

The project uses `"type": "module"` (package.json) and TypeScript ~6.0.2, so vitest's built-in ESM + TypeScript support handles imports without additional transform config. [VERIFIED: package.json]

**Test file locations:**
```
tests/
├── rateLimiting.test.ts   # USER-13 coverage
└── settingsValidator.test.ts  # AUTH-05 coverage
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test runner | Custom assertion framework | vitest | Already decided (D-05); native ESM, TypeScript, fast |
| Body stream replay | Custom duplex stream buffering | Attach-to-req pattern in readBody() | Stream replay is complex and error-prone; single attach on `end` is safe |
| JWT validation in tests | Custom JWT decode | Import `getJwtSecret`/`jwt.verify` directly | These functions are already tested indirectly via auth flow |

---

## Common Pitfalls

### Pitfall 1: Stream double-consumption (Bug 1 fix)
**What goes wrong:** If `express.json()` is mounted globally, it consumes the stream before `readBody()` can read it. `readBody()` then gets `''`, the handler receives blank input, and writes garbage to the database or returns 400.
**Why it happens:** Node.js `IncomingMessage` streams are single-use — data events fire once.
**How to avoid:** Use the attach-to-req pattern: let `readBody()` remain the sole stream consumer, and have `auditMiddleware` read the string it already captured.
**Warning signs:** `readBody()` returns `''` or `undefined`; settings write-back starts saving empty YAML.

### Pitfall 2: Testing private module-level state (rate limiting)
**What goes wrong:** The `loginAttempts` Map in `authApi.ts` is module-level. If rate limiting functions are not exported, tests cannot call `recordFailure` / `resetAttempts` directly. Importing the module via vitest runs the module (router construction), which calls `getAuthConfig()` — which throws because `initAuth()` has not been called.
**Why it happens:** `getAuthConfig()` throws if called before `initAuth()`. The `authApiRouter` construction happens at module load time; `recordFailure` calls `getAuthConfig()` at invocation time.
**How to avoid:** Extract rate limiting logic into a separate module `server/rateLimiting.ts` that takes `maxLoginAttempts` as a parameter rather than calling `getAuthConfig()` internally. Or mock `initAuth` in vitest setup. The cleaner solution is extraction.
**Warning signs:** `Error: [initAuth] getAuthConfig() called before initAuth()` during test setup.

### Pitfall 3: validateSettingsSchema not exported
**What goes wrong:** `validateSettingsSchema` is a non-exported function in `settingsApi.ts`. Tests cannot `import { validateSettingsSchema }` — TypeScript will error and vitest will fail.
**Why it happens:** Oversight — it was written as a private helper.
**How to avoid:** Add `export` to the function declaration as part of the Bug 3 rewrite.
**Warning signs:** TypeScript `TS2305: Module has no exported member 'validateSettingsSchema'`.

### Pitfall 4: jwtSecret in settings validator
**What goes wrong:** D-03 mentions `jwtSecret (string)` as a field to validate in the auth section. But `data/jwt-secret.txt` is explicitly the JWT secret location — NOT `settings.yaml`. The public/ directory is served statically.
**Why it happens:** The discussion mentioned auth fields without distinguishing between settings.yaml fields and jwt-secret.txt.
**How to avoid:** Do NOT add jwtSecret to the settings schema validator. The auth section in settings.yaml only contains: `twoFactorEnabled`, `maxLoginAttempts`, `otpCode`. Validate exactly these.
**Warning signs:** Attempting to read `settings.auth.jwtSecret` — it won't be present in the file.

### Pitfall 5: Vitest ESM import resolution for .ts server files
**What goes wrong:** Server files use `.js` extensions in import paths (e.g., `import { logAuditEntry } from './auditDb.js'`). In a vitest ESM environment, these must resolve to `.ts` source files during testing.
**Why it happens:** TypeScript/ESM convention for output paths is `.js`; vitest with `resolve.conditions: ['typescript']` or default settings handles this, but only if the tsconfig is set up correctly.
**How to avoid:** Verify that `tsconfig.json` has `"moduleResolution": "bundler"` or `"node16"` and that vitest's default config resolves `.js` → `.ts`. If not, add `resolve: { alias: { ... } }` to vitest.config.ts.
**Warning signs:** `ERR_MODULE_NOT_FOUND` for `.js` extension imports during test run.

---

## Code Examples

### Rate limiting functions extracted for testability
```typescript
// server/rateLimiting.ts (new file — extracted from authApi.ts)
// Source: direct code analysis of server/authApi.ts lines 27-49 [VERIFIED]

interface LockState { count: number; lockedUntil: number; }

export function createRateLimiter(maxLoginAttempts: number) {
  const loginAttempts = new Map<string, LockState>();

  function getLockState(username: string): LockState {
    return loginAttempts.get(username) ?? { count: 0, lockedUntil: 0 };
  }

  function isLocked(state: LockState): boolean {
    return state.lockedUntil > Date.now();
  }

  function recordFailure(username: string): LockState {
    const state = getLockState(username);
    const newCount = state.count + 1;
    const lockedUntil = newCount >= maxLoginAttempts
      ? Date.now() + Math.pow(2, newCount) * 1000
      : 0;
    const newState: LockState = { count: newCount, lockedUntil };
    loginAttempts.set(username, newState);
    return newState;
  }

  function resetAttempts(username: string): void {
    loginAttempts.delete(username);
  }

  return { getLockState, isLocked, recordFailure, resetAttempts };
}
```

### vitest.config.ts
```typescript
// vitest.config.ts (new file at project root)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

### Settings validator rewrite (Bug 3)
```typescript
// server/settingsApi.ts — validateSettingsSchema (rewritten, now exported)
// Source: direct code analysis [VERIFIED: settingsApi.ts lines 26-56, initAuth.ts lines 70-78, public/settings.yaml]

export function validateSettingsSchema(parsed: unknown): string | null {
  if (parsed === null || typeof parsed !== 'object') {
    return 'Settings must be a YAML object';
  }
  const obj = parsed as Record<string, unknown>;

  // Top-level numeric fields
  if (typeof obj.therapyInterrupterDays !== 'number' || !Number.isFinite(obj.therapyInterrupterDays)) {
    return 'therapyInterrupterDays must be a number';
  }
  if (typeof obj.therapyBreakerDays !== 'number' || !Number.isFinite(obj.therapyBreakerDays)) {
    return 'therapyBreakerDays must be a number';
  }

  // dataSource section
  if (obj.dataSource === null || typeof obj.dataSource !== 'object') {
    return 'dataSource must be an object';
  }
  const ds = obj.dataSource as Record<string, unknown>;
  if (typeof ds.type !== 'string' || ds.type.length === 0) return 'dataSource.type must be a non-empty string';
  if (typeof ds.blazeUrl !== 'string' || ds.blazeUrl.length === 0) return 'dataSource.blazeUrl must be a non-empty string';

  // auth section (canonical nested structure)
  if (obj.auth === null || typeof obj.auth !== 'object') {
    return 'auth must be an object';
  }
  const auth = obj.auth as Record<string, unknown>;
  if (typeof auth.twoFactorEnabled !== 'boolean') {
    return 'auth.twoFactorEnabled must be a boolean';
  }
  if (typeof auth.maxLoginAttempts !== 'number' || !Number.isInteger(auth.maxLoginAttempts) || auth.maxLoginAttempts < 1) {
    return 'auth.maxLoginAttempts must be a positive integer';
  }
  // otpCode is optional (defaults to '123456' in initAuth.ts)
  if (auth.otpCode !== undefined && typeof auth.otpCode !== 'string') {
    return 'auth.otpCode must be a string if provided';
  }

  return null;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Top-level `twoFactorEnabled` in settings.yaml | Nested `auth.twoFactorEnabled` | Phase 2 | Validator out of sync — Bug 3 |
| No rate limiter | In-memory Map with exponential backoff | Phase 2 | Already implemented, needs tests |
| No time filters on audit API | `fromTime`/`toTime` server params | Phase 2 | Client sends wrong names — Bug 2 |
| No audit body for mutations | `req.body` → audit log | Phase 2 design intent | Only works for auth routes currently — Bug 1 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `jwtSecret` field mentioned in D-03 should NOT be added to the settings validator because the JWT secret lives in `data/jwt-secret.txt`, not in `settings.yaml` | Bug 3 / Settings Schema | If wrong: validator would accept/reject a field that doesn't exist in the actual file; low risk since field absent means it's always `undefined` |
| A2 | Extracting rate limiting into `server/rateLimiting.ts` is the cleanest path for D-05 testability | Architecture Patterns / Rate Limiting | If wrong: alternative is vitest mocking of `initAuth` module; both work but extraction is cleaner |
| A3 | The `_capturedBody` attach-to-req approach in `readBody()` is the recommended Bug 1 fix | Bug 1 body capture | If wrong: could explore global `express.json()` + modifying route handlers to use `req.body` instead of `readBody()` — but this is a larger refactor |

---

## Open Questions

1. **Should `validateSettingsSchema` also validate the `server` and `audit` sections?**
   - What we know: Current validator validates `dataSource` but not `server.*` or `audit.*`.
   - What's unclear: D-03 only mentions the auth section fields. But the validator could be made comprehensive.
   - Recommendation: Validate only what `initAuth.ts:getAuthConfig()` consumes from the auth section. Leave server/audit validation for Phase 4 (broader settings hardening) to stay in scope.

2. **Does the `settings.yaml` file lack a top-level `twoFactorEnabled`?**
   - What we know: [VERIFIED: public/settings.yaml] — The current file has only `auth.twoFactorEnabled: true` (nested). There is no top-level `twoFactorEnabled` key.
   - What's unclear: Whether any UI component might submit settings with the old top-level structure.
   - Recommendation: The validator rewrite (D-03) enforces `auth.twoFactorEnabled` — any old top-level submissions will now be rejected with a clear error. This is the intended behavior per D-03.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All server code | ✓ | (project running) | — |
| npm | Package install | ✓ | (project running) | — |
| vitest | D-04 automated tests | ✗ | Not installed | Wave 0 install: `npm install --save-dev vitest @vitest/coverage-v8` |
| TypeScript | All code | ✓ | ~6.0.2 | — |

**Missing dependencies with no fallback:**
- vitest — blocks test execution. Must be installed in Wave 0.

**Missing dependencies with fallback:**
- None.

---

## Sources

### Primary (HIGH confidence)
- `server/auditMiddleware.ts` — Confirmed body capture logic and `req.body` dependency [VERIFIED: codebase read]
- `server/index.ts` — Confirmed `express.json()` scoped to `/api/auth` only [VERIFIED: codebase read, line 144]
- `server/utils.ts` — Confirmed `readBody()` raw stream consumer [VERIFIED: codebase read]
- `src/services/auditService.ts` — Confirmed `from`/`to` param names in client [VERIFIED: codebase read, lines 23-24, 32-33]
- `server/auditApi.ts` — Confirmed `fromTime`/`toTime` param names on server [VERIFIED: codebase read, lines 43-44]
- `server/auditDb.ts` — Confirmed `fromTime`/`toTime` in AuditFilters type [VERIFIED: codebase read, lines 38-39]
- `server/settingsApi.ts` — Confirmed validator checks top-level `twoFactorEnabled` [VERIFIED: codebase read, line 33]
- `server/initAuth.ts` — Confirmed `getAuthConfig()` reads `auth.twoFactorEnabled` with fallback [VERIFIED: codebase read, lines 70-78]
- `public/settings.yaml` — Confirmed nested auth section structure [VERIFIED: codebase read]
- `server/authApi.ts` — Confirmed rate limiting implementation (all 5 functions) [VERIFIED: codebase read, lines 25-49]
- `package.json` — Confirmed vitest is NOT installed [VERIFIED: codebase read]
- npm registry — vitest@4.1.4, @vitest/coverage-v8@4.1.4 [VERIFIED: npm view 2026-04-10]

### Tertiary (LOW confidence — training knowledge)
- Vitest ESM `.js` → `.ts` resolution behavior: standard with default config but depends on tsconfig moduleResolution setting [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Bug identification: HIGH — all three bugs verified directly in source code
- Bug fix approaches: HIGH (Bugs 2 and 3) / MEDIUM (Bug 1 — stream attach approach is sound but untested)
- Test framework setup: HIGH — vitest version verified from npm registry; absence from package.json verified
- Rate limiting testability: HIGH — functions confirmed private; extraction pattern confirmed necessary

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable dependencies, fast-moving only for vitest minor versions)
