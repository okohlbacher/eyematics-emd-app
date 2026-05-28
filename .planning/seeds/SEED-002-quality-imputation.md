---
id: SEED-002
status: dormant
planted: 2026-05-28
planted_during: v1.12 (Phase 45 close)
trigger_when: when a milestone touches the data-quality module, missing-value handling, or data completeness
scope: medium
---

# SEED-002: QUAL-004 — imputation / auto-suggest of missing values

## Why This Matters

The data-quality module (v1.12 QUAL-020/021/022) detects missing/implausible values but does not help the user **resolve** them. QUAL-004 (from the v1.10 formative analysis) asks the system to suggest plausible values for gaps (e.g. interpolate a missing Visus/CRT from neighbouring visits, or flag a likely-correct candidate). This closes the loop from "detect" to "remediate."

## When to Surface

**Trigger:** a milestone extending the Datenqualität module, working on data completeness, or addressing reviewer remediation workflows.

## Scope Estimate

**Medium.** Needs a defensible imputation method (clinical sign-off on the statistic), a clear "suggested vs confirmed" UI distinction (never silently write imputed values into clinical surfaces), and an audit trail for accepted suggestions. Different risk profile from detection — was deliberately kept out of v1.12 to avoid muddying the quality module.

## Breadcrumbs

- Original finding: v1.10 feedback doc, QUAL-004 "Fehlende Werte nicht vorgeschlagen (Imputation)"
- Quality module: `src/pages/QualityPage.tsx`, `src/components/quality/*`, `src/utils/qualityMetrics.ts`
- Interpolation precedent: case-detail interpolated points (`VisusCrtChart.tsx`)

## Notes

Deferred (Future Requirements in REQUIREMENTS.md). Keep imputed values strictly separate from confirmed clinical data.
