---
phase: 26-synthetic-data-realism
plan: 01
subsystem: terminology + data audit
tags: [terminology, seed-map, audit, snomed, icd-10-gm, ci-gate]
requires:
  - terminology._seedMap (Phase 25)
  - public/data/center-*.json
provides:
  - terminology._seedMap (extended +5 entries)
  - scripts/audit-bundle-codes.mjs
  - npm run audit:bundles
  - tests/audit-bundle-codes.test.ts
affects:
  - tests/terminology.test.ts (size assertion 10 → 15, +5 new it cases)
tech-stack:
  added: []
  patterns:
    - "ESM .mjs script (no tsx dep) for fast CI gate"
    - "Drift-guard test reads script source as text and asserts EXPECTED_SEED_KEYS mirrors _seedMap"
    - "BUNDLE_GLOB env override for testability without coupling to fixtures dir"
key-files:
  created:
    - scripts/audit-bundle-codes.mjs
    - tests/audit-bundle-codes.test.ts
  modified:
    - src/services/terminology.ts
    - tests/terminology.test.ts
    - package.json
decisions:
  - "D-01/D-02: Byte-identical (code) suffix in fullText for all 5 new entries"
  - "D-03: Audit wired as standalone npm run audit:bundles (not yet in test:ci chain — wiring deferred to 26-04 per D-16)"
  - "Whitelist split: WHITELIST_SYSTEMS (LOINC, ATC) vs WHITELIST_KEYS (SNOMED bodySite + procedure + method + segment markers) — keeps ATC blanket-whitelisted while staying strict on diagnostic SNOMED slots"
metrics:
  duration: ~12 min
  tasks: 2
  commits: 4
  tests-added: 8 (5 seed + 3 audit)
  tests-baseline: 642
  tests-after: 650
  completed: 2026-04-30
requirements: [SYNTH-01]
---

# Phase 26 Plan 01: Seed Extension and Audit Summary

Extended `_seedMap` with the 5 currently-unresolvable diagnosis codes audited in shipped bundles (SNOMED 312903003 DME, 362098006 RVO; ICD-10-GM E11, H43.1, T85.8) and added a standalone `audit-bundle-codes.mjs` CI gate that asserts every (system, code) pair across `public/data/center-*.json` resolves via seed or whitelist.

## What Was Built

### Task 1: `_seedMap` extension (commits `0de0cad` RED, `479ca44` GREEN)

5 new entries appended to `_seedMap` in `src/services/terminology.ts` after the existing `I25.1` entry, each with `{label, fullText}` × `{de, en}` and a byte-identical `(code)` suffix in fullText per D-01/D-02:

| System | Code | DE label | EN label |
|---|---|---|---|
| SNOMED | `312903003` | Diabetisches Makulaödem (DMÖ) | Diabetic macular edema |
| SNOMED | `362098006` | Retinaler Venenverschluss (RVV) | Retinal vein occlusion |
| ICD-10-GM | `E11` | E11 | E11 (T2DM parent code, distinct from `E11.9`) |
| ICD-10-GM | `H43.1` | H43.1 | H43.1 (Glaskörperblutung / Vitreous hemorrhage) |
| ICD-10-GM | `T85.8` | T85.8 | T85.8 (Sonstige Komplikation durch Implantate / Other complication of internal prosthetic devices) |

Existing 10 entries untouched; `_seedMap.size` is now 15 (assertion in `tests/terminology.test.ts` updated).

### Task 2: Audit script + CI gate (commits `c83a400` RED, `55e1469` GREEN)

- `scripts/audit-bundle-codes.mjs` — ESM, dependency-free. Walks `entry[].resource` on `Condition`/`Observation`/`Procedure`/`MedicationStatement` for `.code.coding[]`, `.reasonCode[].coding[]`, `.bodySite[].coding[]` (also single-form bodySite), and `.medicationCodeableConcept.coding[]`. Builds the distinct (system, code) inventory and reports any pair not whitelisted and not in `EXPECTED_SEED_KEYS`. Exit 0 on clean, 1 on any unresolvable (with stderr listing the offending tuples + originating file).
- `EXPECTED_SEED_KEYS` is a hand-mirrored constant kept in sync with `_seedMap.keys()`; drift is caught by the third audit test, which reads the script source and asserts every `_seedMap` key appears verbatim in it.
- `BUNDLE_GLOB` env var overrides the default `public/data/center-*.json` for testability (used by the "injected unknown code" test).
- Wired as `npm run audit:bundles` in `package.json`. NOT yet added to `test:ci` chain — that wiring is deferred to plan 26-04 per D-16, after generator changes stabilize.

Whitelist (D-03):
- `WHITELIST_SYSTEMS`: `http://loinc.org`, `http://www.whocc.no/atc` (medications, not diagnoses)
- `WHITELIST_KEYS`: SNOMED `362502000`/`362503005` (laterality bodySite), `36189003` (IVOM procedure), `252886007` (BCVA method), `anterior-segment`/`posterior-segment` (local segment markers)

## Verification Results

- `npm run audit:bundles` — `scanned 6 bundles, 30 distinct codes, 0 unresolvable` (exit 0)
- `npm test -- --run tests/terminology.test.ts` — 12/12 pass (5 new + existing)
- `npm test -- --run tests/audit-bundle-codes.test.ts` — 3/3 pass
- `npm run test:ci` — 650/650 pass (baseline 642 + 8 new; 62 test files)
- `npm run build` — clean
- `npm run lint` — clean (one autofix applied to import order in `tests/audit-bundle-codes.test.ts`)
- `npm run knip` — no new dead code (only pre-existing config hints)

## Deviations from Plan

None. Plan executed exactly as written.

## Decisions Made

- **EXPECTED_SEED_KEYS as a hand-mirror, not a dynamic import.** The plan presented this as the "preferred pragmatic" approach — chosen because `.mjs` cannot import `.ts` without a loader, and adding a loader would slow the CI gate. The drift-guard test is fast (string match) and runs in `test:ci`, so missing keys are caught immediately.
- **Whitelist split into two collections** (systems vs specific keys). ATC and LOINC are blanket-whitelisted (any code under those systems is non-diagnostic), but SNOMED requires specific allow-list entries because that system is also the source for diagnostic codes (267718000 AMD etc.) that DO need seed coverage.
- **`audit:bundles` not yet in `test:ci`.** Per D-16, CI wiring happens in 26-04 once the safety-net behavior is stable across the wave. The script is callable manually and asserted by `tests/audit-bundle-codes.test.ts` so it cannot regress silently.

## Commits

| Hash | Type | Description |
|---|---|---|
| `0de0cad` | test | RED: failing seed tests for 5 missing diagnosis codes |
| `479ca44` | feat | GREEN: extend `_seedMap` with 5 entries |
| `c83a400` | test | RED: failing audit-bundle-codes tests |
| `55e1469` | feat | GREEN: add audit script + npm wiring |

## Self-Check: PASSED

- `src/services/terminology.ts` — FOUND (15 seed entries)
- `scripts/audit-bundle-codes.mjs` — FOUND
- `tests/audit-bundle-codes.test.ts` — FOUND
- `tests/terminology.test.ts` — FOUND (extended)
- `package.json` — FOUND (`audit:bundles` wired)
- Commits `0de0cad`, `479ca44`, `c83a400`, `55e1469` — all FOUND in `git log`

## Threat Flags

None — this plan adds read-only audit tooling and seed strings; no new network endpoints, auth paths, or trust boundaries.
