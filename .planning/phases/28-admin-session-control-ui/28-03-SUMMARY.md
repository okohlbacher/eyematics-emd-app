---
phase: 28-admin-session-control-ui
plan: "03"
subsystem: settings-ui
tags: [ttl, settings, i18n, session-management, client-validation]
dependency_graph:
  requires: [28-01, 28-02, 27-03]
  provides: [SESSUI-03-ui, ttlConversion-module, AppSettings.auth]
  affects: [src/pages/SettingsPage.tsx, src/services/settingsService.ts, src/i18n/translations.ts]
tech_stack:
  added: [src/services/ttlConversion.ts]
  patterns: [hours-ms-conversion, client-side-validation, settings-persist-pattern]
key_files:
  created:
    - src/services/ttlConversion.ts
  modified:
    - src/services/settingsService.ts
    - src/pages/SettingsPage.tsx
    - src/i18n/translations.ts
    - tests/settingsApi.test.ts
decisions:
  - "TTL inputs placed inside TOTP card separated by <hr> (consistent with UI-SPEC Component 3)"
  - "validateTtl called inline on every onChange to give immediate feedback (not only on save)"
  - "writeFileSync spy via vi.mocked(fs.writeFileSync) after static import for reliable mock access"
metrics:
  duration_minutes: 4
  tasks_completed: 2
  files_modified: 5
  tests_added: 11
  completed_date: "2026-05-14"
requirements: [SESSUI-03]
---

# Phase 28 Plan 03: TTL Conversion Helpers + SettingsPage TTL Form Summary

TTL conversion helpers (`hoursToMs`/`msToHours`/`validateTtl`) in a new `ttlConversion.ts` module, `AppSettings.auth` sub-object with defaults, and hour-denominated TTL inputs wired into SettingsPage's TOTP card with client validation and a dedicated Save button.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create ttlConversion.ts + extend AppSettings | fef29f6 | src/services/ttlConversion.ts, src/services/settingsService.ts |
| 2 | TTL form in SettingsPage + 7 i18n keys + settingsApi test | 4cbf543 | src/pages/SettingsPage.tsx, src/i18n/translations.ts, tests/settingsApi.test.ts |

## What Was Built

### Task 1 — `src/services/ttlConversion.ts`

Pure helper module with three exports:
- `hoursToMs(hours)` — `hours * 3_600_000`
- `msToHours(ms)` — `Math.round(ms / 3_600_000)`
- `validateTtl(refreshHours, capHours)` — returns `'ok' | 'refreshMin' | 'capMin'`, mirrors server-side validation in `settingsApi.ts` lines 88–106

`AppSettings` interface extended with `auth?: { refreshTokenTtlMs?, refreshAbsoluteCapMs? }`. `DEFAULTS` constant extended with `auth: { refreshTokenTtlMs: 28_800_000, refreshAbsoluteCapMs: 43_200_000 }` — ensures `resetSettings()` serializes valid TTL values (T-28-07 mitigation).

### Task 2 — `src/pages/SettingsPage.tsx` TTL section

- 4 new state variables: `refreshTtlHours`, `absoluteCapHours`, `ttlValidationError`, `ttlSaving`
- `loadSettings` useEffect now populates TTL state via `msToHours(s.auth?.refreshTokenTtlMs ?? 28_800_000)`
- `handleSaveTtl` async function: validates with `validateTtl`, calls `updateSettings({ auth: { refreshTokenTtlMs: hoursToMs(...), ... } })`, shows `savedBanner` on success
- `handleReset` extended to reset TTL state from `defaults.auth`
- New subsection inside TOTP card (after `<hr>`): `Clock` icon + section title, 2-column grid of number inputs, per-input hints with `aria-describedby`, inline `role="alert"` validation errors, dedicated Save button with `Loader2` spinner
- All color classes have `dark:` counterparts

### Task 2 — i18n keys (7 new keys, both `de` and `en`)

`settingsSessionTitle`, `ttlRefreshHours`, `ttlAbsoluteCapHours`, `ttlRefreshHint`, `ttlAbsoluteCapHint`, `ttlValidationRefreshMin`, `ttlValidationCapMin`

### Task 2 — `tests/settingsApi.test.ts` extension

New test "persists auth.refreshTokenTtlMs and auth.refreshAbsoluteCapMs (round-trip lock)":
- PUTs settings YAML with `auth.refreshTokenTtlMs: 7200000` and `auth.refreshAbsoluteCapMs: 14400000`
- Asserts PUT returns 200
- Inspects `writeFileSync` mock via `vi.mocked(fs.writeFileSync)` to verify persisted YAML contains exact auth values

## Verification Results

| Command | Result |
|---------|--------|
| `npx vitest run tests/ttlConversion.test.ts` | 10/10 GREEN |
| `npx vitest run tests/settingsApi.test.ts tests/outcomesI18n.test.ts` | 49/49 GREEN |
| `npm run test:ci` | 723/723 GREEN (619 baseline + 104 new) |
| `npx tsc --noEmit` | No errors |
| `npm run lint` | Clean (0 errors, 0 warnings after autofix) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Import sort order warning in settingsApi.test.ts**
- **Found during:** Task 2 lint check
- **Issue:** Adding `import fs from 'node:fs'` after `import express from 'express'` violated `simple-import-sort` rule (node builtins must precede third-party imports)
- **Fix:** Ran `npx eslint tests/settingsApi.test.ts --fix` to auto-sort imports
- **Files modified:** tests/settingsApi.test.ts
- **Commit:** 4cbf543 (included in task commit)

**2. [Rule 1 - Bug] Dynamic fs import in test didn't capture mock**
- **Found during:** Task 2 first test run
- **Issue:** `const fsModule = await import('node:fs')` inside test body returned a different module reference than the vi.mock() registered one
- **Fix:** Changed to static `import fs from 'node:fs'` at file top and used `vi.mocked(fs.writeFileSync)` to access the pre-registered spy
- **Files modified:** tests/settingsApi.test.ts
- **Commit:** 4cbf543

## Known Stubs

None. All state is wired to `loadSettings()` / `updateSettings()` which reads/writes `config/settings.yaml` via `/api/settings`.

## Threat Flags

None. This plan introduces no new network endpoints, auth paths, or file access patterns beyond what the existing `PUT /api/settings` route already exposes (T-28-08: accept disposition, no change to authorization).

## Self-Check: PASSED

Files created/modified all exist and commits are present in git history.
