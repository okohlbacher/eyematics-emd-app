---
phase: 22-codebase-docs-consistency
plan: "02"
subsystem: codebase-quality
tags: [refactor, dead-code, knip, type-narrowing, D-06, D-07, D-14, CONSIST-03, CONSIST-04]
---

# Plan 22-02 — Dead-code removal + type narrowing

## Objective
Install knip, delete unused exports aggressively per D-06, narrow `any`/`unknown` in touched files per D-07, and consolidate duplicated type definitions. All atomic commits must keep `npm run test:ci` at 608/608 and `npm run build` green.

## knip baseline vs final

| Metric | Baseline (post install, pre-deletions) | Final |
|---|---|---|
| Unused files | (see knip output below) | 0 |
| Unused exports | 7 primitives/utilities | 0 |
| Unused types | 1 (`EyeKey`) | 0 |
| Unused devDependencies | 2 (`@types/bcryptjs`, `tailwindcss` [false positive]) | 0 |

Final `npx knip --reporter compact` → exit 0, no findings.

## Deletion table

| Module | Exports deleted | Exports retained (reason) | Commit |
|---|---|---|---|
| `package.json` devDeps | `@types/bcryptjs` | — | `110cf73` |
| `src/design-system/primitives/BrandMark.tsx` | `BrandMark` (component + file) | — | `6900d74` |
| `src/design-system/primitives/Sparkline.tsx` | `Sparkline` (component + file) | — | `9c8f7f4` |
| `server/cohortCache.ts` | `stopPurgeInterval` | — | `2411039` |
| `shared/loinc.ts` | LOINC refraction constants | — | `b3702d8` |
| `src/context/AuthContext.tsx` | `ADMIN_ROLES`, `CLINICAL_ROLES`, `ManagedUser` | — | `e022697` |
| `src/services/issueService.ts` | `getIssues` | — | `b3f8f1e` |
| `src/utils/dateFormat.ts` | `formatDateTime` | — | `07e51e7` |
| `src/design-system/palette.ts` | `EyeKey` type | — | `1e2e830` |
| `server/types.d.ts` | — | Ambient-only augmentation (knip ignore) — consumed by `auditMiddleware.ts` reading `req._capturedBody` and its test mocking the field. Exports no values; TypeScript loads it via tsconfig include. | `2a86ad5` |
| `tailwindcss` (devDep) | — | Knip false-positive — loaded via PostCSS config, not a project import. Added to `knip.json` `ignoreDependencies`. | `2a86ad5` |

## any/unknown narrowing (D-07 touched-file scope)

Plan 22-01 touched 14 files + Plan 22-02 touched files. Scan after Wave 1 dedup showed no un-narrowed `: any` in the touched-file scope outside of intentional `catch (err: unknown)` cases. The `.then` → async/await rewrites inherently narrowed Promise handlers, eliminating the prior `any` touchpoints. No dedicated narrowing commits were required beyond what Wave 1 implicitly achieved.

Result: 0 remaining un-narrowed `: any` in touched files (grep-verified across `src/`, `server/`, `shared/`).

## Type dedup consolidation

Grep across `src/`, `server/`, `shared/` for `type (Cohort|CohortFilter|UserRole)`:
- `Cohort` — single definition (no dedup needed)
- `CohortFilter` — single definition (no dedup needed)
- `UserRole` — single definition (no dedup needed)

No consolidation required — the RESEARCH-suggested candidates were already single-sourced after Plan 22-01's shim dispositions. `shared/types/` was not created since no ≥2 duplicated definitions exist.

## Safety-net evidence

- `npm run test:ci` → exit 0, **608/608 passing** after every atomic commit in this plan
- `npm run build` → exit 0 after every deletion commit (Vite + rolldown dynamic-resolution guard per Pitfall 3)
- `npx knip --reporter compact` → exit 0, no findings at plan completion

## knip config path + install command

- Config: `knip.json` (repo root)
- Install: `npm install --save-dev knip@^6.6.2`
- Script: `npm run knip`
- `knip.json` additions per Task 2 findings: `ignoreDependencies: ["tailwindcss"]`, `ignore: ["server/types.d.ts"]`

## Commits (11 total, atomic, base `e2a1a23`)

1. `e8371fd` chore: install knip + entry-points config per D-14
2. `110cf73` refactor: remove unused @types/bcryptjs devDep per D-06
3. `6900d74` refactor: remove unused BrandMark primitive per D-06
4. `9c8f7f4` refactor: remove unused Sparkline primitive per D-06
5. `2411039` refactor: remove unused stopPurgeInterval export per D-06
6. `b3702d8` refactor: remove unused LOINC refraction constants per D-06
7. `e022697` refactor: remove unused ADMIN_ROLES, CLINICAL_ROLES, ManagedUser per D-06
8. `b3f8f1e` refactor: remove unused getIssues from issueService per D-06
9. `07e51e7` refactor: remove unused formatDateTime from dateFormat per D-06
10. `1e2e830` refactor: remove unused EyeKey type from palette per D-06
11. `2a86ad5` chore: knip ignore tailwindcss + server/types.d.ts (ambient-only) per D-06

## key-files.created
- `knip.json`

## key-files.modified
- `package.json`, `package-lock.json` — knip devDep + script
- `src/design-system/primitives/index.ts` — removed `BrandMark`, `Sparkline` re-exports
- `src/design-system/palette.ts`, `src/utils/dateFormat.ts`, `src/services/issueService.ts`, `src/context/AuthContext.tsx`, `shared/loinc.ts`, `server/cohortCache.ts` — export deletions
- `server/types.d.ts` — ambient-only retention comment

## Deviations
- Type dedup (Part C): zero consolidations needed — RESEARCH-suggested candidates already had single definitions after Wave 1. Documented in SUMMARY rather than forcing a `shared/types/` file.
- any/unknown narrowing: Wave 1 async/await rewrites already eliminated the touched-file `: any` occurrences; no dedicated narrowing commits required.
- tailwindcss devDep: knip false-positive (PostCSS config consumption); added to `ignoreDependencies` instead of deleting.
- server/types.d.ts: ambient-only module augmentation; knip cannot detect its consumer (implicit via tsconfig `include`). Added to `knip.json` `ignore` with inline retention comment documenting the reason.
