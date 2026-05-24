---
phase: 34
slug: data-completeness-consent-stubs
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-24
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/stubIsolation.test.ts tests/datenvollstaendigkeitCard.test.tsx tests/augmentReferenceBundles.test.ts` |
| **Full suite command** | `npm run test:ci` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick run command (or `npm run test:ci` for data tasks touching bundles).
- **After every plan wave:** Run `npm run test:ci`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 34-01 | 1 | DASH-01 | T-34-01 | Consent/Encounter types not wired into PatientCase (isolation by type contract) | type/unit | `npx tsc -b --noEmit` | No — created here | ⬜ pending |
| 01-T2 | 34-01 | 1 | DASH-01 | T-34-02 | Wave 0 scaffolds; synthetic fixtures only (no PHI) | unit/RTL | `npx vitest run tests/stubIsolation.test.ts tests/datenvollstaendigkeitCard.test.tsx tests/augmentReferenceBundles.test.ts` | No — created here | ⬜ pending |
| 02-T1 | 34-02 | 2 | DASH-01 | T-34-03 | Stub excluded from extractPatientCases (H2 chokepoint, D-03) | unit | `npx vitest run tests/stubIsolation.test.ts` | Yes (01-T2) | ⬜ pending |
| 02-T2 | 34-02 | 2 | DASH-01 | T-34-04 | patientCount stub-free (D-04); countRawPatients respects server site filter (D-09) | unit | `npx vitest run tests/stubIsolation.test.ts` | Yes (01-T2) | ⬜ pending |
| 03-T1 | 34-03 | 2 | DASH-01 | T-34-07, T-34-08 | Seeded byte-stable stubs, no clinical detail (D-02/D-11) | integration | `npm run generate-bundles && npm run verify:bundles` | extends existing | ⬜ pending |
| 03-T2 | 34-03 | 2 | DASH-01 | T-34-06 | Append-only, idempotent reference augmentation (D-13) | unit | `npx vitest run tests/augmentReferenceBundles.test.ts` | Yes (01-T2) | ⬜ pending |
| 03-T3 | 34-03 | 2 | DASH-01 | T-34-08, T-34-09 | CI gates accept Consent + stub ratio in [2,8] (D-14) | integration | `npm run audit:bundles && npm run test:ci` | extends existing | ⬜ pending |
| 04-T1 | 34-04 | 3 | DASH-01 | — | i18n keys (DE/EN) for card | type/unit | `npx tsc -b --noEmit` | n/a | ⬜ pending |
| 04-T2 | 34-04 | 3 | DASH-01 | T-34-10, T-34-11, T-34-12 | Denominator = raw count (not cases.length); card site-filter reactive (D-09/D-10) | unit/RTL | `npx vitest run tests/datenvollstaendigkeitCard.test.tsx` | Yes (01-T2) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 (Plan 34-01, Task 2) creates all three new test files BEFORE any implementation, so every downstream behavior has a verification target:

- [x] `tests/stubIsolation.test.ts` — D-03 (extractPatientCases excludes stubs) + D-04 (extractCenters patientCount) + countRawPatients raw total. Real (non-skipped) assertions; RED until Plan 02 lands the filters.
- [x] `tests/datenvollstaendigkeitCard.test.tsx` — card render, fraction display, site-filter reactivity. Card-presence assertions `.skip` until Plan 04 (no card exists in Wave 1); mock-wiring assertion is real now.
- [x] `tests/augmentReferenceBundles.test.ts` — D-13 byte-identity of curated resources + idempotency. Full assertion bodies present; `.skip` until Plan 03 ships the script.

Existing CI gates (`audit-bundle-codes.mjs`, `verify-bundle-distributions.mjs`) are EXTENDED (not created) in Plan 03 Task 3 — they already exist in the 619+ baseline.

No 3 consecutive tasks lack an automated verify. No watch-mode flags. Feedback latency < 60s.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Datenvollzähligkeit card visual rendering across site-filter changes | DASH-01 | Visual rendering / live site-filter interaction | Load dashboard, change site filter, confirm total/consented/fraction and progress-bar color update; verify DE/EN labels |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
