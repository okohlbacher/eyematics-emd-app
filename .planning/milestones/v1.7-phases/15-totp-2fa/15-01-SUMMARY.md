---
phase: 15
plan: 01
subsystem: auth/totp-scaffold
tags: [totp, 2fa, scaffold, dependencies, middleware]
requires: []
provides: [totp-deps, totp-types, totp-middleware-rules, totp-test-stubs]
affects: [server/initAuth.ts, server/authMiddleware.ts, server/auditMiddleware.ts]
tech-stack:
  added: [otplib@13.4.0, qrcode@1.5.4, "@types/qrcode@1.5.6"]
  patterns: [optional-interface-extension, redact-fields-set, public-paths-list, it.todo-stubs]
key-files:
  created:
    - tests/totpEnrollment.test.ts
    - tests/totpAdmin.test.ts
  modified:
    - server/initAuth.ts
    - server/authMiddleware.ts
    - server/auditMiddleware.ts
    - package.json
    - package-lock.json
decisions:
  - "otplib 13.4.0 exports generateSecret/TOTP directly at module root (no .authenticator sub-namespace) — downstream plans must use named imports, not .authenticator"
  - "mustChangePassword added to UserRecord (was referenced by tests but missing from interface)"
  - "/api/auth/change-password added to PUBLIC_PATHS (was already needed by Phase 14 but absent)"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-17"
  tasks: 5
  files: 7
---

# Phase 15 Plan 01: TOTP 2FA Scaffolding Summary

One-liner: Install otplib/qrcode deps, extend UserRecord with 3 optional TOTP fields, add 2 TOTP paths to PUBLIC_PATHS + purpose rejection, extend audit redaction, and create 2 test stub files with 16 it.todo entries for Plans 02/03.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install otplib + qrcode + @types/qrcode | da079a9 | package.json, package-lock.json |
| 2 | Extend UserRecord with TOTP fields | 52465a1 | server/initAuth.ts |
| 3 | Expand authMiddleware PUBLIC_PATHS + purpose rejection | 08aff5a | server/authMiddleware.ts |
| 4 | Extend auditMiddleware redaction | 5bf806c | server/auditMiddleware.ts |
| 5 | Create Wave 0 test stub files | 6ecefb8 | tests/totpEnrollment.test.ts, tests/totpAdmin.test.ts |

## Installed Versions

From `npm ls otplib qrcode @types/qrcode`:
- `otplib@13.4.0` (dependencies)
- `qrcode@1.5.4` (dependencies)
- `@types/qrcode@1.5.6` (devDependencies)

Note: `@types/otplib` was NOT installed — otplib 13.4.0 ships its own `.d.ts` declarations.

## Git Diff Line Counts

- `server/initAuth.ts`: +7 lines (3 TOTP fields + mustChangePassword + comments)
- `server/authMiddleware.ts`: +14 lines (PUBLIC_PATHS expansion + purpose rejection)
- `server/auditMiddleware.ts`: +3 lines (REDACT_FIELDS + REDACT_PATHS)
- `tests/totpEnrollment.test.ts`: +17 lines (new file)
- `tests/totpAdmin.test.ts`: +10 lines (new file)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] mustChangePassword added to UserRecord interface**
- **Found during:** Task 2
- **Issue:** The plan's interface snapshot showed `mustChangePassword?: boolean;` in UserRecord, but the actual file didn't have it. Tests in the codebase reference this field (it was in the pre-reset state).
- **Fix:** Added `mustChangePassword?: boolean;` before the TOTP fields, preserving the expected shape for downstream test files.
- **Files modified:** server/initAuth.ts
- **Commit:** 52465a1

**2. [Rule 2 - Missing] /api/auth/change-password added to PUBLIC_PATHS**
- **Found during:** Task 3
- **Issue:** The plan's interface snapshot showed `PUBLIC_PATHS` including `/api/auth/change-password`, but the actual file only had 3 entries. Phase 14 likely added it to the main branch but the worktree branched before that.
- **Fix:** Added `/api/auth/change-password` to PUBLIC_PATHS alongside the two new TOTP paths.
- **Files modified:** server/authMiddleware.ts
- **Commit:** 08aff5a

**3. [Informational] otplib 13.4.0 API differs from plan acceptance criteria**
- **Issue:** Plan acceptance criteria says `require('otplib').authenticator.generateSecret()` — but otplib 13.4.0 exports `generateSecret` directly at the module root (no `.authenticator` sub-namespace). The `.authenticator` namespace existed in v12.x.
- **Impact on this plan:** None — Plan 01 only installs the package. Plans 02/03 that use otplib must use the correct 13.x API: `import { generateSecret, TOTP } from 'otplib'`.
- **Decision:** Documented for downstream plans. Package installation is correct at 13.4.0.

## Verification Results

- `npm ls otplib qrcode @types/qrcode`: all three packages at specified versions
- `node -e "require('otplib').generateSecret()"`: exits 0
- `node -e "require('qrcode').toDataURL('test').then(()=>{})"`: exits 0
- `npx tsc --noEmit -p tsconfig.app.json`: zero errors in all modified server files
- `grep -R "totpSecret|totp-enroll|enrollToken" server/`: matches in initAuth.ts, authMiddleware.ts, auditMiddleware.ts
- `npx vitest run tests/totpEnrollment.test.ts tests/totpAdmin.test.ts`: exits 0, 16 todo tests, 0 failures

## Wave Readiness

Wave 0 complete. Plans 02 and 03 can begin immediately:
- **Plan 02** (enrollment endpoints): UserRecord types ready, PUBLIC_PATHS updated, test stubs at `tests/totpEnrollment.test.ts`
- **Plan 03** (admin reset): UserRecord types ready, admin route framework in place, test stubs at `tests/totpAdmin.test.ts`

## Known Stubs

None — this plan creates scaffolding only. The `it.todo()` entries in test files are intentional and documented stubs for Plans 02/03.

## Threat Surface Scan

No new network endpoints introduced in this plan. Threat mitigations T-15-01 through T-15-04 applied as planned. T-15-05 and T-15-06 accepted/mitigated by PUBLIC_PATHS expansion.

## Self-Check

Verifying files and commits exist.

---
## Self-Check: PASSED

Files:
- FOUND: tests/totpEnrollment.test.ts
- FOUND: tests/totpAdmin.test.ts
- FOUND: server/initAuth.ts (modified)
- FOUND: server/authMiddleware.ts (modified)
- FOUND: server/auditMiddleware.ts (modified)

Commits:
- da079a9: chore(15-01): install otplib@13.4.0, qrcode@1.5.4, @types/qrcode@1.5.6
- 52465a1: feat(15-01): extend UserRecord with totpSecret, totpEnabled, totpRecoveryCodes
- 08aff5a: feat(15-01): expand authMiddleware PUBLIC_PATHS and purpose rejection for TOTP
- 5bf806c: feat(15-01): extend auditMiddleware redaction for TOTP fields and paths
- 6ecefb8: test(15-01): create Wave 0 TOTP test stub files (all it.todo)
