---
phase: 23-dependency-lint-cleanup
plan: 01
subsystem: dependency-hygiene
tags: [deps, audit, security, overrides, npm]
dependency_graph:
  requires: [phase-22-exit-state]
  provides: [clean-audit-moderate, deferred-upgrades-ledger]
  affects: [plan-23-02-lint, plan-23-03-scripts]
tech_stack:
  added: []
  patterns: [npm-overrides, deferred-ledger]
key_files:
  created:
    - DEFERRED-UPGRADES.md
    - .planning/phases/23-dependency-lint-cleanup/23-01-SUMMARY.md
  modified:
    - package.json
    - package-lock.json
decisions: [D-01, D-02, D-04, D-05, D-06, D-15, D-16, D-21]
metrics:
  commits: 8
  tasks: 4
  duration: ~8min
  completed_date: 2026-04-23
requirements: [DEPS-01]
---

# Phase 23 Plan 01: Dependency Upgrade & Audit Remediation Summary

**One-liner:** Resolved the single moderate CVE (`follow-redirects` via `package.json#overrides`) and applied 11 non-breaking minor/patch bumps across 6 atomic commits; deferred 5 major upgrades to `DEFERRED-UPGRADES.md`. Audit clean at moderate; safety net (608/608 tests, build, knip) green after every commit.

## Before / After — `npm audit --audit-level=moderate`

### Before (baseline, 2026-04-23)

```
# npm audit report

follow-redirects  <=1.15.11
Severity: moderate
follow-redirects leaks Custom Authentication Headers to Cross-Domain Redirect Targets - https://github.com/advisories/GHSA-r4q5-vmmm-2653
fix available via `npm audit fix`
node_modules/follow-redirects

1 moderate severity vulnerability
```

Transitive chain confirmed:
```
emd-app@1.4.0
`-- http-proxy-middleware@3.0.5
  `-- http-proxy@1.18.1
    `-- follow-redirects@1.15.11
```

### After

```
found 0 vulnerabilities
```

Resolution: `package.json#overrides` pin of `follow-redirects@^1.16.0` (deterministic, per D-02/D-21). `npm ls follow-redirects` now resolves to `1.16.0`. **No `npm audit fix` or `--force` was used** (D-01).

## Commit Table

| SHA       | Package Group                                                         | Decision | Safety Net                            |
| --------- | --------------------------------------------------------------------- | -------- | ------------------------------------- |
| `852ea14` | `overrides` + `follow-redirects@^1.16.0`                              | D-02 D-21 | test:ci 608/608, build 0, knip 0, audit 0 |
| `086e5b6` | `DEFERRED-UPGRADES.md` (5 majors)                                     | D-05 D-06 | test:ci 608/608, build 0, knip 0       |
| `770cf4c` | `@tailwindcss/vite` 4.2.2→4.2.4, `tailwindcss` 4.2.2→4.2.4 (coupled)  | D-04     | test:ci 608/608, build 0, knip 0, audit 0 |
| `e0db084` | `typescript` 6.0.2→6.0.3, `vitest` 4.1.4→4.1.5, `vite` 8.0.4→8.0.10 (coupled) | D-04 | test:ci 608/608, build 0, knip 0, audit 0 |
| `d1032b8` | `eslint-plugin-react-hooks` 7.0.1→7.1.1                               | D-04     | test:ci 608/608, build 0, knip 0, audit 0 |
| `4006ee9` | `globals` 17.4.0→17.5.0                                               | D-04     | test:ci 608/608, build 0, knip 0, audit 0 |
| `23a18cf` | `lucide-react` 1.8.0→1.9.0, `react-router-dom` 7.14.0→7.14.2, `better-sqlite3` 12.8.0→12.9.0 (batch) | D-04 | test:ci 608/608, build 0, knip 0, audit 0 |
| `eae0cb0` | `typescript-eslint` 8.58.0→8.59.0 (minor, per A3)                     | D-04     | test:ci 608/608, build 0, knip 0, audit 0 |

Total: **8 commits** (plus this SUMMARY commit).

## Post-state `npm outdated`

```
Package      Current   Wanted  Latest  Location                  Depended by
@eslint/js    9.39.4   9.39.4  10.0.1  node_modules/@eslint/js   emd-app
@types/node  24.12.2  24.12.2  25.6.0  node_modules/@types/node  emd-app
eslint        9.39.4   9.39.4  10.2.1  node_modules/eslint       emd-app
jwks-rsa       3.2.2    3.2.2   4.0.1  node_modules/jwks-rsa     emd-app
otplib        12.0.1   12.0.1  13.4.0  node_modules/otplib       emd-app
```

**All 5 remaining entries are D-05 deferred majors** — documented in `DEFERRED-UPGRADES.md`. Zero non-deferred packages remain outdated. (Exit code 1 is expected behavior from `npm outdated` when any package is listed.)

## DEFERRED-UPGRADES.md Snapshot

| H2 Section    | Current  | Latest  | Revisit Trigger |
| ------------- | -------- | ------- | --------------- |
| `eslint`      | 9.39.4   | 10.2.1  | When `typescript-eslint@9.x` ships w/ `eslint@10.x` peer |
| `@eslint/js`  | 9.39.4   | 10.0.1  | Tracks `eslint` major |
| `jwks-rsa`    | 3.2.0    | 4.0.1   | KEYCLK-01 (Keycloak OIDC redirect) planning phase |
| `otplib`      | 12.0.1   | 13.4.0  | Future TOTP flow revisit (recovery-code UX revamp) |
| `@types/node` | 24.12.2  | 25.6.0  | When CI adopts Node 24 LTS |

`typescript-eslint` NOT deferred — `npm view typescript-eslint version` returned `8.59.0` (minor) at execution time, applied in commit `eae0cb0` per RESEARCH §A3.

## Safety-net Evidence (final state)

- `npm run test:ci` → **608/608 passing**, 57 test files, 0 skips
- `npm run build` → exit 0 (Vite/rolldown bundle, warnings about chunk size are pre-existing and unrelated)
- `npm run knip` → exit 0 (configuration hints only, no regressions)
- `npm audit --audit-level=moderate` → **0 vulnerabilities**

## Deviations from Plan

### Minor: typescript `~` vs `^` range preservation

- **Found during:** Task 2 commit 2b (TS/Vitest/Vite trio)
- **Issue:** `npm install typescript@6.0.3` wrote `"typescript": "^6.0.3"` — but the pre-existing range was tilde (`~6.0.2`).
- **Fix:** Manually restored tilde (`~6.0.3`) to preserve the explicit patch-only policy for TypeScript, then re-ran `npm install` to regenerate lockfile.
- **Files modified:** `package.json`, `package-lock.json`
- **Rule classification:** Rule 2 (auto-preserve existing range policy) — the plan's acceptance criteria explicitly required `typescript@~6.0.3`.
- **Commit:** folded into `e0db084`

### Noted: typescript-eslint transitive jump during react-hooks install

- **Observed:** When `eslint-plugin-react-hooks@7.1.1` was installed (commit `d1032b8`), `npm` resolved `typescript-eslint` to `8.58.1` transitively (within the existing `^8.58.0` range). No package.json change; lockfile shows the bump.
- **Action:** None required. Within caret range; no major version leak; all safety-net gates green. The subsequent explicit bump to `8.59.0` in commit `eae0cb0` supersedes.

### Authentication gates

None. All operations were local `npm`/`git` commands.

## Known Stubs

None. This plan is pure dependency hygiene with no code-level changes that could introduce stubs.

## Self-Check: PASSED

- `package.json` contains `"overrides"` with `"follow-redirects": "^1.16.0"` — FOUND
- `DEFERRED-UPGRADES.md` exists with 5 H2 sections — FOUND
- `23-01-SUMMARY.md` exists at `.planning/phases/23-dependency-lint-cleanup/` — FOUND (this file)
- All 8 commits present in `git log a3e6b11..HEAD`:
  - `852ea14` FOUND
  - `086e5b6` FOUND
  - `770cf4c` FOUND
  - `e0db084` FOUND
  - `d1032b8` FOUND
  - `4006ee9` FOUND
  - `23a18cf` FOUND
  - `eae0cb0` FOUND
- Final gates: `npm audit --audit-level=moderate` → 0 vulnerabilities; `npm run test:ci` → 608/608; `npm run build` → exit 0; `npm run knip` → exit 0.

Plan 23-01 complete. Post-state ready as input for Plan 23-02 (ESLint tightening against final dep surface).
