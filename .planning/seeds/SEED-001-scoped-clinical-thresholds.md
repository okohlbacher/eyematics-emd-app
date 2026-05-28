---
id: SEED-001
status: dormant
planted: 2026-05-28
planted_during: v1.12 (Phase 45 close)
trigger_when: when a milestone touches clinical thresholds, per-site/per-cohort configuration, or quality/outcomes reproducibility
scope: medium-large
---

# SEED-001: Per-site / per-cohort clinical thresholds (with threshold-snapshot provenance)

## Why This Matters

v1.12 shipped **global** admin-configured clinical thresholds (decision D1) and deliberately deferred per-site / per-cohort thresholds. Sites may have legitimately different reference ranges (equipment, population), and researchers may want a cohort's quality/outcomes result to be **reproducible** even after an admin later edits global thresholds. Both need scoped thresholds.

## When to Surface

**Trigger:** a milestone that revisits clinical thresholds, site-specific configuration, or "why did this saved cohort's result change?" reproducibility.

## Scope Estimate

**Medium-large.** The hard part is provenance: a saved cohort/quality result must snapshot the threshold values in effect at save time (or version them), otherwise results silently change. This reintroduces exactly the provenance complexity D1 avoided — it intersects SavedSearch persistence (SEC-06/F-13, done v1.12) and the aggregate cache key (CFG-03). Likely: a `thresholds` snapshot on SavedSearch + scope resolution (global → site → cohort) in `settingsApi`/`patientCases`.

## Breadcrumbs

- D1 / D1b decisions: `.planning/v1.12-roadmap-PROPOSAL.md`
- Global thresholds impl: Phase 39 (`config/settings.yaml` thresholds/plausibility, `src/config/clinicalThresholds.ts`, `server/settingsApi.ts getFilterOptions`)
- Provenance touchpoint: `shared/savedSearchSanitize.ts`, `server/dataApi.ts`
- Q-40-1 (no-snapshot default): `.planning/v1.12-deferred-questions.md`

## Notes

Deferred from v1.12 D1. Pairs with the Q-40-1 "no threshold snapshot" default — revisiting scoped thresholds means revisiting that decision.
