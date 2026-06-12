**Verdict**
Plan is not sound as written. A2 is mostly fine, A5 is acceptable only with tighter boundaries, but A1 is based on the wrong Recharts 3.8.1 event shape and A3/A4 miss likely breakages.

**A1**
Root cause is only partly right. The mocked tests clearly missed real browser behavior, but the proposed chart-level `activePayload` fix will not work in installed Recharts `3.8.1`. Chart `onClick` receives `MouseHandlerDataParam`: `activeCoordinate`, `activeDataKey`, `activeIndex`, `activeLabel`, `activeTooltipIndex`, `isTooltipActive`, not `activePayload` ([Recharts middleware](/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app/node_modules/recharts/es6/state/externalEventsMiddleware.js:77), [type](/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app/node_modules/recharts/types/synchronisation/types.d.ts:7)).

The current `<Scatter onClick>` path is still the more direct path ([OutcomesPanel.tsx](/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app/src/components/outcomes/OutcomesPanel.tsx:288)). Fix the hit target/z-order/custom scatter shape, or store the tooltip payload explicitly via a controlled/custom tooltip/ref. Do not implement a chart-level `activePayload` extractor.

**A2**
Diagnosis is correct. `filterCasesByTimeRange` trims observations but retains empty cases ([qualityMetrics.ts](/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app/src/utils/qualityMetrics.ts:105)), and `distinctPatientCount` is computed from raw `cases` ([DocQualityPage.tsx](/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app/src/pages/DocQualityPage.tsx:85)).

The fix should work, but freeze time in tests because `cutoffDate()` uses `new Date()` ([qualityMetrics.ts](/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app/src/utils/qualityMetrics.ts:94)). Also be explicit that per-center `patientCount` remains case-count semantics while `Grundgesamtheit` is distinct pseudonyms.

**A3**
Root cause is weak. Recharts can include graphical-item data in categorical domains, but this hook already maps cohort reference points from `combinedData` and keys them to the patient’s exact dates ([useCaseData.ts](/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app/src/hooks/useCaseData.ts:323)). So the separate overlay arrays are subsets of the patient axis, not independent date ranges.

Merged single-array data will prevent future own-data domain issues, but it probably does not fix the current readability problem. The white lower-band `<Area fill="#ffffff" fillOpacity={1}>` layers are more suspicious because they can mask the plot ([VisusCrtChart.tsx](/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app/src/components/case-detail/VisusCrtChart.tsx:141)). Use a real band via `baseLine`/range-style data, not white paint-over areas.

**A4**
Open-circle dead branch diagnosis is correct: `combinedData` marks values measured whenever present and never interpolates ([useCaseData.ts](/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app/src/hooks/useCaseData.ts:153)). But the plan misses a serious downstream break: `visusCrtScatter` currently includes any row with both values ([useCaseData.ts](/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app/src/hooks/useCaseData.ts:179)). If interpolation writes synthetic values into `combinedData`, the scatter/correlation chart will silently include fabricated paired measurements.

Linear interpolation is acceptable only if display-only, clearly flagged in tooltips, excluded from scatter/correlation/export-like derived data, and preferably rendered on `type="linear"` lines. With `type="monotone"` ([VisusCrtChart.tsx](/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app/src/components/case-detail/VisusCrtChart.tsx:201)), inserted linear points can subtly change the curve.

**A5**
Diagnosis is plausible. The middleware currently falls back to `unauthenticated` whenever `req.auth` is missing ([auditMiddleware.ts](/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app/server/auditMiddleware.ts:221)).

The design is not a privilege-escalation flaw if it is treated as failed-request attribution, not authentication. But do not honor previous signing keys for expired access tokens. This codebase explicitly says access/challenge tokens use the current secret only ([initAuth.ts](/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app/server/initAuth.ts:177)); only refresh has dual-key fallback ([jwtUtil.ts](/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app/server/jwtUtil.ts:106)). Enforce `typ: 'access'`, sanitize `preferred_username`, reject refresh/challenge tokens, and consider a max expired age to reduce audit spoofing with very old stolen tokens.

**A6**
Measure-first is correct. The suspected render hotspot is credible: per-patient line data arrays are rebuilt inline for every render ([OutcomesPanel.tsx](/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app/src/components/outcomes/OutcomesPanel.tsx:262)).

Defaulting `perPatient` off above a threshold is acceptable UX for large cohorts, but implement it before aggregation/render, not in a post-render effect. The server request already depends on `layers.perPatient` ([useOutcomesAggregation.ts](/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app/src/components/outcomes/useOutcomesAggregation.ts:131)), while layer defaults currently start with `perPatient: true` ([useOutcomesRouteState.ts](/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app/src/components/outcomes/useOutcomesRouteState.ts:99)). Avoid scatter sampling unless product explicitly accepts incomplete drill-down coverage.

**Review Questions**
A1: No, chart-level `activePayload` extraction is not robust in Recharts 3.8.1 because that payload is not passed to chart `onClick`.

A5: Acceptable with constraints, but the plan’s previous-key access-token attribution is wrong. Also document that this is “expired signed claim attribution,” not authenticated identity.

A4(3): Clinically acceptable only as display-only interpolation, excluded from scatter/correlation and clearly marked in tooltip/legend. Current plan misses that.

A2: Yes, excluding zero-observation-in-window cases is consistent with the tester complaint. Expect changed scores and update tests with fixed dates.

A6: Defaulting per-patient off above threshold is acceptable, but only if applied before expensive aggregation/render and with opt-in preserved.

**TOP CHANGES**
1. Replace A1’s `activePayload` plan; use actual scatter hit-target/z-order or controlled tooltip payload.
2. Change A3 to fix band rendering, not just data merging.
3. In A4, exclude interpolated values from `visusCrtScatter` and mark them in tooltips.
4. In A5, current-key-only for expired access tokens; remove “previous key honored” test.
5. In A6, compute effective large-cohort layer defaults before server aggregation/render.