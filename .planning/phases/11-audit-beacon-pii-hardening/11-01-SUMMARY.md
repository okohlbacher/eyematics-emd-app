---
phase: 11-audit-beacon-pii-hardening
plan: 01
subsystem: server/audit
tags: [security, hashing, hmac, pii, settings]
dependency_graph:
  requires:
    - server/initAuth.ts (pattern mirror)
    - config/settings.yaml (flat settings shape with audit section)
    - server/settingsApi.ts (non-admin strip)
    - node:crypto (HMAC-SHA256)
  provides:
    - server/hashCohortId.ts :: initHashCohortId(settings), hashCohortId(id), _resetForTesting
    - config/settings.yaml :: audit.cohortHashSecret (64-char dev value)
    - server/index.ts :: initHashCohortId wired between initAuth and initAuditDb
  affects:
    - Plan 11-02 (beacon handler will import hashCohortId)
    - Plan 11-03 (verification of PII-minimal audit events)
    - Phase 12 / AGG-05 (audit event reuses hashCohortId without modification)
tech_stack:
  added: []
  patterns:
    - Module-level state + init-then-getter pattern (mirrors server/initAuth.ts)
    - Fail-fast startup validation with FATAL error
    - Non-admin projection strip with nested-object preservation
key_files:
  created:
    - server/hashCohortId.ts
    - tests/hashCohortId.test.ts
  modified:
    - config/settings.yaml
    - server/index.ts
    - server/settingsApi.ts
    - tests/settingsApi.test.ts
decisions:
  - D-04 honored: HMAC-SHA256 truncated to 16 hex chars (64 bits)
  - D-05 honored: secret sourced from settings.yaml, not env
  - D-06 honored: deterministic — same (secret, id) → same hash
  - D-07 honored: module exported for Phase 12 AGG-05 reuse
metrics:
  tasks_completed: 2
  tests_added: 10
  files_created: 2
  files_modified: 4
  completed_date: 2026-04-16
requirements: [CRREV-01]
---

# Phase 11 Plan 01: hashCohortId Primitive + Settings Strip Summary

HMAC-SHA256 cohort-id hashing utility with fail-fast startup validation, plus GET /api/settings cohortHashSecret strip for non-admin roles.

## Files Created / Modified

| Change   | Path                             | Purpose                                                                                  |
| -------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| created  | `server/hashCohortId.ts`         | `initHashCohortId(settings)` + `hashCohortId(id)` + `_resetForTesting()`                 |
| created  | `tests/hashCohortId.test.ts`     | 8 assertions covering determinism, truncation, fail-fast, call-before-init, rotation    |
| modified | `config/settings.yaml`           | Added `audit.cohortHashSecret` (64-char dev value) at end of file                        |
| modified | `server/index.ts`                | Imported `initHashCohortId` and called it between `initAuth` and `initAuditDb`           |
| modified | `server/settingsApi.ts`          | Extended non-admin GET strip to remove `audit.cohortHashSecret` while preserving siblings|
| modified | `tests/settingsApi.test.ts`      | Updated YAML fixture + added 2 tests (non-admin strip, admin keeps)                      |

## Secret Configuration

### Dev value (in `config/settings.yaml`)

```yaml
audit:
  cohortHashSecret: 'dev-cohort-hash-secret-please-replace-in-prod-xxxxxxxxxxxxxx'
```

64 characters — comfortably above the 32-char floor enforced by `initHashCohortId`.

### Production generation command

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Generates a 64-hex-char secret. Each site deployer replaces the dev value with its own production value. Rotating the secret invalidates prior hashes (hash values are per-secret) — rotation is acceptable for an audit trail, not for cross-event joins over the rotation boundary.

## Settings Schema Change

`config/settings.yaml` gains a new top-level `audit:` object. Currently it carries only `cohortHashSecret`, but the strip logic in `server/settingsApi.ts` is written to preserve any other `audit.*` keys future plans add (e.g. `retentionDays` — already parsed at `server/index.ts:127`). The strip removes `cohortHashSecret` specifically and drops the whole `audit:` section only if it becomes empty after the strip.

## Startup Ordering

```
server/index.ts:
  line 117  initAuth(DATA_DIR, settings);      // loads JWT secret + migrates users.json
  line 120  initHashCohortId(settings);         // NEW — loads cohort hash secret, fail-fast
  line 129  initAuditDb(DATA_DIR, retentionDays); // opens audit.db
```

Rationale: `initHashCohortId` must complete before any route is mounted (let alone before `app.listen()`), so any call to `hashCohortId(id)` from a future handler finds `_secret` populated. Placement after `initAuth` keeps settings-consuming inits clustered; placement before `initAuditDb` means the audit DB never opens on a server that can't hash its cohort ids.

## Tests Added

- **tests/hashCohortId.test.ts** (new file, 8 tests):
  - `same input produces same hash (determinism / D-06 / T-11-02)`
  - `different inputs produce different hashes`
  - `produces exactly 16 hex chars (D-04)`
  - `throws if secret missing (T-11-03)`
  - `throws if secret shorter than 32 chars (T-11-03)`
  - `throws if hashCohortId called before initHashCohortId`
  - `same (secret, id) produces same hash across re-init (cross-restart determinism / D-06)`
  - `different secrets produce different hashes for the same id (rotation sanity)`
- **tests/settingsApi.test.ts** (extended, +2 tests):
  - `strips audit.cohortHashSecret for non-admin (T-11-04)`
  - `returns audit.cohortHashSecret for admin (no stripping)`

**Total new: 10 tests.** Full suite: 350/350 passing across 34 files (baseline 340/33).

## Threat Model Outcomes

| Threat   | Disposition | Outcome                                                                                              |
| -------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| T-11-02  | mitigated   | Deterministic HMAC; no per-process salt; no time input. Tests 1 and 7 lock behavior.                  |
| T-11-03  | mitigated   | `initHashCohortId` throws FATAL for missing or short secret. Tests 4 and 5 cover both paths.          |
| T-11-04  | mitigated   | Non-admin GET /api/settings strips `audit.cohortHashSecret`. Tests added in `tests/settingsApi.test.ts`.|
| T-11-05  | mitigated   | Secret never passed to console.log, JSON.stringify, or error bodies. Verified by code review.         |
| T-11-01  | transferred | Raw cohort id in audit rows is Plan 02's responsibility; Plan 01 delivers the primitive.              |

## Deviations from Plan

None — plan executed exactly as written. Fixture updates, test additions, source edits, and startup wiring all match the action blocks in 11-01-PLAN.md verbatim.

## Commits

| Phase | Hash    | Message                                                                                   |
| ----- | ------- | ----------------------------------------------------------------------------------------- |
| RED   | 7faf00f | `test(11-01): add failing tests for audit.cohortHashSecret strip`                         |
| GREEN | 7e00b14 | `feat(11-01): strip audit.cohortHashSecret from non-admin GET /api/settings`              |
| RED   | cb654a1 | `test(11-01): add failing tests for hashCohortId HMAC-SHA256 primitive`                   |
| GREEN | 3b1182b | `feat(11-01): add hashCohortId HMAC-SHA256 primitive + wire into startup`                 |

Four commits total (two TDD RED→GREEN pairs), all atop base `5caee74`.

## Next Steps

- **Plan 11-02** (wave 2): beacon handler imports `hashCohortId` and replaces the raw cohort id in the GET /api/audit/events/view-open querystring with the hashed value before the audit row is written.
- **Plan 11-03** (wave 2): end-to-end verification — issue a beacon, inspect `audit.db` rows, confirm raw cohort id is absent and 16-hex hash is present.
- **Phase 12 / AGG-05**: reuses `hashCohortId` without modification when the aggregate endpoint logs a cohort-level audit event.

## Self-Check: PASSED

- `server/hashCohortId.ts` — FOUND
- `tests/hashCohortId.test.ts` — FOUND
- Commit `7faf00f` — FOUND
- Commit `7e00b14` — FOUND
- Commit `cb654a1` — FOUND
- Commit `3b1182b` — FOUND
- `npm test -- tests/hashCohortId.test.ts tests/settingsApi.test.ts --run` — 18/18 green
- `npm test -- --run` — 350/350 green across 34 files (no regressions; baseline 340/33)
