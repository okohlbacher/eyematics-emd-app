---
status: partial
phase: 45-uat-validation-close
source: [v1.12 phases 41 & 43 human_needed verifications, v1.12-deferred-questions.md]
started: 2026-05-26
updated: 2026-05-26
---

## Current Test

Awaiting human UAT in the running app. All 6 design decisions confirmed as-built (no code changes). All automated gates green: build ✅ · test:ci 1086/1086 ✅ · lint 0 ✅ · knip clean ✅.

## Tests

### 1. Multi-select center filter (QUAL-024, Phase 41/42)
expected: Center chips toggle on live data; selecting/deselecting narrows quality + analysis case sets; the server still restricts to your authorized centers (selecting others cannot widen results).
result: [pending]

### 2. Time-filtered Grundgesamtheit (QUAL-022, Phase 41)
expected: Changing the time-range filter on the Datenqualität page shrinks/expands the Grundgesamtheit (population denominator) and summary counts accordingly.
result: [pending]

### 3. Absolute counts discoverable (QUAL-023, Phase 41 + 45 fix)
expected: Absolute counts (not just %) are clearly visible on BOTH quality pages (population label + count/total).
result: FIXED (code) — pending visual confirm
note: Root cause found — the **Dokumentationsqualität** page (DocQualityPage) only showed % prominently (absolute count was a 10px footnote). Fixed in Phase 45: added a prominent "Grundgesamtheit" population label + made MetricCard's patient count prominent (`fcf756d`). The **Datenqualität** page already had it (Phase 41). Both surfaces now covered, so the "which page" question is moot. Please confirm visually.

### 4. Approve/flag control placement (QUAL-025, Phase 41)
expected: The approve/flag-status control is reachable near the top of the quality case detail, above the full patient values table (no long scroll).
result: [pending]

### 5. Chart→case drill-down (FALL-010, Phase 43 + 45 fix)
expected: Single-clicking a data point in a "Verläufe" trajectory plot navigates to that patient's case detail (pointer cursor on hover); only works within your authorized cohort.
result: BUG FOUND + FIXED (code) — pending final visual confirm
note: In-app UAT revealed the scatter drill-down points were invisible and unclickable — Recharts v3 collapses <Scatter> symbols to zero size without a ZAxis range. Fixed by adding `<ZAxis range={[64,64]}>` (OutcomesPanel.tsx). Please confirm points are now visible and clicking one opens the case detail.

### 6. Cohort reference overlay (FALL-011, Phase 43)
expected: The optional toggle in case detail overlays the cohort median line + IQR band on the Visus/CRT trajectory, with correct date alignment and clean rendering.
result: [pending]

### 7. Chart label clarity (FALL-012, Phase 43)
expected: CRT legend reads "CRT (µm)"; Visus axis "Visus (Dezimal, bestkorrigiert)"; interpolation legend "Offener Kreis = interpolierter Wert (keine Messung)" — all self-explanatory.
result: [pending]

### 8. A-06 axis ticks (CHART-01, Phase 43 + 45 fix)
expected: Y-axis numeric tick labels render on all case/analysis charts.
result: FIXED (broad) — pending screenshot to confirm exact chart
note: Phase 45 applied explicit `tickCount={5}` to numeric axes across 7 more chart components (`6b606a9`) — CenterComparisonChart, CenterDetailPanel, DistributionCharts ×3, ClinicalParametersRow, OutcomesPanel, IntervalHistogram, ResponderView — so ticks no longer drop on tight layouts (VisusCrtChart already had it). Still **please send the original screenshot** so I can confirm the exact chart you flagged is among these and looks right.

### 9. PROT-001 audit actor (Phase 38)
expected: No "anonymous" actor in the audit log; deleted users retain their historical username.
result: RESOLVED (code analysis) — pending visual confirm
note: AUDIT-02 added (2026-05-27) — login rows now show the attempted username, not 'unauthenticated' (your finding). Separately: there is NO deleted-user→anonymous route. Deleting a user calls `revokeByUsername()` synchronously (userAdminApi.ts:172-179, PROT-001 v1.10), so their JWTs can't be reused; past audit entries are append-only/immutable (auditDb.ts) and keep the real username; the only `anonymous`→`unauthenticated` fallback is the 401/unauth path (auditMiddleware.ts:186). So a deleted user cannot appear as anonymous. Please just confirm the live log matches.

## Summary

total: 9
code_resolved_pending_visual: 4   (#3 QUAL-023, #5 FALL-010 drill-down [bug fixed], #8 A-06, #9 PROT-001)
pending_visual_only: 5            (#1,#2,#4,#6,#7 — verified in code+tests, await visual sign-off)
issues: 0
See `.planning/v1.12-UAT-FEEDBACK.md` for the full per-issue resolution report.

## Gaps

(none recorded yet — populate from UAT results)
