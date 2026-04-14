---
phase: 07-site-roster-correction-synthetic-data
plan: 03
subsystem: users-migration-and-docs
tags: [migration, users, docs, roster, security, lockout-prevention]
one_liner: "Server-startup _migrateRemovedCenters strips org-ukb/org-lmu/org-ukm from data/users.json and reassigns empty arrays to ['org-uka']; on-disk users.json + server/index.ts default seed reflect the 7-site roster; 3 stale bundle files deleted; README + 3 docs sweep clean (only Lastenheft historical/v1.5-explanation residuals remain)."
requirements: [SITE-03, SITE-04, SITE-05, SITE-06, SITE-07]
wave: 3
depends_on: ["07-01", "07-02"]
provides:
  - "_migrateRemovedCenters() in server/initAuth.ts — strips removed IDs, fallback ['org-uka']"
  - "REMOVED_CENTER_IDS Set covering org-ukb/org-lmu/org-ukm"
  - "Migration chained inside _migrateUsersJson AFTER _migrateCenterIds"
  - "data/users.json with 7 users on locked roster (passwordHash bytewise preserved)"
  - "server/index.ts default-users seed aligned to new roster"
  - "tests/initAuthMigration.test.ts (4 tests covering strip / fallback / no-op)"
  - "Updated README.md, docs/Konfiguration.md, docs/Benutzerhandbuch.md, docs/Lastenheft.md"
requires:
  - "Plan 07-01 locked roster + SHORTHAND_TO_ORG"
  - "Plan 07-02 generated bundles for the 5 new sites"
  - "Existing _migrateCenterIds + _atomicWrite + _migrateUsersJson chain (unchanged)"
affects:
  - "Phase 8 (cohort analytics) — runs against the now-clean users.json + 7-site bundles"
  - "Any operator upgrading from v1.0/v1.1: first server boot transparently migrates legacy users.json"
key_files:
  created:
    - tests/initAuthMigration.test.ts
  modified:
    - server/initAuth.ts
    - server/index.ts
    - data/users.json
    - README.md
    - docs/Konfiguration.md
    - docs/Benutzerhandbuch.md
    - docs/Lastenheft.md
  deleted:
    - public/data/center-bonn.json
    - public/data/center-muenchen.json
    - public/data/center-muenster.json
decisions:
  - "Migration ordering locked: _migrateRemovedCenters runs AFTER _migrateCenterIds. Any legacy shorthand (e.g. 'UKB') must first be promoted to 'org-ukb' before the removal filter recognizes it."
  - "Empty-centers fallback hard-coded to ['org-uka'] (Aachen). Aachen is the only kept site present in every v1.0-era user record, so it minimizes user disruption while guaranteeing access remains functional."
  - "On-disk users.json rewritten in this plan (not left to first-boot migration alone) so the git diff is reviewable and the codebase ships in a clean post-migration state."
  - "passwordHash values preserved bytewise — no users are forced to change passwords as a side-effect of the roster switch."
  - "docs/Lastenheft.md line 39 (BC-coverage Münster fact) left unchanged: it is a domain-level statement about the EyeMatics consortium's real-world Broad-Consent coverage, not a software-roster claim. A v1.5 Anmerkung was appended at the end of the document to make the scope-of-removal explicit."
  - "docs/Pflichtenheft.md had ZERO roster references — no-op. Confirmed by grep."
metrics:
  duration: ~6 min (parallel executor)
  completed: 2026-04-14
  tasks_completed: 3
  tests_passing: 240
---

# Phase 07 Plan 03: Users Migration + Docs Sweep Summary

## Pre-Migration vs Post-Migration users.json

| Username       | centers (pre)                                              | centers (post)                                                              | Change |
|----------------|------------------------------------------------------------|-----------------------------------------------------------------------------|--------|
| admin          | [org-uka, org-ukb, org-lmu, org-ukt, org-ukm]              | [org-uka, org-ukc, org-ukd, org-ukg, org-ukl, org-ukmz, org-ukt]            | extended to 7 |
| forscher1      | [org-uka]                                                  | [org-uka]                                                                   | unchanged |
| forscher2      | [org-ukb]                                                  | [org-ukc]                                                                   | reassigned (Bonn → Chemnitz) |
| epidemiologe   | [org-uka, org-ukb, org-lmu]                                | [org-uka, org-ukc, org-ukd]                                                 | reassigned (ukb→ukc, lmu→ukd) |
| kliniker       | [org-ukt]                                                  | [org-ukt]                                                                   | unchanged |
| diz_manager    | [org-ukm]                                                  | [org-ukmz]                                                                  | reassigned (Münster → Mainz) |
| klinikleitung  | [org-uka, org-ukb, org-lmu, org-ukt, org-ukm]              | [org-uka, org-ukc, org-ukd, org-ukg, org-ukl, org-ukmz, org-ukt]            | extended to 7 |

All 7 `passwordHash` values preserved bytewise — confirmed by sampling `admin.passwordHash` before/after rewrite.

## Migration Chain (server/initAuth.ts)

```
_migrateUsersJson(filePath)
  ├── 1. add bcrypt passwordHash for users missing one
  ├── 2. _migrateCenterIds  (SHORTHAND_TO_ORG: 'UKA' → 'org-uka', etc.)
  └── 3. _migrateRemovedCenters  (NEW v1.5)
         ├── filter centers, drop ['org-ukb', 'org-lmu', 'org-ukm']
         └── if filtered.length === 0  →  centers = ['org-uka']
  → if any step set needsWrite, _atomicWrite the result
```

Order matters: `_migrateRemovedCenters` MUST run after `_migrateCenterIds` so any legacy shorthand-form center (e.g. user holding `'UKB'`) is first promoted to `'org-ukb'` and then recognized by the removal filter.

## Files Modified / Deleted

| File | Change |
|------|--------|
| `server/initAuth.ts` | Added `REMOVED_CENTER_IDS` Set (3 IDs) + exported `_migrateRemovedCenters(users)` + invocation in `_migrateUsersJson` after `_migrateCenterIds` |
| `data/users.json` | Rewrote `centers` arrays per locked reassignment table; preserved passwordHash for all 7 users |
| `server/index.ts` | Default-users seed (lines 99-107) now uses only new-roster IDs; admin/klinikleitung get all 7 |
| `tests/initAuthMigration.test.ts` | NEW — 4 tests: strip/fallback/all-removed/already-clean |
| `public/data/center-bonn.json` | DELETED |
| `public/data/center-muenchen.json` | DELETED |
| `public/data/center-muenster.json` | DELETED |
| `README.md` | Centres (Test Data) table: 7 rows with curated/generated source column + generator note |
| `docs/Konfiguration.md` | centers.json example: 7 entries; default-users table aligned with new roster |
| `docs/Benutzerhandbuch.md` | Admin UI center-list line (12.1): UKA/UKC/UKD/UKG/UKL/UKMZ/UKT |
| `docs/Lastenheft.md` | Appended v1.5 Anmerkung documenting roster restriction |

## Commits

| Task | Hash    | Message |
|------|---------|---------|
| 1 (RED)   | 994a5fb | test(07-03): add failing tests for _migrateRemovedCenters |
| 1 (GREEN) | 09cfb05 | feat(07-03): _migrateRemovedCenters strips org-ukb/org-lmu/org-ukm with org-uka fallback |
| 2         | 17babca | feat(07-03): migrate users.json to new roster, delete stale bundles, update default seed |
| 3         | 3aec4cc | docs(07-03): sweep README + docs for 7-site roster |

## Verification Results

- `npx vitest run tests/initAuthMigration.test.ts` → **4 tests pass**
- `npx vitest run tests/fhirApi.test.ts` → **10 tests pass** (existing _migrateCenterIds tests unaffected)
- `npm test` → **23 files, 240 tests, all passing**
- `npx tsc -b --noEmit` → clean (no errors)
- users.json validator: `node -e "..."` → `OK 7 users` (no removed IDs, no empty arrays, length=7)
- `forscher2.centers === ['org-ukc']` ✓
- `diz_manager.centers === ['org-ukmz']` ✓
- `epidemiologe.centers === ['org-uka','org-ukc','org-ukd']` ✓
- `admin.passwordHash` byte-identical pre/post ✓
- `test ! -e public/data/center-bonn.json` && `test ! -e public/data/center-muenchen.json` && `test ! -e public/data/center-muenster.json` ✓
- `grep -c "org-ukb\|org-lmu\|org-ukm[^z]" server/index.ts` → `0`
- `grep -rnE "UKB|UKM[^Z]|LMU" src/ server/ tests/ --include='*.ts' --include='*.tsx' --include='*.json'` → no hits

## Final Sweep Residuals (Accepted)

| File | Line | Text | Rationale |
|------|------|------|-----------|
| `server/initAuth.ts` | 263 | `* v1.5 roster correction removes Bonn (org-ukb), München (org-lmu), Münster (org-ukm).` | Comment in the migration code explicitly documenting the removal set. Required for code-reading clarity; cannot be deleted without losing migration intent. |
| `docs/Lastenheft.md` | 39 | "Ca. 20% BC-Abdeckung in Münster" | Real-world Broad-Consent coverage figure for the EyeMatics consortium's clinical site at Münster — domain fact about the project's data-collection partners, NOT a claim about the EMD software roster. Preserved per plan. |
| `docs/Lastenheft.md` | (appended) | "Frühere Demo-Standorte (UKB Bonn, LMU München, UKM Münster) sind entfernt …" | The v1.5 Anmerkung explicitly names the removed sites to document the scope of the roster correction. Required for change-tracking; legitimate historical context. |

## Deviations from Plan

None — plan executed exactly as written.

`docs/Pflichtenheft.md` had zero matching roster references (confirmed via `grep -nE "UKB|UKM[^Z]|LMU|Bonn|Münster|Muenster|München|Muenchen" docs/Pflichtenheft.md` → no output). Treated as a documented no-op per the plan's Task 3 contingency.

## Threat Model Outcome

| Threat ID | Disposition | Outcome |
|-----------|-------------|---------|
| T-07-08 (DoS: user locked out after migration) | **mitigated** | `_migrateRemovedCenters` reassigns empty centers to `['org-uka']`. Tested by "reassigns to org-uka when all centers are removed" and "centers array contains only removed IDs". No user can be left with `centers.length === 0` after migration. |
| T-07-09 (Elevation: migration skipped or post-handler) | **mitigated** | Migration is chained inside `_migrateUsersJson()` which is called from `initAuth()` in `server/index.ts` BEFORE any router (`auditMiddleware`, `authMiddleware`, `authApiRouter`, `dataApiRouter`, `fhirApiRouter`) is mounted. Existing `_atomicWrite` ensures durability. |
| T-07-10 (Integrity: deleting bundles while in-flight requests load them) | accept | Delete is build/commit-time; demonstrator deployment pattern serves a single Express process — no concurrent-load race. |
| T-07-11 (InfoDisclosure: docs reference removed sites → confusion) | **mitigated** | README + Konfiguration + Benutzerhandbuch swept clean. Lastenheft annotated with v1.5 Anmerkung. Sweep grep against src/ server/ tests/ returns no hits. |

## Phase 7 ROADMAP Success Criteria Confirmation

| Criterion | Observable evidence |
|-----------|---------------------|
| 7-site roster locked across config + code | `data/centers.json` (Plan 07-01), `server/constants.ts`, `server/initAuth.ts SHORTHAND_TO_ORG`, `data/users.json`, `server/index.ts` default seed — all reference exactly UKA/UKC/UKD/UKG/UKL/UKMZ/UKT |
| Synthetic FHIR bundles generated reproducibly | `npm run generate-bundles` regenerates 5 bundles deterministically (Plan 07-02 SHA-1 fixtures) |
| Persisted users migrated to new roster on startup | `_migrateRemovedCenters` chained in `_migrateUsersJson`; `tests/initAuthMigration.test.ts` covers strip + fallback paths |
| Stale bundle files removed | `public/data/center-bonn.json`, `center-muenchen.json`, `center-muenster.json` deleted (verified via `test ! -e`) |
| Documentation reflects new roster | README + 3 doc files updated; sweep grep clean except annotated Lastenheft historical residuals |

## Known Stubs

None. All migrations and rewrites are wired end-to-end. The migration runs every server boot (idempotent — `changed=false` for already-clean users, no-op write).

## Threat Flags

None — no new network endpoints, auth paths, file-access patterns, or schema changes at trust boundaries beyond what `<threat_model>` already covers.

## Self-Check: PASSED

- Files confirmed on disk:
  - FOUND: tests/initAuthMigration.test.ts
  - FOUND: server/initAuth.ts (contains `_migrateRemovedCenters` + `REMOVED_CENTER_IDS`)
  - FOUND: server/index.ts (default seed updated, no stale IDs)
  - FOUND: data/users.json (7 users, new roster)
  - FOUND: README.md (7-site Centres table)
  - FOUND: docs/Konfiguration.md (7-entry centers.json + new default-users table)
  - FOUND: docs/Benutzerhandbuch.md (line 357 updated)
  - FOUND: docs/Lastenheft.md (v1.5 Anmerkung appended)
  - MISSING (intentional): public/data/center-bonn.json, center-muenchen.json, center-muenster.json
- Commits confirmed in `git log`:
  - FOUND: 994a5fb (Task 1 RED)
  - FOUND: 09cfb05 (Task 1 GREEN)
  - FOUND: 17babca (Task 2)
  - FOUND: 3aec4cc (Task 3)
- 240/240 vitest passing across the full suite.
