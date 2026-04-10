# Phase 3: Phase 1-2 Integration Fixes - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix 3 integration bugs found during milestone audit: audit body capture for non-auth mutations, time filter param name mismatch, settings schema validator mismatch. Also formally verify USER-13 (rate limiting) and AUTH-05 (settings auth section) with automated tests.

</domain>

<decisions>
## Implementation Decisions

### Bug 1: Audit body capture (MEDIUM)
- **D-01:** Fix `req.body` being null for `POST /api/issues` and `PUT /api/settings` audit entries. The root cause is `express.json()` only mounted on `/api/auth` while other routes use `readBody()` which consumes the raw stream. Claude's discretion on approach — options include global body parsing with stream replay, capturing body inside `readBody()` and attaching to `req`, or a dedicated audit body-capture middleware.

### Bug 2: Time filter param mismatch (LOW)
- **D-02:** Fix client side — change `auditService.ts` to send `fromTime`/`toTime` instead of `from`/`to`. Server API contract (`auditApi.ts` reading `fromTime`/`toTime`) stays as-is. Update the `fetchAuditEntries` filter interface and `URLSearchParams` construction accordingly.

### Bug 3: Settings schema validator (LOW)
- **D-03:** Full rewrite of `validateSettingsSchema()` in `settingsApi.ts` to validate the entire `auth` section: `twoFactorEnabled` (boolean), `maxLoginAttempts` (number), `jwtSecret` (string), `otpCode` (string, optional). Not just a path fix — validate all auth fields that `initAuth.ts:getAuthConfig()` consumes. This catches future mismatches early.

### Verification: Automated tests
- **D-04:** Write automated test files for USER-13 (rate limiting) and AUTH-05 (settings auth section). Rate limiting tests must cover: 5 consecutive failures → account lock, exponential backoff timing, reset on successful login, configurable `maxLoginAttempts`. Settings tests must cover: nested `auth.twoFactorEnabled` accepted, top-level `twoFactorEnabled` rejected or handled gracefully, full auth section validation.
- **D-05:** Tests should exercise the actual server functions (unit-level) rather than requiring a running server. Import `validateSettingsSchema` and rate limiting functions directly.

### Claude's Discretion
- Body capture fix approach (D-01) — choose the most compatible strategy with the existing readBody() pattern
- Test framework choice (vitest already in devDependencies — use it)
- Whether to consolidate readBody() into express middleware long-term (note for Phase 4)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audit body capture (Bug 1)
- `server/auditMiddleware.ts` — Reads req.body for mutation logging; lines 10-11 note express.json() dependency
- `server/index.ts` — express.json() mounted only on /api/auth (line 144); middleware ordering
- `server/utils.ts` — readBody() raw stream reader used by issue/settings handlers

### Time filter params (Bug 2)
- `src/services/auditService.ts` — Client filter interface with `from`/`to` params (lines 23-24, 32-33)
- `server/auditApi.ts` — Server reads `fromTime`/`toTime` (lines 43-44)
- `server/auditDb.ts` — Filter type definition and SQL query construction (lines 38-39, 246-252)

### Settings schema validator (Bug 3)
- `server/settingsApi.ts` — validateSettingsSchema() checking top-level twoFactorEnabled (lines 26-34)
- `server/initAuth.ts` — getAuthConfig() reading auth.twoFactorEnabled with fallback (lines 69-76)
- `public/settings.yaml` — Current settings structure with nested auth section

### Rate limiting verification (USER-13)
- `server/authApi.ts` — loginAttempts Map, getLockState(), recordFailedLogin(), clearLoginAttempts() (lines 25-48)
- `server/initAuth.ts` — maxLoginAttempts config (line 76)

### Requirements
- `.planning/REQUIREMENTS.md` — AUDIT-01, AUDIT-02, AUDIT-09, AUTH-05, USER-13

### Milestone audit (bug source)
- `.planning/v1.0-MILESTONE-AUDIT.md` — Integration gaps section with all 3 bugs detailed

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/utils.ts:readBody()` — Raw stream body reader; must be understood to fix body capture
- `server/auditDb.ts:queryAuditEntries()` — Already accepts fromTime/toTime filters correctly
- `server/initAuth.ts:getAuthConfig()` — Canonical source for which auth fields exist and their types

### Established Patterns
- Express middleware ordering in server/index.ts: audit → auth → routes
- Raw Node http handler wrapping (Phase 1 D-01) — readBody() consumes stream, not express.json()
- Settings validation before write-back in settingsApi.ts

### Integration Points
- `server/index.ts` middleware chain — body parsing must not break readBody() for existing handlers
- `src/services/auditService.ts` → `server/auditApi.ts` → `server/auditDb.ts` — filter param flow
- `server/settingsApi.ts` → `public/settings.yaml` → `server/initAuth.ts` — settings round-trip

</code_context>

<specifics>
## Specific Ideas

- Rate limiting is already implemented in authApi.ts from Phase 2 — just needs formal test coverage, not reimplementation
- The initAuth.ts getAuthConfig() already handles both top-level and nested twoFactorEnabled (fallback logic at line 71-73) — the validator should match this flexibility or enforce the canonical nested path only

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-integration-fixes*
*Context gathered: 2026-04-10*
