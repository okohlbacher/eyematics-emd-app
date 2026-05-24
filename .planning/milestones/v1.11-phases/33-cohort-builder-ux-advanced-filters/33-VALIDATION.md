---
phase: 33
slug: cohort-builder-ux-advanced-filters
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-21
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- <file> --run` |
| **Full suite command** | `npm run test:ci` |
| **Estimated runtime** | quick single-file run ~20 s (Vite startup dominated); full `test:ci` (828 baseline + Phase 33 tests) ~90–120 s |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- <file> --run`
- **After every plan wave:** Run `npm run test:ci`
- **Before `/gsd-verify-work`:** Full suite must be green (828/828 baseline + Phase 33 tests)
- **Max feedback latency:** ~120 seconds (full suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 33-01-01 | 01 | 1 | COH-03 | — | N/A (pure refactor — lift getTherapyStatus to shared) | unit | `npm run build` | ✅ (build, no test file) | ⬜ pending |
| 33-01-02a | 01 | 1 | COH-03 | T-33-01 | preset literal union; non-matching value returns unfiltered set (no crash/injection) | unit | `npm run test -- cohortPresets --run` | ❌ W0 (tests/cohortPresets.test.ts) | ⬜ pending |
| 33-01-02b | 01 | 1 | COH-04 | — | N/A (pure predicate logic; advanced attributes) | unit | `npm run test -- cohortPresets --run` | ❌ W0 (tests/cohortPresets.test.ts) | ⬜ pending |
| 33-01-04 | 01 | 1 | COH-03 | T-33-02 | crtImplausibleThresholdUm is a clinical integer, not a secret; no stripping required | unit | `npm run build` | ✅ (build, config + i18n) | ⬜ pending |
| 33-02-01 | 02 | 2 | COH-01 | T-33-05 | numeric range validation blocks Save; invalid field not applied (ASVS V5) | unit | `npm run test -- cohortBuilderValidation --run` | ❌ W0 (tests/cohortBuilderValidation.test.tsx) | ⬜ pending |
| 33-02-02 | 02 | 2 | COH-02 | T-33-03 / T-33-04 | logout clears emd-cohort-filters (D-05); safe-pick whitelist on corrupt read | unit | `npm run test -- cohortFilterPersistence --run` | ❌ W0 (tests/cohortFilterPersistence.test.tsx) | ⬜ pending |
| 33-02-03 | 02 | 2 | COH-01, COH-02 | T-33-01 | safe-pick whitelist of preset/advanced fields on deserialization; configured thresholds passed | unit | `npm run test:ci` | ✅ (regression — existing AnalysisPage/OutcomesView tests) | ⬜ pending |
| 33-03-01 | 03 | 3 | COH-04 | — | N/A (modal UI; bounded option lists) | unit | `npm run test -- advancedFilterDialog --run` | ❌ W0 (tests/advancedFilterDialog.test.tsx) | ⬜ pending |
| 33-03-02 | 03 | 3 | COH-03, COH-04 | T-33-06 / T-33-07 | preset literal from fixed handlers; flaggedCaseIds + medicationOptions derived from already-visible data | unit | `npm run test -- advancedFilterDialog --run` | ❌ W0 (tests/advancedFilterDialog.test.tsx) | ⬜ pending |
| 33-04-01 | 04 | 2 | DASH-02 | T-33-08 | crt param maps only to literal 'implausible' else 'all'; not reflected into DOM/navigation | unit | `npm run test -- qualityPageDeepLink --run` | ✅ (extend tests/qualityPageDeepLink.test.tsx) | ⬜ pending |
| 33-04-02 | 04 | 2 | DASH-02 | T-33-09 | navigate targets are hard-coded same-origin literals; no open-redirect surface | unit | `npm run test -- landingPageAlerts --run` | ✅ (update tests/landingPageAlerts.test.tsx) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note: Plan 01 Task 2 was split into Task 2a (4 preset predicates + full CohortFilter type + options param) and Task 2b (5 advanced-attribute predicates) per checker WARNING 1 — both share `tests/cohortPresets.test.ts`. Total: 11 tasks.*

---

## Wave 0 Requirements

These NEW test files are written test-first (TDD RED) as the first step of their owning task — they are the Wave 0 gaps from RESEARCH "Validation Architecture":

- [ ] `tests/cohortPresets.test.ts` — COH-03/COH-04: pure-function unit tests for the 4 preset predicates (Task 2a) + 5 advanced-attribute predicates (Task 2b) in `applyFilters` (no jsdom)
- [ ] `tests/cohortBuilderValidation.test.tsx` — COH-01: age/visus/CRT inline validation + Save blocking (jsdom)
- [ ] `tests/cohortFilterPersistence.test.tsx` — COH-02: sessionStorage round-trip + Reset + logout-clear + corrupt-value fail-safe (jsdom)
- [ ] `tests/advancedFilterDialog.test.tsx` — COH-04/COH-03: dialog renders 5 curated fields + advanced narrowing + preset-toggle/clear-on-manual-edit/flaggedQuality Set-building (jsdom)

Existing test files extended (not Wave 0 — already present):
- `tests/qualityPageDeepLink.test.tsx` — DASH-02: add `?crt=implausible` seeding coverage (Task 33-04-01)
- `tests/landingPageAlerts.test.tsx` — DASH-02: update line-83 assertion to `?crt=implausible` + aria-label `reviewImplausibleCrt` (Task 33-04-02)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dark-mode + spacing visual fidelity of the preset button group and advanced modal | COH-03, COH-04 | Tailwind class application (ring, soft/accent variants, py-1.5 spacing exception, max-w-lg modal) renders correctly only in a real browser; not assertable via RTL | Run `npm run dev`, open the cohort builder, toggle each preset (confirm soft + teal ring active state), open Advanced filters, verify the 5 fields render at comfortable widths in both light and dark themes |

*Note: all behavioral/logic requirements (predicates, validation, persistence, routing, dialog emit) have automated verification above; only the visual-rendering check is manual.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (all commands use `--run` or `test:ci`)
- [ ] Feedback latency < 120s (confirmed at execution time)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
