---
phase: 06-keycloak-preparation
plan: 02
subsystem: auth-api, login-ui, i18n, docs
tags: [keycloak, auth, login, provider, i18n, documentation]
dependency_graph:
  requires: [06-01]
  provides: [provider-aware-auth-api, keycloak-login-ui, keycloak-setup-docs]
  affects: [server/authApi.ts, src/pages/LoginPage.tsx, src/i18n/translations.ts, docs/keycloak-setup.md]
tech_stack:
  added: []
  patterns: [provider-guard-405, useEffect-config-fetch, conditional-render-provider, top-level-vi-mock]
key_files:
  created:
    - tests/authConfigProvider.test.ts
    - docs/keycloak-setup.md
  modified:
    - server/authApi.ts
    - src/pages/LoginPage.tsx
    - src/i18n/translations.ts
decisions:
  - "GET /config returns provider field (local|keycloak) — public config, not sensitive (T-06-08 accepted)"
  - "POST /login returns 405 in keycloak mode before credential parsing — guard at handler entry (D-04)"
  - "LoginPage fetches /api/auth/config on mount via useEffect; defaults to local on error — no flash of wrong UI"
  - "Keycloak button click shows inline info banner (not redirect) per D-06 — v1 limitation, full OIDC deferred"
  - "Test mocks use top-level vi.mock with vi.mocked().mockReturnValue() in beforeEach — avoids nested mock warnings"
metrics:
  duration_min: 35
  completed: "2026-04-10"
  tasks: 2
  files: 5
---

# Phase 6 Plan 2: Auth API Provider-Awareness and LoginPage Keycloak Toggle Summary

Provider-aware /config and /login endpoints, LoginPage Keycloak conditional render with info banner, 4 i18n keys (de+en), and step-by-step Keycloak admin setup documentation.

## What Was Built

### Task 1: authApi, LoginPage, i18n, tests (TDD)

**server/authApi.ts** — extended with two provider-aware changes:
- `GET /config` now returns `{ twoFactorEnabled, provider }` where provider is `'local'` or `'keycloak'`
- `POST /login` returns `405 Method Not Allowed` with message `"Local login is disabled. This instance uses Keycloak SSO. Contact your administrator."` when `getAuthProvider() === 'keycloak'` — guard runs before any credential parsing (D-04, T-06-07)

**src/i18n/translations.ts** — 4 new bilingual keys added:
- `loginKeycloakButton`: "Mit Keycloak anmelden" / "Login with Keycloak"
- `loginKeycloakInfoTitle`: "Keycloak SSO konfiguriert" / "Keycloak SSO configured"
- `loginKeycloakInfoBody`: full de+en message about redirect not yet implemented
- `loginKeycloakSubtitle`: "Single Sign-On" / "Single Sign-On"

**src/pages/LoginPage.tsx** — provider-aware conditional render:
- `useEffect` on mount fetches `/api/auth/config` and reads `provider` field
- `useState<'local' | 'keycloak'>` defaults to `'local'` (no flash of wrong UI, safe on fetch error)
- Subtitle changes to `t('loginKeycloakSubtitle')` in keycloak mode
- In keycloak mode: renders "Login with Keycloak" button (full-width, bg-blue-600 per UI-SPEC)
- Button click sets `showKeycloakInfo = true`, revealing blue info banner with `Info` icon
- In local mode: unchanged credentials/OTP form

**tests/authConfigProvider.test.ts** — 6 tests covering all behavior specs:
- /config returns provider field in both modes
- /login returns 405 in keycloak mode (regardless of credentials)
- /login works normally in local mode (regression: 200 token + 401 invalid creds)

### Task 2: docs/keycloak-setup.md

Complete Keycloak admin guide with 7 major sections:
1. Prerequisites
2. Create Realm (`emd`)
3. Create Client (`emd-app`, public)
4. Create Realm Roles (6 roles: admin, researcher, epidemiologist, clinician, data_manager, clinic_lead)
5. Configure Token Claim Mappers (role mapper with Multivalued OFF, centers mapper with Multivalued ON)
6. Create Users (with `centers` attribute and role mapping; valid center codes documented)
7. Verification (JWKS endpoint, token claim decode, EMD integration check)
Plus Troubleshooting table and Current Limitations section.

### Task 3: Checkpoint (auto-approved in auto mode)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 476c590 | test | Failing tests for /config provider field and /login 405 (TDD RED) |
| 6b2e05c | feat | authApi /config+/login, LoginPage toggle, i18n keys (TDD GREEN) |
| bc279f8 | feat | docs/keycloak-setup.md — Keycloak admin guide |

## Verification Results

- `npx vitest run tests/authConfigProvider.test.ts` — 6/6 passed
- `npx vitest run` (full suite) — 41/41 passed
- `npx tsc --noEmit` — no errors

All must_haves truths confirmed:
- GET /api/auth/config returns provider field ('local' or 'keycloak') — PASS
- POST /api/auth/login returns 405 when provider=keycloak (D-04) — PASS
- LoginPage shows Keycloak button when provider=keycloak, local form when provider=local — PASS
- Keycloak button click shows info banner (not a redirect) per D-06 — PASS
- docs/keycloak-setup.md exists with step-by-step admin guide — PASS

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest.config.ts missing from worktree**
- **Found during:** Task 1 (test run setup)
- **Issue:** The worktree had vitest.config.ts deleted from the index (part of the worktree isolation), causing test discovery to fail
- **Fix:** Restored vitest.config.ts from base commit (49ca5d5)
- **Files modified:** vitest.config.ts
- **Commit:** 6b2e05c

**2. [Rule 3 - Blocking] Server files missing from worktree causing test suite failures**
- **Found during:** Task 1 full test suite run
- **Issue:** server/dataApi.ts and related server files were deleted in the worktree's git index, causing dataApiCenter.test.ts to fail with "Cannot find module"
- **Fix:** Restored all deleted server files from base commit
- **Files modified:** server/dataApi.ts, server/dataDb.ts, server/fhirApi.ts, server/auditMiddleware.ts, server/auditDb.ts, server/auditApi.ts, server/fhirApiPlugin.ts, server/index.ts, server/types.d.ts
- **Commit:** 6b2e05c

**3. [Rule 1 - Refactor] Nested vi.mock warnings in test file**
- **Found during:** Task 1 TDD RED → GREEN
- **Issue:** Initial test file used vi.mock inside beforeEach (after vi.resetModules), causing vitest to warn about non-top-level mocks
- **Fix:** Refactored to top-level vi.mock with vi.mocked().mockReturnValue() per-test control — cleaner, no warnings
- **Files modified:** tests/authConfigProvider.test.ts
- **Commit:** 6b2e05c

## Known Stubs

None — all provider detection is live (fetches /api/auth/config), all i18n keys are wired with real translations, documentation is complete.

## Threat Flags

No new threat surface introduced beyond the plan's threat model. The /config endpoint returning provider field was already analyzed as T-06-08 (accepted — not sensitive).

## Self-Check: PASSED

- server/authApi.ts: exists, contains getAuthProvider import and provider guard
- src/pages/LoginPage.tsx: exists, contains useEffect, provider state, Keycloak conditional render
- src/i18n/translations.ts: exists, contains all 4 loginKeycloak* keys
- tests/authConfigProvider.test.ts: exists, 6 tests all passing
- docs/keycloak-setup.md: exists, all required sections and content verified
- Commits: 476c590, 6b2e05c, bc279f8 all present in git log
