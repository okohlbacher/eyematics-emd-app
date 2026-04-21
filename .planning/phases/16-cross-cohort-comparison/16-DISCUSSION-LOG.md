# Phase 16: Cross-Cohort Comparison - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 16-cross-cohort-comparison
**Areas discussed:** Cohort selector UX, VIS-04 spaghetti hierarchy

---

## Cohort selector UX

| Option | Description | Selected |
|--------|-------------|----------|
| Slide-over drawer | Opens panel listing saved cohorts with checkboxes; reuses OutcomesSettingsDrawer pattern | ✓ |
| Inline chip strip | Horizontal row with active cohort chip + "Add cohort" dropdown | |
| Modal dialog | Centered overlay with full saved-cohort list | |

**User's choice:** Slide-over drawer

---

| Option | Description | Selected |
|--------|-------------|----------|
| Second icon beside the gear | GitCompare/Layers icon next to existing ⚙ gear in top-right | ✓ |
| Button in cohort subtitle row | Small "Compare…" text-link near patient count | |
| You decide | Claude picks placement | |

**User's choice:** Second icon beside the gear

---

| Option | Description | Selected |
|--------|-------------|----------|
| 3 panels (OD/OS/combined) each overlaid | Keep existing 3-column grid; each panel shows all cohort series | ✓ |
| Single combined chart only | Switch to one OD+OS chart when comparing | |
| Eye selector tabs | One chart at a time with OD/OS/combined tabs | |

**User's choice:** 3 panels (OD/OS/combined) each overlaid

---

## VIS-04 spaghetti hierarchy

| Option | Description | Selected |
|--------|-------------|----------|
| Opacity only | Per-patient lines at 20-25% opacity; median stroke 3→4px | |
| Opacity + desaturate | Per-patient lines gray + low opacity; median full-saturation eye color | ✓ |
| You decide | Claude picks the approach | |

**User's choice:** Opacity + desaturate (gray tone ~20-25% opacity for per-patient; full EYE_COLORS saturation + 4px stroke for median)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, via existing layers toggle | Per-patient toggle works in both modes; off by default in cross-cohort | |
| No, locked off in cross-cohort | Per-patient always hidden when 2+ cohorts active | ✓ |
| You decide | Claude picks | |

**User's choice:** No — per-patient lines locked off in cross-cohort mode

---

## Claude's Discretion

- Exact COHORT_PALETTES hex values
- Whether compare drawer shows "Clear all" button
- Header subtitle text in cross-cohort mode
- Whether to extend OutcomesPanel or create CrossCohortPanel

## Deferred Ideas

- Eye selector tabs / single combined chart layout variants
- Per-patient toggle being available in cross-cohort
- Per-cohort axis/yMetric overrides
