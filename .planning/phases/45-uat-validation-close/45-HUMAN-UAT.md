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

### 3. Absolute counts discoverable (QUAL-023, Phase 41)
expected: Absolute counts (not just %) are clearly visible on the Datenqualität overview (population label + count/total on summary cards).
result: [pending]
note: Please confirm WHICH page you originally couldn't find them on — main **Datenqualität** vs **Dokumentationsqualität** — so I can fix the right surface if it's still missing.

### 4. Approve/flag control placement (QUAL-025, Phase 41)
expected: The approve/flag-status control is reachable near the top of the quality case detail, above the full patient values table (no long scroll).
result: [pending]

### 5. Chart→case drill-down (FALL-010, Phase 43)
expected: Single-clicking a data point in a "Verläufe" trajectory plot navigates to that patient's case detail (pointer cursor on hover); only works within your authorized cohort.
result: [pending]

### 6. Cohort reference overlay (FALL-011, Phase 43)
expected: The optional toggle in case detail overlays the cohort median line + IQR band on the Visus/CRT trajectory, with correct date alignment and clean rendering.
result: [pending]

### 7. Chart label clarity (FALL-012, Phase 43)
expected: CRT legend reads "CRT (µm)"; Visus axis "Visus (Dezimal, bestkorrigiert)"; interpolation legend "Offener Kreis = interpolierter Wert (keine Messung)" — all self-explanatory.
result: [pending]

### 8. A-06 axis ticks (CHART-01, Phase 43)
expected: Y-axis numeric tick labels render on the affected case/analysis charts.
result: [pending]
note: **Screenshot needed** — the original v1.10 report said "Screenshot benötigt." Please send the screenshot of the chart with missing ticks so I can confirm the exact chart and whether the best-effort tickCount fix resolved it.

### 9. PROT-001 audit actor (Phase 38)
expected: No "anonymous" actor in the audit log for failed-auth requests (now "unauthenticated").
result: [pending]
note: If you still see "anonymous" tied to **deleted users** (not failed logins), that's a separate path needing a follow-up fix.

## Summary

total: 9
passed: 0
issues: 0
pending: 9

## Gaps

(none recorded yet — populate from UAT results)
