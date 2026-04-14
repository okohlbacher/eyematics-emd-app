---
phase: 07-site-roster-correction-synthetic-data
plan: 02
subsystem: synthetic-data-generator
tags: [generator, fhir, prng, determinism, synthetic-data, tests]
one_liner: "Deterministic, zero-dep Mulberry32-seeded FHIR Bundle generator (library + CLI + 5-site runner) emits Chemnitz/Dresden/Greifswald/Leipzig/Mainz bundles (~45 patients each) covering AMD/DME/RVO with visus/CRT/IOP observations, 1–20 IVOM procedures, and Aflibercept/Bevacizumab medication statements; manifest now lists the 7-site roster."
requirements: [DATA-GEN-01, DATA-GEN-02, DATA-GEN-03, DATA-GEN-04, DATA-GEN-05, DATA-GEN-06]
wave: 2
depends_on: ["07-01"]
provides:
  - "scripts/prng.ts — hand-rolled Mulberry32 PRNG (mulberry32, seededRandInt, seededPick, addDays)"
  - "scripts/generate-center-bundle.ts — generateCenterBundle() library + tsx CLI"
  - "scripts/generate-all-bundles.ts — 5-site batch runner"
  - "npm run generate-bundles script (no new dependencies)"
  - "5 deterministic synthetic FHIR bundles in public/data/"
  - "public/data/manifest.json: 7-site alphabetical roster"
requires:
  - "Plan 07-01 locked roster (org-ukc, org-ukd, org-ukg, org-ukl, org-ukmz)"
  - "src/services/fhirLoader.ts extractCenters / extractPatientCases (unchanged)"
affects:
  - "Plan 07-03 (users.json migration + legacy bundle deletion + docs sweep)"
  - "Cohort Outcome Trajectories phase (downstream consumer of generated cohorts)"
key_files:
  created:
    - scripts/prng.ts
    - scripts/generate-center-bundle.ts
    - scripts/generate-all-bundles.ts
    - tests/generateCenterBundle.test.ts
    - tests/generatedBundles.test.ts
    - public/data/center-chemnitz.json
    - public/data/center-dresden.json
    - public/data/center-greifswald.json
    - public/data/center-leipzig.json
    - public/data/center-mainz.json
  modified:
    - package.json
    - public/data/manifest.json
decisions:
  - "Mulberry32 over seedrandom: zero-dep, BSD-style, 32 lines — meets determinism requirement without growing the dependency surface"
  - "Generator does NOT emit ImagingStudy entries for synthetic sites — the OCT jpeg asset library only contains images for Aachen and Tübingen; emitting references to non-existent files would break the case detail page"
  - "meta.lastUpdated derived from seed (addDays('2026-04-01', seed % 30)) so byte-identical regeneration is preserved"
  - "Hard cap of 500 patients enforced in generator (T-07-07 mitigation)"
  - "SITES list in generate-all-bundles.ts deliberately excludes center-aachen and center-tuebingen (T-07-04 mitigation: cannot accidentally overwrite curated reference bundles)"
  - "Per-site fixed seeds: UKC 70103, UKD 70104, UKG 70107, UKL 70112, UKMZ 70113"
metrics:
  duration: ~7 min (parallel executor)
  completed: 2026-04-14
  tasks_completed: 3
  tests_passing: 15
---

# Phase 07 Plan 02: Synthetic Data Generator + 5 Site Bundles Summary

## Generator Architecture

```
scripts/prng.ts                            (Mulberry32 — 32 LOC, zero deps)
        │
        ▼
scripts/generate-center-bundle.ts          (library + tsx CLI)
   exports: generateCenterBundle(input)
        │
        ▼
scripts/generate-all-bundles.ts            (5-site batch runner)
   reads SITES[]  →  writes public/data/center-{slug}.json
        │
        ▼
public/data/manifest.json                  (7-entry alphabetical roster)
        │
        ▼
server/fhirApi.ts → src/services/fhirLoader.ts (production load path)
```

## PRNG Choice

**Mulberry32** (32-bit state, period ~2³², BSD-licensed, public-domain reference). Selected over `seedrandom`/`random-seed` because:

1. **Zero dependencies** — fits the project constraint of minimal devDeps.
2. **Determinism is provably stable** — the algorithm is exactly 5 lines; no upstream version drift.
3. **Sufficient quality** for non-cryptographic synthetic data generation (we are not generating PII or security tokens).

A Mulberry32 instance is created once per `generateCenterBundle()` call and consumed sequentially. The `seed` flows directly into the PRNG state and ALSO into `meta.lastUpdated` (`addDays('2026-04-01', seed % 30)`), so two runs with the same seed produce byte-identical JSON.

## Per-Site Seed Table

| Site         | org ID    | shorthand | bundle file              | seed   | patients emitted |
|--------------|-----------|-----------|--------------------------|--------|------------------|
| Chemnitz     | org-ukc   | UKC       | center-chemnitz.json     | 70103  | 45               |
| Dresden      | org-ukd   | UKD       | center-dresden.json      | 70104  | 45               |
| Greifswald   | org-ukg   | UKG       | center-greifswald.json   | 70107  | 45               |
| Leipzig      | org-ukl   | UKL       | center-leipzig.json      | 70112  | 45               |
| Mainz        | org-ukmz  | UKMZ      | center-mainz.json        | 70113  | 45               |

## Resource Counts (per emitted bundle)

| Bundle                  | Organization | Patient | Condition | Observation | Procedure | MedicationStatement |
|-------------------------|--------------|---------|-----------|-------------|-----------|---------------------|
| center-chemnitz.json    | 1            | 45      | 45        | 846         | 471       | 45                  |
| center-dresden.json     | 1            | 45      | 45        | 863         | 476       | 45                  |
| center-greifswald.json  | 1            | 45      | 45        | 876         | 489       | 45                  |
| center-leipzig.json     | 1            | 45      | 45        | 758         | 416       | 45                  |
| center-mainz.json       | 1            | 45      | 45        | 975         | 551       | 45                  |

Observation counts include visus (LOINC 79880-1, baseline + every visit), CRT (LOINC LP267955-5, every 3rd visit), and IOP (LOINC 56844-4, every 4th visit). Procedure counts equal total IVOM injections (SNOMED 36189003, range 1..20 per patient). No `ImagingStudy` entries — see Decisions above.

## Reproducibility — SHA-1 of Generated Files

These hashes will remain stable across machines as long as `scripts/generate-center-bundle.ts`, `scripts/prng.ts`, and `scripts/generate-all-bundles.ts` are unchanged.

```
e22e92d3f6519bfab6ae8d5117c33a2e2c3afde0  public/data/center-chemnitz.json
fd7f5909fa6d0f7b7c29427854c7b48cab697090  public/data/center-dresden.json
e52488741fc0eb7ff25e09be5c1e3fb9ee8e017c  public/data/center-greifswald.json
58484f97cc76ed5d7dafda5d49d5d0408ce98890  public/data/center-leipzig.json
393c78e110a48f31b9542c569a8a84b225c685a5  public/data/center-mainz.json
```

Verified by running `npm run generate-bundles` twice and comparing `shasum` output.

## Commits

| Task | Hash      | Message |
|------|-----------|---------|
| 1 (RED)   | 583698b | test(07-02): add failing tests for synthetic FHIR bundle generator |
| 1 (GREEN) | 394c3ad | feat(07-02): synthetic FHIR bundle generator (Mulberry32 PRNG + library/CLI) |
| 2         | 118ff2e | feat(07-02): generate 5 synthetic bundles + manifest update (DATA-GEN-05) |
| 3         | 7e93483 | test(07-02): load-path smoke test for generated bundles (DATA-GEN-06) |

## Verification Results

- `npx vitest run tests/generateCenterBundle.test.ts tests/generatedBundles.test.ts` → **2 files, 15 tests, all passing**
- Downstream consumers untouched: `npx vitest run tests/fhirApi.test.ts tests/dataApiCenter.test.ts tests/centerBypass.test.ts` → 21 tests, all passing
- `npm run generate-bundles` exits 0 and prints 5 "wrote …" lines
- `grep -c '"generate-bundles"' package.json` → 1
- `grep -c "seedrandom\|random-seed" package.json` → 0 (no new deps)
- Determinism: `shasum public/data/center-chemnitz.json` byte-identical across two consecutive `npm run generate-bundles` runs
- Manifest: `node -e "JSON.parse(fs.readFileSync('public/data/manifest.json'))"` returns 7-entry array including center-mainz.json
- Per-site Organization-id check: each generated bundle has exactly one Organization with the expected `org-uk{c,d,g,l,mz}` id

## Deviations from Plan

None — plan executed exactly as written.

The plan's reference seed table was preserved verbatim (UKC 70103 / UKD 70104 / UKG 70107 / UKL 70112 / UKMZ 70113). Cohort mix defaults to the plan's spec (`amd: 0.55, dme: 0.30, rvo: 0.15`). All structural invariants and code-set requirements from `<behavior>` and `<acceptance_criteria>` are satisfied.

## Threat Model Outcome

| Threat ID | Disposition | Outcome |
|-----------|-------------|---------|
| T-07-04 (Tampering: overwriting kept bundles) | **mitigated** | `SITES` array in `scripts/generate-all-bundles.ts` only references the 5 new-site filenames. `grep -E 'aachen\|tuebingen' scripts/generate-all-bundles.ts` returns 0. |
| T-07-05 (InfoDisclosure: PII leak) | accept | Generator emits only deterministic pseudonyms `EM-<SH>-NNNN`; birthDates are bucketed across 1935–1970; no names or addresses beyond the synthetic pseudonym. |
| T-07-06 (Integrity: non-deterministic output) | **mitigated** | Mulberry32 + fixed per-site seeds + seed-derived `meta.lastUpdated` + `JSON.stringify(_, null, 2) + '\n'` serialization. Determinism unit-tested in `generateCenterBundle.test.ts` ("is byte-deterministic given the same seed and inputs"). |
| T-07-07 (DoS: runaway generation) | **mitigated** | `if (patients > 500) throw` enforced at generator entry. Test "throws if patients > 500" pins the behavior. |

## Known Stubs

None. All generated bundles are wired into the production `fhirLoader` path and the smoke test (`tests/generatedBundles.test.ts`) verifies real load behavior end-to-end.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes at trust boundaries beyond what the plan's `<threat_model>` already covers.

## Self-Check: PASSED

- Files confirmed on disk:
  - FOUND: scripts/prng.ts
  - FOUND: scripts/generate-center-bundle.ts
  - FOUND: scripts/generate-all-bundles.ts
  - FOUND: tests/generateCenterBundle.test.ts
  - FOUND: tests/generatedBundles.test.ts
  - FOUND: public/data/center-chemnitz.json
  - FOUND: public/data/center-dresden.json
  - FOUND: public/data/center-greifswald.json
  - FOUND: public/data/center-leipzig.json
  - FOUND: public/data/center-mainz.json
  - FOUND: public/data/manifest.json (7 entries)
  - FOUND: package.json (`generate-bundles` script)
- Commits confirmed in `git log`:
  - FOUND: 583698b (Task 1 RED)
  - FOUND: 394c3ad (Task 1 GREEN)
  - FOUND: 118ff2e (Task 2)
  - FOUND: 7e93483 (Task 3)
- 15/15 vitest passing; 21/21 downstream tests passing.
