---
phase: 45-uat-validation-close
reviewed: 2026-05-29T00:00:00Z
depth: deep
files_reviewed: 14
files_reviewed_list:
  - src/components/common/CenterMultiSelect.tsx
  - src/pages/QualityPage.tsx
  - src/components/quality/QualityCaseList.tsx
  - src/components/quality/QualityCaseDetail.tsx
  - src/pages/DocQualityPage.tsx
  - src/components/doc-quality/MetricCard.tsx
  - src/pages/AnalysisPage.tsx
  - src/components/outcomes/OutcomesPanel.tsx
  - src/components/outcomes/useOutcomesRouteState.ts
  - src/components/case-detail/VisusCrtChart.tsx
  - src/hooks/useCaseData.ts
  - src/pages/CaseDetailPage.tsx
  - server/auditMiddleware.ts
  - server/fhirApi.ts
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 45: Adversarial Review — v1.12 UAT Close Verification

**Reviewed:** 2026-05-29
**Depth:** deep (cross-file: scatter datum shape traced into Recharts v3 source, server scatter type, cohortTrajectory id semantics)
**Files Reviewed:** 14
**Status:** issues_found — no BLOCKERs, but several items have caveats that should be stated when reporting closed.

## Summary

All nine UAT items are substantively implemented and the happy paths work. I attempted to break each one. The most consequential claims I scrutinized:

- **FALL-010 drill-down patientId extraction** — initially looked broken (the TS cast `(datum as ScatterPointItem).patientId` reads a field not on the typed shape). I traced Recharts 3.8.1 source (`es6/cartesian/Scatter.js:444` spreads the original datum at top level of each point; `es6/util/types.js:170` calls `originalHandler(data,…)` with that point). The original datum's `patientId` IS present at the top level at runtime, so extraction works. **Not a blocker.** Also confirmed `scatterPoints[].patientId = PatientSeries.id`, and `PatientSeries.id = c.pseudonym` (`shared/cohortTrajectory.ts:40,445,548`), so the handler's `cohort.cases.find(c => c.pseudonym === patientId)` matches correctly.
- **IDOR on drill-down** — gated. `handlePointDrillDown` only navigates to ids found within `cohort.cases`, which is derived from `activeCases` (server-authorized set). A foreign pseudonym yields no match → no navigation.
- **Cross-cohort disable** — confirmed: `CrtMetricContainer`/`VisusMetricContainer` pass `onPointClick={!isCrossMode ? handlePointDrillDown : undefined}`, and `OutcomesPanel` only wires the click when `onPointClick` is truthy.
- **Server-side authority (QUAL-024 widening)** — `filterBundlesByCenters` enforces center scope server-side; `CenterMultiSelect` is pure client narrowing over already-authorized `activeCases`. Cannot widen. Confirmed safe.
- **AUDIT-02** — authenticated identity wins (`req.auth?.preferred_username` checked first); body username only used as fallback on `/api/auth/login` when `req.auth` empty; 64-char bound; password redacted via `REDACT_FIELDS`; non-login no-auth stays `'unauthenticated'`.

Net: nothing must block the close, but six items carry caveats a UA tester could legitimately hit.

---

## Warnings

### WR-01: QUAL-022 denominator is case-scoped but per-case metrics use the full (un-trimmed) history
**File:** `src/pages/QualityPage.tsx:145-217`
**Issue:** `timeScopedCases` INCLUDES a case if it has *any* observation `>= cutoff`, but then `caseStatus`, `therapyStatuses`, the anomaly checks in `QualityCaseDetail`, and the values table all operate on the case's *entire* `observations` array (never time-trimmed). So the Grundgesamtheit denominator reflects the time window, while the metrics computed against that denominator do not. A case with one recent visit + years of old visits is counted in "Population: N" but its therapy/anomaly/status is computed over all time. The tester's mental model ("the time filter restricts what I'm reviewing") is only half-true. Contrast with `DocQualityPage`, which uses `filterCasesByTimeRange` to actually trim observations.
**Fix:** Either trim observations for included cases (apply `filterCasesByTimeRange` after the inclusion test) so all downstream metrics honor the window, or relabel the population to make clear it counts "cases active in range" with full-history metrics. Document the chosen semantics in the UAT note.
**Verdict:** SAFE TO REPORT CLOSED with an explicit caveat on what "time-filtered" means; otherwise NEEDS WORK.

### WR-02: QUAL-023 "Population" counts cases, not distinct patients, and can multi-count cross-center patients
**File:** `src/pages/DocQualityPage.tsx:188-221`, `src/utils/qualityMetrics.ts:124`; `src/pages/QualityPage.tsx:330`
**Issue:** `computeMetrics` sets `patientCount = cases.length`. Cases are grouped by `centerId`, so a single case is counted once — no intra-center double count. BUT per project glossary "a patient has one or more cases", and the label is `qualityPopulationLabel` = "Grundgesamtheit / Population" rendered with `{patientCount} docQualityPatients`. If the same patient has cases at two centers, `centerMetrics.reduce((s,m)=>s+m.patientCount)` counts them twice, and even within one center two cases of one patient count as two "patients". The number shown is a **case count mislabeled as a patient count**.
**Fix:** Either dedupe by patient identity before counting (if a stable patient id exists across cases) and keep the "patients" label, or relabel to "cases" (the codebase already distinguishes patients ≠ cases). At minimum confirm with UAT which count was requested.
**Verdict:** NEEDS WORK if the requirement literally asked for distinct-patient population; SAFE TO REPORT CLOSED if "absolute count of cases" was the intent — but the label must match.

### WR-03: Stale center selection persists invisibly when the option set shrinks (QUAL-024)
**File:** `src/pages/QualityPage.tsx:197-217`, `src/components/common/CenterMultiSelect.tsx:78-94`
**Issue:** `centerNames` is derived from `timeScopedCases`. If a user selects center "X", then narrows `timeRange` (or cohort scope) so "X" no longer has cases in range, "X" disappears from the toggle list but remains in `selectedCenters`. `filteredCases` then applies `selectedCenters.includes(c.centerName)` and silently shows zero/limited rows with no visible toggle explaining why — the only cue is the count badge + "Clear" button (and only if the filter panel is open). Same latent issue on `AnalysisPage` where `centerOptions` derives from `activeCases` (more stable, but cohort/filter changes can still orphan a selection).
**Fix:** When `centerNames` changes, prune `selectedCenters` to the intersection (effect or derived), or surface orphaned selections as removable chips. Empty-selection = all is correct and verified.
**Verdict:** SAFE TO REPORT CLOSED (no data leak, server still authoritative) but flag as a known UX edge.

### WR-04: FALL-011 cohort reference overlay leaks the current patient into its own "cohort" comparison
**File:** `src/hooks/useCaseData.ts:287-343`
**Issue:** `cohortReference` buckets observations from **all `cases`, including the current case** (comment at line 290 says so explicitly). The overlay is meant as a peer/reference band; including the index patient biases the median/IQR toward the patient being viewed, most visibly for small cohorts or dates where the patient is one of few contributors. Not a privacy leak (only aggregate median/p25/p75 are emitted; no raw cross-patient ids — verified), but it is a statistical self-reference that undermines "how does this patient compare to the cohort".
**Fix:** Exclude the current `patientCase` from the bucket loop (`if (c.id === patientCase?.id) continue;`), or document that the band is "cohort incl. this patient".
**Verdict:** SAFE TO REPORT CLOSED for the privacy/empty-cohort/toggle-default-off claims; NEEDS WORK if the requirement implied a true peer comparison.

### WR-05: FALL-011 overlay date alignment is exact-string match — no peers shown unless dates collide exactly
**File:** `src/hooks/useCaseData.ts:315-342`, `src/components/case-detail/VisusCrtChart.tsx:55,127`
**Issue:** `cohortReference` is keyed by `combinedData[].date` and only emits a point when *some* cohort case has an observation on that **exact same `YYYY-MM-DD`**. Clinical visit dates rarely coincide across patients to the day, so for many cases the overlay will be sparse or empty even when the cohort is large — `hasReference = showCohortReference && cohortReference.length > 0` then renders nothing and the toggle appears to "do nothing". This is correct (empty-cohort safe, no crash) but likely to read as a bug to a tester who turns it on and sees no band.
**Fix:** Bucket by a coarser window (week/month) or interpolate the cohort series onto the patient's dates, matching the trajectory-grid approach used elsewhere. Verify the toggle produces a visible band on representative data before closing.
**Verdict:** NEEDS WORK — verify on real data; the toggle silently doing nothing is a plausible UAT re-open.

### WR-06: AUDIT-02 — a failed login can stamp the audit row with an arbitrary attacker-supplied actor (including another real user's name)
**File:** `server/auditMiddleware.ts:204-210`
**Issue:** On `/api/auth/login`, when auth has not populated `req.auth`, the actor is taken from `req.body.username` (trimmed, capped 64). The prompt explicitly asks whether a crafted body can inject a misleading actor on a FAILED attempt — **yes, it can**, by design. An attacker can POST `{username: "admin"}` with a wrong password and the audit row records actor `admin` on a 401. This is the documented intent ("WHO was targeted"), and the public 401 stays generic (no enumeration), so it is defensible — but the audit log conflates "attempted username" with "actor identity". An admin reading the log could misattribute a failed/forged attempt to a real user. Control chars are NOT stripped (only `trim()` + length cap), so newlines/control bytes from the body land in the stored value.
**Fix:** Acceptable to keep if (a) it is documented that the login-row actor is the *attempted* (untrusted) username, not a verified identity, and ideally stored under a distinct column/prefix (e.g. `attempted:admin`) to prevent misattribution; and (b) strip control characters (`replace(/[ -]/g,'')`) before storing. Length bound is present and adequate.
**Verdict:** SAFE TO REPORT CLOSED only if the "attempted, untrusted" semantics are documented for log readers AND control-char stripping is added; otherwise NEEDS WORK (minor).

---

## Info

### IN-01: FALL-010 click handler relies on undocumented Recharts runtime shape
**File:** `src/components/outcomes/OutcomesPanel.tsx:300-303`
**Issue:** Extraction `(datum as unknown as { patientId?: string }).patientId` works only because Recharts 3.8.1 spreads the original datum onto the point object (`es6/cartesian/Scatter.js:444`). The typed `ScatterPointItem` does not expose `patientId`; a future Recharts version that stops top-level-spreading would silently break drill-down (handler is a no-op when `patientId` is undefined — fails closed, no error). No test exercises the click path.
**Fix:** Read from `datum.payload?.patientId` (the stable contract) with the top-level as fallback, and add a unit test that fires the Scatter onClick and asserts navigation.
**Verdict:** SAFE TO REPORT CLOSED (works now); harden against Recharts upgrades.

### IN-02: MetricCard icon threshold hardcoded to 80, ignores `threshold` prop
**File:** `src/components/doc-quality/MetricCard.tsx:21,46`
**Issue:** The check/alert icon uses literal `score > 80`, while the displayed threshold and the `threshold` prop default to 80. If a caller ever passes a non-80 threshold, the icon and the "Threshold: X%" label disagree. All current callers use the default, so no live defect.
**Fix:** Use `score > threshold` for the icon.
**Verdict:** SAFE TO REPORT CLOSED.

### IN-03: `cutoffDate('6m')` can roll over month boundaries
**File:** `src/utils/qualityMetrics.ts:96-101`
**Issue:** `new Date(now.getFullYear(), now.getMonth()-6, now.getDate())` with `getDate()` of 31 in a short target month rolls forward a few days (e.g. Aug 31 → "Feb 31" → Mar 3). A few-day off-by on the cutoff edge; not user-visible in practice.
**Fix:** Clamp day or use a date library. Low priority.
**Verdict:** SAFE TO REPORT CLOSED.

### IN-04: QUAL-025 flag-status control is gated on `caseFlags.length > 0`
**File:** `src/components/quality/QualityCaseDetail.tsx:177-203`
**Issue:** The top flag-status control (`data-testid="top-flag-status-controls"`) renders only when flags exist — correct for "no flags" (nothing to show) and "many flags" (all rendered, same `onUpdateFlagStatus` handler as the bottom list, so no desync — verified both selects call the identical handler with the same `f.caseId, f.flaggedAt`). The placement-above-table claim holds. No defect; noting that "for ALL states including no flags" is satisfied by intentionally rendering nothing when there are zero flags.
**Verdict:** SAFE TO REPORT CLOSED.

### IN-05: A-06 `tickCount={5}` is only applied to numeric axes — verified no category-axis misuse
**File:** `src/components/outcomes/OutcomesPanel.tsx:219,230`; `src/components/case-detail/VisusCrtChart.tsx:80,88`
**Issue:** Checked every `tickCount={5}` added. In `OutcomesPanel` it is on `XAxis type="number"` and `YAxis` (numeric) — correct. In `VisusCrtChart` it is on the two numeric Y axes only; the category X axis (`dataKey="date"`) has no `tickCount`. `AnalysisPage` category axes (`quarter`, `name`, `range`) were NOT given `tickCount` — correct. No category-axis or tiny-fixed-domain misuse found. `tickCount` on numeric axes with fixed domains like `[0,1]` produces clean evenly-spaced ticks. No duplicate/weird-tick risk.
**Verdict:** SAFE TO REPORT CLOSED.

---

## Per-item close recommendation

| Item | Status |
|------|--------|
| #1 QUAL-024 multi-select centers | SAFE TO REPORT CLOSED (note WR-03 orphaned-selection UX) |
| #2 QUAL-022 time-filtered Grundgesamtheit | SAFE *with caveat* — see WR-01 (metrics use full history) |
| #3 QUAL-023 absolute counts | NEEDS LABEL CONFIRMATION — see WR-02 (counts cases, labeled patients) |
| #4 QUAL-025 approve/flag control placement | SAFE TO REPORT CLOSED (IN-04) |
| #5 FALL-010 drill-down | SAFE TO REPORT CLOSED (sizing fixed, click works, IDOR gated, cross-cohort disabled; harden per IN-01) |
| #6 FALL-011 reference overlay | NEEDS WORK — see WR-04 (self-inclusion) + WR-05 (exact-date sparsity); privacy/toggle-default/empty-safe all OK |
| #7 FALL-012 labels | SAFE TO REPORT CLOSED (all keys present DE+EN; no hardcoded leftovers found) |
| AUDIT-02 | SAFE *conditionally* — see WR-06 (document untrusted-actor semantics + strip control chars) |
| #8 A-06 tickCount | SAFE TO REPORT CLOSED (IN-05) |

---

_Reviewed: 2026-05-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
