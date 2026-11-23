# Z0 — Revision plan (cycle 0, base ab886dc, version 1.20.3)

Status: draft for the study team (`useavibe plan-approve`, ZA05). No implementation before approval.
Inputs read: `.planning/useavibe/Z0/PROBLEMS.md` (26 problems, all PL06 = `1 umgesetzt`), `acceptance/Z0/Z0-P01…P26.feature`,
`docs/Pflichtenheft.md`, `docs/Lastenheft.md`, `.planning/GLOSSARY.md`, `CLAUDE.md`, `handoff/requirements/*.yaml`,
`tests/acceptance-at/*.spec.ts`. Code search was done by Explore subagents. I re-opened and checked the key locations myself:
`useOutcomesRouteState.ts:104-126`, `AnalysisPage.tsx:112-120, 300-348`, `plotlyTraces.ts:209-245`, `CohortBuilderPage.tsx:513-519, 695-727`,
`outcomesViewStatePersist.ts:20-45`, `sysrb.spec.ts:26-42`, `koh.spec.ts:38-46`, `qual.spec.ts:218-222`, `Layout.tsx:80-155`, and the registry lines cited under Conflicts.
Line ranges not in that list come from the subagent reports and are marked `(via Explore)`.

**Earlier cycles:** none. `acceptance/` contains only `Z0/`, so there are no earlier-cycle scenarios to keep green.
The regression net is therefore the UIR registry, the Vitest suite (`npm run test:ci`) and the AT suite (`tests/acceptance-at/`).

**Registry command** (`/uat-implement` §1). Each problem section below lists the arguments as `REG <files>`:
`node -e "const y=require('js-yaml'),fs=require('fs');const own=process.argv.slice(1);for(const f of fs.readdirSync('handoff/requirements'))for(const r of y.load(fs.readFileSync('handoff/requirements/'+f,'utf8')).requirements)if([...r.evidence||[],...(r.tests||[]).map(t=>t.file)].some(p=>own.some(o=>String(p).startsWith(o))))console.log(r.id,'|',r.title,'|',(r.tests||[]).map(t=>t.file+' :: '+(t.name||'*')).join('; '))" <files>`
Run over all candidate files together, it returns 329 UIR entries. Each section lists only the entries a scan of every entry found affected.
Each implementing session must re-run the command for its own file set.

**Test conventions (all problems):**
- Playwright specs go in `tests/acceptance/Z0/<ID>.spec.ts`, with one test per scenario titled `[<ID>] <Scenario name>`.
- Specs use the `tests/acceptance/fixtures.ts` fixtures (`loginAs`, pinned clock).
- Saved cohorts are created through `POST /api/data/saved-searches` and removed afterwards. The helper follows the pattern in `qual.spec.ts:25-37` (via Explore) and lives in a new file, `tests/acceptance/Z0/helpers.ts`.
- English UI is selected through `localStorage['emd-locale']`, the key read at `LanguageContext.tsx:16`.
- Data-dependent preconditions are asserted inside the test (for example "at least 1 case with CRT > 400 µm"), so a failure in the synthetic data shows up as a failed precondition, not as a false pass.
- Each new test must fail before the fix (test first).
- `@visual` scenarios need the human/agent browser pass.

---

## Z0-P01
1. **Location**
   - `src/pages/CohortBuilderPage.tsx:684-739`, age inputs:
     - line 703: Min onChange writes `[v, f.ageRange?.[1] ?? 120]`;
     - lines 715-720: clearing Max resets it to 120;
     - line 725: Max onChange writes `[f.ageRange?.[0] ?? 0, v]`;
     - lines 247-254: validation.
   - `shared/patientCases.ts:145-148`: the `ageRange` predicate (via Explore).
   - `src/utils/cohortFilterSerialization.ts:33, 89-90`: summary `Alter ${min}–${max}` (via Explore).
   - `shared/savedSearchSanitize.ts:38-40` (via Explore).
2. **Root cause as observed:** the filter is a closed 2-tuple. Entering one bound fills in the other (Max = 120, or Min = 0), and Max cannot be emptied while a Min exists.
   Reproducible from code. Typing "85" into a Max field that already holds "120" in a number input gives "12085" unless the user clears it first, which matches the tester's report.
3. **Proposed change:**
   - Allow open bounds in the age filter: `ageRange: [number | null, number | null]`, or the equivalent optional fields. Change the two input handlers so they never fill in the other bound.
   - Update the predicate (`shared/patientCases.ts`), the sanitizer (`shared/savedSearchSanitize.ts`, which must keep accepting old saved 2-tuples) and the summary text (`cohortFilterSerialization.ts`).
   - The validation in `CohortBuilderPage.tsx` checks lower > upper only when both bounds are set.
   - Wording of the summary for open bounds: see Q1.
4. **Regression risk**
   - REG `src/pages/CohortBuilderPage.tsx shared/patientCases.ts shared/savedSearchSanitize.ts src/utils/cohortFilterSerialization.ts`.
   - Registry entries:
     - UIR-COH-006 statement (`COH.yaml:110`, via Explore) says "enter a minimum and maximum age". This is not contradicted: both bounds can still be entered.
     - The notes at `COH.yaml:124` say "Default upper bound when only Min is set is 120". That sentence becomes untrue. It is a note, not a statement or expectation, and the registry must be amended (C1).
     - UIR-COH-011, mapped to `tests/cohortBuilderValidation.test.tsx` ("age min above age max…"): stays valid.
     - UIR-COH-014, mapped to `tests/cohortFilterPersistence.test.tsx` ("typing an age filter writes JSON…"): at risk if the shape of the stored JSON changes.
   - EMDREQ-KOH-002 (`Pflichtenheft.md:504-507`, via Explore): still satisfied.
   - AT-KOH-003-03 (`koh.spec.ts:56, 65-67`, via Explore) fills both bounds and is not affected.
5. **Test approach:** Playwright `Z0-P01.spec.ts`, four scenarios.
   - Selectors: the `Alter (Jahre)` group with placeholders `Min`/`Max`; the result count comes from the existing `cohortCount` helper (`tests/acceptance-at/helpers.ts`, via Explore).
   - Ages are checked against the `localBundles` synthetic data (helpers).
   - Plus a Vitest test for the predicate with open bounds (`[Z0-P01]`).
6. **Size and dependencies:** S. Depends on: C1, Q1.

## Z0-P02
1. **Location**
   - `CohortBuilderPage.tsx:421-432`: button "Gespeicherte Suchen (n)", with no `title` and no `aria-expanded` (via Explore).
   - `CohortBuilderPage.tsx:513-519`: row button `title={t('execute')}` ("Ausführen"), Play icon, no `aria-label` (opened).
   - `CohortBuilderPage.tsx:365-369`: `handleLoadSearch`, which only calls `setFilters` and `setShowSaved(false)`. The cohort name is shown nowhere (via Explore).
2. **Root cause as observed:**
   - Neither control describes itself: the only label on the row button is the native title "Ausführen".
   - Loading does not show which cohort is now active.
   - Adjacent finding: the visus text inputs are not re-synced on load (see Observed, not changed).
3. **Proposed change:**
   - In `CohortBuilderPage.tsx`, give the toggle button `title` and `aria-describedby` texts "Gespeicherte Kohorten anzeigen und laden" / EN "Show and load saved cohorts". Its visible name stays "Gespeicherte Suchen (n)".
   - Give the row button `aria-label` and `title` "Kohorte „<Name>“ laden" / EN "Load cohort “<name>”".
   - After loading, show the cohort name on the page. Options in Q2: (a) a status line "Geladene Kohorte: <Name>" above the filters, or (b) pre-fill the name input.
   - Add the new keys to `src/i18n/translations.ts`.
   - The loaded name is cleared on the next manual filter edit, using the existing `clearPresetOnManualEdit`.
4. **Regression risk**
   - REG `src/pages/CohortBuilderPage.tsx src/i18n/translations.ts`.
   - **Conflicts:**
     - UIR-COH-035 statement (`COH.yaml:713`): "re-execute a saved search via \"Ausführen\"".
     - UIR-COH-041 expect (`COH.yaml:866`): "\"Ausführen\" loads…".
     - **AT-KOH-003-02** (`koh.spec.ts:44`) uses `sub.getByTitle('Ausführen').click()`, which fails once the title changes. See C2.
     - `koh.spec.ts:39` uses `getByRole('button', { name: /^Gespeicherte Suchen/ })`. This stays green as long as the visible text remains the accessible name. Use `aria-describedby`, not `aria-label`, for the tooltip text.
   - At risk: UIR-COH-033, mapped to `tests/cohortBuilderEntryPoints.test.tsx`.
   - EMDREQ-KOH-005/-006 (`Pflichtenheft.md:547-561`, via Explore): still satisfied.
5. **Test approach:** Playwright `Z0-P02.spec.ts`.
   - Hover tooltip: assert the `title` attribute, or the visible custom tooltip, depending on the mechanism chosen in Q12.
   - Row button by accessible name.
   - Loading flow: start with Min 50, load the saved cohort (Min 70), assert the Min field shows 70 and the name is shown.
   - EN variant included.
6. **Size and dependencies:** S. Depends on: C2, Q2, Q12.

## Z0-P03
1. **Location**
   - `src/components/outcomes/OutcomesPanel.tsx:138-145, 351-353`: y-axis title keys `outcomesYAxis*` (via Explore).
     - Current values: "Visus (logMAR)", "Δ logMAR", "Δ logMAR %", "Netzhautdicke (µm)", "Δ µm", "Δ %".
     - The hidden marker `outcomes-panel-{eye}-ylabel` carries `data-ylabel`.
   - There is no info icon at the axis. `InfoTooltip` exists in `src/components/primitives/InfoTooltip.tsx:9-27` (native `title`).
2. **Root cause as observed:** the delta and percent modes are titled with symbols only. They name neither the quantity, nor the reference (baseline), nor the unit in words. Reproducible from code.
3. **Proposed change:**
   - Replace the six y-axis texts in `translations.ts` (DE/EN):
     - CRT Δ: "CRT-Veränderung zum Ausgangswert (µm)" / "CRT change from baseline (µm)"
     - CRT Δ%: "… (%)"
     - CRT absolute: "Netzhautdicke (µm)" (unchanged)
     - Visus Δ: "Visus-Veränderung zum Ausgangswert (logMAR)" / "Visual acuity change from baseline (logMAR)"
     - Visus Δ%: "… (%)"
     - Visus absolute: "Visus (logMAR)" (unchanged)
   - Add an info icon next to the chart title in `OutcomesPanel.tsx`, with an explanatory text containing "Ausgangswert" and "erste Messung". Wording: see Q3.
   - The renderer is affected by P23: after a Recharts migration the title is an axis `label` (see Order).
4. **Regression risk**
   - REG `src/components/outcomes/OutcomesPanel.tsx src/i18n/translations.ts`.
   - **Conflicts (C3):**
     - UIR-TRAJ-007 statement (`TRAJ.yaml:159`) lists the old titles.
     - UIR-TRAJ-001 expect (`TRAJ.yaml:40`): "y-axis title reads 'Δ µm'".
     - UIR-TRAJ-006 expect (`TRAJ.yaml:155`, via Explore) and UIR-TRAJ-010 expect (`TRAJ.yaml:241`, via Explore).
   - Mapped Vitest tests that assert the old strings must be listed when implementing. They keep their title and assertions, so if one goes red, stop and report.
   - EMDREQ-ANL-002 (`Pflichtenheft.md:596-607`): not affected.
5. **Test approach:**
   - Playwright `Z0-P03.spec.ts`: read the title from `[data-testid="outcomes-panel-od-ylabel"]` `data-ylabel`, or the equivalent marker after P23.
   - Info icon: hover the icon and assert the tooltip text.
   - Y-mode is set in the "Diagramm-Anzeige" drawer. EN variant included.
6. **Size and dependencies:** S. Depends on: C3, Q3. Implement after P23 if C8 is answered "migrate".

## Z0-P04
1. **Location**
   - `src/components/outcomes/useOutcomesRouteState.ts:106-125`, `resolveCohort` (opened): reads `searchParams.get('filter')` (singular).
   - `src/pages/AnalysisPage.tsx:114-119` (opened): reads `searchParams.get('filters')` (plural).
   - `CohortBuilderPage.tsx:990-1000` (via Explore): "Kohorte analysieren" navigates to `/analysis?filters=<json>`.
   - `AnalysisPage.tsx:391`: `<OutcomesView />` is rendered without cohort props (via Explore).
   - `OutcomesView.tsx:285-298` (via Explore): heading `Outcomes[: name]` with subtitle "Gespeicherte Kohorte · n Patient:innen" or "Ad-hoc-Filter · n Patient:innen".
2. **Root cause as observed:**
   - **Confirmed from code:** an unsaved filter cohort reaches Verläufe as `?filters=`. `resolveCohort` ignores it and shows **all** `activeCases` labelled "Ad-hoc-Filter".
   - The "Zentren" narrowing of the header (`AnalysisPage.tsx:209-217`, via Explore) is not passed to Verläufe either.
   - The tester saw "Keine Patient:innen in dieser Kohorte". From code, that only happens when `?cohort=` names an id missing from `savedSearches`, or when `?filter=` fails to parse. **For a valid saved cohort I cannot reproduce the empty state from code** (unverified; needs a browser check on the 1.20.3 container).
3. **Proposed change:**
   - Resolve the cohort once in `AnalysisPage.tsx`, from `?cohort=` or `?filters=`, and pass it, together with its display name, as a prop to `OutcomesView.tsx`.
   - `resolveCohort` in `useOutcomesRouteState.ts` uses the same shared parser (`parseCohortFilterJson`) instead of `?filter=`.
   - The Verläufe heading names the same cohort as the header ("Gefilterte Kohorte" or the saved name), using a new key replacing `outcomesSubtitleAdhoc`. The text depends on Q4.
   - Whether the centre narrowing also applies to Verläufe is Q5.
4. **Regression risk**
   - REG `src/pages/AnalysisPage.tsx src/components/outcomes/OutcomesView.tsx src/components/outcomes/useOutcomesRouteState.ts`.
   - **Conflict (C4):** UIR-TRAJ-042 statement (`TRAJ.yaml:953`) fixes the heading "Outcomes: <name>" and the subtitle "Ad-hoc-Filter · <n> Patient:innen".
   - At risk:
     - UIR-AGG-005, mapped to `tests/AnalysisPage.test.tsx` ("saved-search path: shows activeSavedSearch.name…");
     - UIR-TRAJ-017, mapped to `tests/OutcomesPage.test.tsx` ("2./3./5. renders no-cohort empty state…"), which must stay green for real empty cohorts;
     - UIR-AGG-017 ("Aggregiert and Verläufe share the same cohort", partial, no tests): this change fulfils it.
   - **Count unit conflict (C5):** the header shows **cases** ("Fälle in der aktuellen Kohorte", `AnalysisPage.tsx:339-340`), while Verläufe counts `cohort.cases.length` but labels it "Patient:innen". P04 asks for "same number of cases", P10/P22 for "same number of patients".
5. **Test approach:** Playwright `Z0-P04.spec.ts`.
   - Enter Min 70 in Kohortenbildung, click "Kohorte analysieren", open the tab `role=tab` "Verläufe", and compare the header name and count with the Verläufe heading and count.
   - Also: the saved-cohort path, and an Aggregiert↔Verläufe round trip.
   - Vitest `[Z0-P04]` for `resolveCohort` with `?filters=`.
6. **Size and dependencies:** M. Depends on: C4, C5, Q4, Q5. P10, P17 and P22 build on it.

## Z0-P05
1. **Location**
   - `src/components/outcomes/CohortCompareDrawer.tsx` (via Explore):
     - lines 52-59 and 124-174: options are `savedSearches` only;
     - lines 72-74: label with English "patients" hard-coded;
     - line 39: maximum of 4.
   - `OutcomesView.tsx:95-97`: default selection (via Explore).
   - `useOutcomesRouteState.ts:519-546`: compare state in `?cohorts=` (via Explore).
   - For comparison, the case view: `CaseDetailPage.tsx:36, 87-102`, with `ALL_PATIENTS_COHORT_ID` and "Alle Patienten (N=cases.length)" (via Explore).
2. **Root cause as observed:** there is no "Alle Patienten" option in the drawer, and the base population can only be compared after saving it as a cohort. Reproducible from code.
3. **Proposed change:**
   - `CohortCompareDrawer.tsx` lists "Alle Patienten" / EN "All patients" as the first option, with N = the number of patients of all accessible cases (definition in C5/Q6).
   - It is ticked automatically the first time the drawer is opened for a base cohort and can be unticked.
   - `useOutcomesRouteState.ts` represents it in `?cohorts=` with a reserved id, consistent with `ALL_PATIENTS_COHORT_ID`, and resolves it to the case set.
   - Fix the hard-coded "patients" (row label in `CohortCompareDrawer.tsx`) through `translations.ts`.
   - Open choices: Q6 (what "first opening" means, whether it counts toward the cap of 4, and behaviour in the split flow).
4. **Regression risk**
   - REG `src/components/outcomes/CohortCompareDrawer.tsx src/components/outcomes/useOutcomesRouteState.ts src/components/outcomes/OutcomesView.tsx`.
   - **Conflicts (C6):**
     - UIR-COH-042 expect (`COH.yaml:898`): "the drawer is open with both sub-cohorts ticked and \"P\" unticked". This would change if "Alle Patienten" is also preselected on the split-flow first opening.
     - UIR-TRAJ-031 expect (`TRAJ.yaml:719`): "Rows read '<Name> (N=<n> patients)'".
   - At risk:
     - `tests/cohortCompareDrawer.test.tsx` ("XCOHORT-01: primary cohort checkbox is checked and disabled", "…max 4 cohorts — 5th checkbox is disabled…", "J7: with no primary…");
     - UIR-AGG-016, mapped to `tests/AnalysisPage.test.tsx` ("cross-mode: …").
   - EMDREQ-ANL-003 (`Pflichtenheft.md:609-620`): supported.
5. **Test approach:** Playwright `Z0-P05.spec.ts`.
   - The first checkbox in drawer `role=dialog` "Kohorten vergleichen" is "Alle Patienten …", checked, and the subtitle reads "2 Kohorten verglichen".
   - The legend contains both names. Untick and assert the subtitle is gone.
   - EN variant included.
   - The N comparison is computed in the test from `localBundles`, following the definition chosen in Q6.
6. **Size and dependencies:** M. Depends on: C5, C6, Q6. P26 and P23 build on it.

## Z0-P06
1. **Location**
   - `src/components/outcomes/outcomesViewStatePersist.ts:25, 38-40` (opened): sessionStorage key `emd.outcomesView.v1.<cohortId|__adhoc__>`, i.e. per cohort.
   - `useOutcomesRouteState.ts:182-219` (via Explore): read once at mount.
   - `useOutcomesRouteState.ts:416-419` (via Explore): a metric switch resets `yMetric`/`axisMode` in memory without writing them.
   - Persist `:67-68` (via Explore): layers are merged, so reset does not clear them.
   - `AnalysisPage.tsx:371-392` (via Explore): `OutcomesView` remounts on every tab switch.
2. **Root cause as observed:** settings are stored per cohort by design, and only explicitly toggled values are persisted.
   - Returning through the nav goes to bare `/analysis`, which uses the `__adhoc__` key, the Aggregiert tab and the default metric.
   - A different cohort starts with defaults.
   - Reproducible from code for the cohort switch.
   - For the Aggregiert↔Verläufe round trip, the settings should survive in principle, unless a metric switch happened before (stale stored value). The tester's exact path is unknown.
3. **Proposed change:**
   - In `outcomesViewStatePersist.ts`, switch to a single session-wide key for axis, y-metric and layers. Write every effective change, including the reset in `useOutcomesRouteState.ts`.
   - Fix the reset-merge bug, since it shares the root cause.
   - Scope (which settings, whether they also survive a metric-tab switch, and how they interact with size-derived defaults): Q7.
4. **Regression risk**
   - REG `src/components/outcomes/outcomesViewStatePersist.ts src/components/outcomes/useOutcomesRouteState.ts`.
   - **Conflicts (C7):**
     - UIR-TRAJ-020 statement (`TRAJ.yaml:452`): "persists … per cohort". Its mapped test `tests/outcomesViewStatePersist.test.ts` :: "keys state PER cohort (one cohort does not see another cohort state)" **would go red**. That is a stop condition and needs a team decision.
     - UIR-TRAJ-019 notes (`TRAJ.yaml:449`).
     - UIR-TRAJ-001 expect (`TRAJ.yaml:40`): "a metric switch resets to Δ/days".
   - At risk:
     - UIR-TRAJ-018, mapped to `tests/OutcomesPerfI2.test.tsx` (size-derived OFF for large cohorts);
     - UIR-TRAJ-019, mapped to `tests/OutcomesViewPersist.test.tsx`;
     - UIR-TRAJ-014 (reset).
5. **Test approach:** Playwright `Z0-P06.spec.ts`, three scenarios.
   - Selectors: drawer "Diagramm-Anzeige", the radio "Anzahl Behandlungen", the checkbox "Streuband (IQR)".
   - Navigation runs through the sidebar "Kohortenbildung" and back via the saved-search "Outcomes anzeigen" link (`/analysis?tab=trajectories&cohort=<id>`).
6. **Size and dependencies:** S–M. Depends on: C7, Q7.

## Z0-P07
1. **Location:** `src/components/outcomes/plotlyTraces.ts:209-245`, `buildCrossCohortTraces` (opened).
   - The IQR band is pushed for every cohort without checking `layers.spreadBand`, whereas the single-cohort path checks it at line 88 (via Explore).
   - The hidden marker `outcomes-panel-{eye}-iqr` follows the toggle (`OutcomesPanel.tsx:551-553`, via Explore), so a marker-only test passes falsely.
2. **Root cause as observed:** confirmed from code. The toggle is ignored in compare mode.
3. **Proposed change:**
   - Guard the band traces in the compare builder with `layers.spreadBand` (`plotlyTraces.ts`), or in the Recharts equivalent after P23.
   - Each cohort's band uses its cohort colour.
   - Expose a per-band DOM hook (e.g. `data-testid="iqr-band-<cohortId>"`) so tests count drawn bands, not the marker.
   - `layers.median` is also ignored in compare mode (same function), but that is a separate symptom: see Observed, not changed.
4. **Regression risk**
   - REG `src/components/outcomes/plotlyTraces.ts src/components/outcomes/OutcomesPanel.tsx`.
   - At risk:
     - UIR-TRAJ-034, mapped to `tests/OutcomesPanel.test.tsx` ("M3: …");
     - UIR-TRAJ-015, mapped to `tests/OutcomesPage.test.tsx` ("10. toggling spreadBand off removes the IQR marker…").
   - No statement is contradicted (scan; no entry says the band is always shown in compare mode).
5. **Test approach:**
   - Playwright `Z0-P07.spec.ts`: count the band elements per panel, and compare each band's fill colour with the legend swatch colour.
   - Vitest `[Z0-P07]` on the trace builder (band traces absent when `spreadBand=false`). This test is pure logic and survives a renderer change only if the builder is kept.
6. **Size and dependencies:** S. Implement after P23 if C8 is answered "migrate" (otherwise it is a one-line Plotly fix).

## Z0-P08
1. **Location** (all via Explore)
   - `OutcomesPanel.tsx:285` and `plotlyTraces.ts:153`: the median hovertemplate shows only "Median".
   - `plotlyTraces.ts:293-302`: compare medians have no hovertemplate; the trace name is the English "(N=… patients)".
   - `shared/cohortTrajectory.ts:196-214` `buildGrid`: a uniform grid of `gridPoints` (default 120) between min and max, so x is fractional in treatments mode.
   - Case view tooltip for comparison: `VisusCrtChart.tsx:124-169` `renderTooltip`, in Recharts.
2. **Root cause as observed:**
   - The tooltips carry no x-axis label and no assignment of values to cohorts.
   - The interpolation grid is not aligned to integers on the discrete treatments axis.
   - Both confirmed from code.
3. **Proposed change:**
   - The tooltip heading becomes "<x-axis label>: <x>" ("Anzahl Behandlungen: 5" / "Tage seit Baseline: n").
   - Each row reads "<Kohorte> · Median: <Wert> <Einheit>" and carries the cohort colour, styled like the case-view tooltip.
   - For axis mode "treatments", the grid in `shared/cohortTrajectory.ts` uses integer x values (step 1).
   - Files: the trajectory panel renderer (`OutcomesPanel.tsx`/`plotlyTraces.ts`, or the new Recharts component, P23), `shared/cohortTrajectory.ts`, and `translations.ts`.
   - Whether the grid slider (20–300) still applies in treatments mode: Q8.
4. **Regression risk**
   - REG `src/components/outcomes/ shared/cohortTrajectory.ts src/utils/cohortTrajectory.ts`.
   - **Conflict (C9):** UIR-TRAJ-024 expect (`TRAJ.yaml:561`): "hovering the median line shows only Plotly's small 'Median' label".
   - At risk:
     - UIR-TRAJ-010 grid slider;
     - UIR-TRAJ-007 x-title "Behandlung #";
     - `tests/cohortTrajectory.test.ts`, `tests/cohortTrajectoryShared.test.ts` and `tests/outcomesAggregateParity.test.ts` (server/client grid parity). They must stay green with the integer grid; any one that asserts a uniform grid would go red. Listed for the implementing session.
5. **Test approach:**
   - Playwright `Z0-P08.spec.ts`: hover the median point at x = 5, read the tooltip DOM, and check that no grid point lies in (4, 5) through a `data-x` hook.
   - The `@visual` scenario goes to the browser pass.
   - Vitest `[Z0-P08]` on `buildGrid` in treatments mode.
6. **Size and dependencies:** M. Depends on: C9, Q8, and P23 (renderer).

## Z0-P09
1. **Location**
   - `AnalysisPage.tsx:303-308` (opened): `criticalCount` = cases in `centeredCohort` with any CRT > 400. The threshold 400 is hard-coded.
   - `AnalysisPage.tsx:341-345` (opened): a plain red `<span>`, not clickable.
   - Threshold setting `crtImplausibleThresholdUm: 400` in `config/settings.yaml` (via Explore).
2. **Root cause as observed:** the count is display-only and there is no path to the counted cases. Confirmed.
3. **Proposed change:**
   - In `AnalysisPage.tsx`, the count becomes a button that opens a list "Fälle mit kritischen Werten". Each entry shows the pseudonym, the highest CRT in µm and a button "Vollständige Fallansicht" (navigate `/case/:id`).
   - "Zurück" (`navigate(-1)`, `CaseDetailPage.tsx:216-221`, via Explore) returns to the analysis with the same URL, so the cohort is preserved.
   - Add keys to `translations.ts`.
   - List form (dialog/popover/drawer), sorting, the threshold source (settings or hard-coded) and the reference in compare mode: Q9.
4. **Regression risk**
   - REG `src/pages/AnalysisPage.tsx src/i18n/translations.ts`.
   - UIR-AGG-007 statement (`AGG.yaml:153`, via Explore) calls it a red "… Fälle mit kritischen Werten" segment. The text stays, so the statement is not contradicted.
   - EMDREQ-ANL-004 (`Pflichtenheft.md:622-633`): supported.
5. **Test approach:** Playwright `Z0-P09.spec.ts`.
   - Precondition: the cohort contains a case with CRT > 400, using a saved cohort with a filter that guarantees one (checked against `localBundles`).
   - Assert that the button's count equals the number of list entries; open the first entry and check `h1` equals its pseudonym; click "Zurück" and check the header name.
6. **Size and dependencies:** M. Depends on: Q9.

## Z0-P10
1. **Location:** same as P04 (`useOutcomesRouteState.ts:106-125`), plus the metric tabs `OutcomesView.tsx:196-276` (all use `s.cohort`) and `OutcomesDataPreview.tsx` (raw data from `s.cohort`), via Explore.
2. **Root cause as observed:** the same root cause as P04 (`?filter=` vs `?filters=`). All four metric tabs and "Rohdaten" receive all `activeCases`.
3. **Proposed change:**
   - No further code beyond P04 is expected. The P10 session adds the tests and verifies the four tabs and the raw data.
   - If the Interval/Responder tabs show a different count (they use `s.cohort.cases`), align them in `OutcomesView.tsx`.
4. **Regression risk:** as for P04. At risk: UIR-TRAJ-040, mapped to `tests/OutcomesPage.test.tsx` ("14./15. …").
5. **Test approach:** Playwright `Z0-P10.spec.ts`.
   - Iterate `[data-testid=metric-tab-visus|crt|interval|responder]` and compare the count with the header.
   - Raw data: open `<details data-testid="outcomes-data-preview">` and check each pseudonym's age ≥ 70 against `localBundles`.
6. **Size and dependencies:** S. Depends on: P04, C5.

## Z0-P11
1. **Location:** no help button or dialog exists in `src/components/outcomes/` (via Explore; searched for `HelpCircle`/`InfoTooltip`). The header buttons are at `OutcomesView.tsx:325-335` ("Diagramm-Anzeige").
2. **Root cause as observed:** the Verläufe functions (single-case click, compare, display settings, raw data) are not explained anywhere.
3. **Proposed change:**
   - Add a button "Hilfe zu Verläufen" / EN "Help on trajectories" next to "Diagramm-Anzeige" in `OutcomesView.tsx`.
   - It opens a modal dialog (new component `src/components/outcomes/OutcomesHelpDialog.tsx`, with focus trap, Escape and focus return) containing short sections on Einzelfallansicht, Kohorten vergleichen, Diagramm-Anzeige and Rohdaten anzeigen.
   - Text wording (DE/EN): Q10.
4. **Regression risk**
   - REG `src/components/outcomes/OutcomesView.tsx src/i18n/translations.ts`.
   - At risk: UIR-TRAJ-002, mapped to `tests/OutcomesPage.test.tsx` ("9. toggling x-axis…"), because the button row changes.
   - No statement is contradicted.
5. **Test approach:** Playwright `Z0-P11.spec.ts`: `getByRole('button', {name:'Hilfe zu Verläufen'})`, the `role=dialog` name, the contents, Escape, and the focus check via `toBeFocused()`. EN variant included.
6. **Size and dependencies:** S. Depends on: Q10. The text must match P13/P19/P20/P21 behaviour, so implement after them, or update the text later within the same cycle.

## Z0-P12
1. **Location** (via Explore)
   - Per-patient traces: `plotlyTraces.ts:131-176`, opt-in via `layers.perPatient`. Default OFF for more than 100 patients (UIR-TRAJ-018).
   - Settings drawer: `OutcomesSettingsDrawer.tsx:176-220`.
   - Critical count: `AnalysisPage.tsx:303-308`.
2. **Root cause as observed:** there is no way to emphasise the cases with critical values in the trajectories.
3. **Proposed change:**
   - Add a checkbox "Fälle mit kritischen Werten hervorheben" / EN "Highlight cases with critical values" (default off) in `OutcomesSettingsDrawer.tsx`.
   - When ticked, the panel renderer draws those patients' curves highlighted (colour and width) with the legend entry "Fälle mit kritischen Werten", regardless of the "Individuelle Kurven" toggle. Clicking a curve opens the case.
   - The predicate is shared with P09 and moves to `shared/`, following D-01.
   - Count unit (cases vs patient curves), compare-mode behaviour and colour: Q11.
4. **Regression risk**
   - REG `src/components/outcomes/OutcomesSettingsDrawer.tsx src/components/outcomes/ src/pages/AnalysisPage.tsx`.
   - At risk: UIR-TRAJ-010 (drawer sections), UIR-TRAJ-018 (size defaults).
   - EMDREQ-ANL-004: supported.
5. **Test approach:** Playwright `Z0-P12.spec.ts`. Count highlighted curves through a DOM hook (`data-critical="true"`), compare with the header count, click a point, and assert the case CRT chart has a value > 400 (via the chart data hook or the CRT values table).
6. **Size and dependencies:** M. Depends on: P09 (predicate), P23 (renderer), Q11.

## Z0-P13
1. **Location:** no visible hint exists. `outcomesDrillDownHint` ("Datenpunkt anklicken, um den Fall zu öffnen") is used only as an `aria-label` (`OutcomesPanel.tsx:531-535`, via Explore). Drill-down is disabled in compare mode (`VisusMetricContainer.tsx:107`, `CrtMetricContainer.tsx:79`, via Explore).
2. **Root cause as observed:** the click function is not visible without interaction. Confirmed.
3. **Proposed change:**
   - Show a visible hint line directly above the charts in `OutcomesView.tsx`/`OutcomesPanel.tsx`:
     - "Klicken Sie auf eine Kurve oder einen Messpunkt, um die Einzelfallansicht zu öffnen." / EN "Click a curve or a measurement point to open the case view.";
     - when the per-patient layers are off: "Blenden Sie unter „Diagramm-Anzeige“ individuelle Kurven ein, um einzelne Fälle zu öffnen." / EN "Show per-patient curves under “Chart display” to open single cases."
   - The text "Klicken Sie auf eine Kurve" promises line clicks, which P21 delivers.
   - Behaviour in compare mode: Q12b.
4. **Regression risk**
   - REG `src/components/outcomes/OutcomesView.tsx src/components/outcomes/OutcomesPanel.tsx src/i18n/translations.ts`.
   - At risk: UIR-TRAJ-009 (drill-down aria hint).
5. **Test approach:** Playwright `Z0-P13.spec.ts`: the text is visible and precedes the chart container (DOM order and bounding box). Untick both layers and assert the alternate text. EN variant included.
6. **Size and dependencies:** S. Depends on: P21 (the text promises line click), Q12.

## Z0-P14
1. **Location**
   - `src/components/quality/QualityCaseDetail.tsx:398-419` (via Explore): exclude button, then the plain text button "Vollständige Fallansicht" (`text-sm text-blue-600 hover:underline`, no title).
   - `QualityPage.tsx:461`: `navigate('/case/<id>')`.
   - Case view selector "Vergleichskohorte wählen": `PatientHeader.tsx:217-232`, shown only with more than one option.
2. **Root cause as observed:** the link is styled as small text and has no tooltip, and nothing points to the cohort comparison in the case view. Confirmed.
3. **Proposed change:**
   - In `QualityCaseDetail.tsx`, render "Vollständige Fallansicht" as a visible button in the header row next to the pseudonym, with the tooltip "Einzelfallansicht mit Verläufen und Vergleich mit einer Kohorte öffnen".
   - Add the hint text "In der vollständigen Fallansicht können Sie diesen Fall mit einer Kohorte vergleichen." (EN counterparts proposed in `translations.ts`).
   - **Move** the existing control or **add** a second one: Q13. Moving avoids C10.
   - Scenario 3 requires the selector "Vergleichskohorte wählen" in the case view. It currently appears only when more than one option exists ("Alle Patienten" is always present, so it appears only when a saved cohort contains the case). See C11 together with P23.
4. **Regression risk**
   - REG `src/components/quality/QualityCaseDetail.tsx src/i18n/translations.ts`.
   - **Conflicts (C10):**
     - UIR-CASE-002 step (`CASE.yaml:41`): "Click \"Vollständige Fallansicht\" in the action row under the panel's header strip". The location becomes untrue if moved.
     - **AT-QUAL-006-01** (`qual.spec.ts:220`) uses `page.getByRole('button', { name: 'Vollständige Fallansicht' })`. With two such buttons this is a strict-mode failure. Not affected if the control is moved and stays a single `button` with that accessible name.
   - At risk: UIR-QUAL-017 (header content).
5. **Test approach:** Playwright `Z0-P14.spec.ts`.
   - Check the button sits in the same header row as the pseudonym (shared parent / bounding-box y overlap) and its `title`.
   - Hint text; click, then the case view `h1` and the selector `aria-label="Vergleichskohorte wählen"`.
   - Precondition: the first case belongs to a saved cohort, otherwise the selector is hidden (C11).
6. **Size and dependencies:** S. Depends on: C10, C11, Q13.

## Z0-P15
1. **Location:** `src/pages/CaseDetailPage.tsx:332-481`, second chart (via Explore). The title is `baselineChange` = "Veränderung zum Ausgangswert" / "Change from Baseline", the same with and without overlay. The info text `baselineChangePlotInfo` says each metric is anchored to its own first value.
2. **Root cause as observed:** the title names neither the quantities nor the reference point. Confirmed.
3. **Proposed change:** change `baselineChange` in `translations.ts` to "Veränderung von Visus und CRT zum Ausgangswert (erste Visite)" / EN "Change in visual acuity and CRT from baseline (first visit)". Legend and axis stay untouched. See C12 on whether "(erste Visite)" is factually correct.
4. **Regression risk**
   - REG `src/pages/CaseDetailPage.tsx src/i18n/translations.ts`.
   - **Conflict (C12):**
     - UIR-CASE-037 statement (`CASE.yaml:732`) names the chart "Veränderung zum Ausgangswert".
     - UIR-CASE-038 statement (`CASE.yaml:751`): "Visus change from the first Visus measurement and CRT change from the first CRT measurement". The new title "(erste Visite)" misdescribes CRT when the first CRT is measured later than the first visit.
   - At risk: UIR-CASE-038/-039, mapped to `tests/VisusCrtChartReference.test.tsx` ("K-bl2: anchors…"). The logic is unchanged.
5. **Test approach:** Playwright `Z0-P15.spec.ts`: read the chart card heading text, with and without the toggle "Kohorten-Referenz anzeigen". EN variant included. The `@visual` scenario goes to the browser pass.
6. **Size and dependencies:** S. Depends on: C12. If C11/P23 replaces the checkbox, scenario 2 of P15 is in conflict (see C11).

## Z0-P16
1. **Location** (via Explore)
   - `QualityPage.tsx:330-339`: time range ("Zeitraum") via `QualityFilterBar`.
   - `QualityPage.tsx:345-364`: "Kohorte" select, in a row with "CSV exportieren".
   - `QualityCaseList.tsx:106-195`: search "Pseudonym suchen...", funnel toggle `title="Filterkriterien"`, and the collapsible block with Prüfstatus, Zentrum, Therapiestatus, CRT-Wert and "Ausgeschlossene anzeigen".
   - Auto-open on URL params: `QualityPage.tsx:109-115`.
2. **Root cause as observed:** filters are split across three places (top bar, cohort row, a hidden dropdown in the list card). Confirmed.
3. **Proposed change:**
   - Create one labelled region `role="region" aria-label="Filterkriterien"` containing Zeitraum, Prüfstatus, Therapiestatus, CRT-Wert and the search field (plus Zentrum/"Ausgeschlossene anzeigen", per Q14).
   - Place the single "Kohorte" control directly next to it.
   - Files: `QualityPage.tsx`, `QualityCaseList.tsx`, possibly `QualityFilterBar.tsx` (shared with Dokumentationsqualität, so only through props), `translations.ts`.
   - Whether the region is always visible or collapsible, and what happens to the funnel toggle: Q14.
4. **Regression risk**
   - REG `src/pages/QualityPage.tsx src/components/quality/QualityCaseList.tsx src/components/doc-quality/QualityFilterBar.tsx`.
   - At risk:
     - UIR-QUAL-001 step (`QUAL.yaml:30`, via Explore): "Kohorte" "(left of \"CSV exportieren\")". Mapped to `tests/qualityCohortScope.test.tsx`.
     - UIR-QUAL-006 step (`QUAL.yaml:173`, via Explore): funnel "title \"Filterkriterien\"".
     - UIR-QUAL-012, mapped to `tests/qualityPageDeepLink.test.tsx` ("auto-opens the filter panel when ?crt=implausible…").
     - UIR-QUAL-009/-010.
   - AT risk: `qual.spec.ts:67-71` `openFilters` uses `getByTitle('Filterkriterien')`, and `qual.spec.ts:56` finds the cohort select by its "Alle Fälle" option (via Explore). Both are in C13.
   - UIR-DOCQ entries apply if `QualityFilterBar.tsx` is changed.
5. **Test approach:** Playwright `Z0-P16.spec.ts`: `getByRole('region',{name:'Filterkriterien'})` contains the five controls; count the "Kohorte" controls (`getByLabel('Kohorte')`) and check they are adjacent (bounding box). Function check: cohort plus "Therapieunterbrecher" leaves all badges "UB".
6. **Size and dependencies:** M. Depends on: C13, Q14.

## Z0-P17
1. **Location:** `AnalysisPage.tsx:333-348` (opened). The h1 is "Kohortenanalyse", followed by an optional blue name line (`displayCohortName`, `AnalysisPage.tsx:129-144`, via Explore). With no cohort there is no line. The compare set is not shown in the header.
2. **Root cause as observed:** the header has no "active cohort" label, shows nothing when no cohort is selected, and does not mention comparisons. Verläufe has its own heading (P04).
3. **Proposed change:**
   - In `AnalysisPage.tsx`, show a line "Aktive Kohorte: <Name>" / EN "Active cohort: <name>" in the header, for saved cohorts, "Gefilterte Kohorte …" and "Alle Patienten".
   - In compare mode add "· verglichen mit: <Namen>" / EN "· compared with: <names>".
   - The header stays above both tabs, so it is visible in both.
   - Keys go in `translations.ts`.
4. **Regression risk**
   - REG `src/pages/AnalysisPage.tsx src/i18n/translations.ts`.
   - **Conflicts (C4):**
     - UIR-AGG-004 expect (`AGG.yaml:101`): "step 4 shows no name line". Its mapped test `tests/AnalysisPage.test.tsx` :: "no ?cohort= and no ?filters=: no cohort name line rendered" **would go red**, a stop condition.
     - UIR-TRAJ-033 statement (`TRAJ.yaml:744`): subtitle "<n> Kohorten verglichen · names". This is not contradicted if the Verläufe subtitle stays and the header line is added.
   - At risk: UIR-AGG-005 and UIR-AGG-019.
5. **Test approach:** Playwright `Z0-P17.spec.ts`: header text via a `data-testid="analysis-active-cohort"` locator, in both tabs, for the filter path, for compare (Verläufe drawer), and for the nav-only path.
6. **Size and dependencies:** S. Depends on: P04, C4, Q4.

## Z0-P18
1. **Location:** `src/components/Layout.tsx:17-32` nav items. `<aside>` is at line 80, `<nav>` at 92, `<main>` at 153 (opened). There is no global search. `DataContext.tsx:107-139` provides `cases` already filtered server-side by the user's sites (`server/fhirApi.ts:81-82`, via Explore).
2. **Root cause as observed:** the case view is reachable only through Datenqualität, the charts or the cohort-builder detail list.
3. **Proposed change:**
   - Add a search field "Fall öffnen (Pseudonym)" / EN "Open case (pseudonym)" to the sidebar in `Layout.tsx` (new component `src/components/CaseSearch.tsx`, combobox ARIA pattern).
   - Suggestions come from the client-side `cases` of `DataContext`, which contains only accessible sites; "Kein Fall gefunden" / EN "No case found" when nothing matches. Choosing a suggestion opens `/case/:id`.
   - Matching (prefix/substring), the number of suggestions, and which case opens when a patient has several cases: Q15.
4. **Regression risk**
   - REG `src/components/Layout.tsx src/i18n/translations.ts`.
   - At risk:
     - UIR-NAV-002 (`NAV.yaml:29`, via Explore) lists the four sidebar entries. Adding a search field does not falsify it.
     - AT-SYS-RB-001-01 `sysrb.spec.ts:28-29` forbids text inputs inside `main` on `/case/<id>`. The search lives in `<aside>` (`Layout.tsx:80`), outside `main`, so the test is not affected as long as it stays there.
     - AT-FALL-002-01 (`fall.spec.ts:73-90`, via Explore) scans `value`/`placeholder` attributes for identifiers. The placeholder contains no identifier, but a selected pseudonym must not remain in the input after navigation; clear it.
   - EMDREQ-USM-004 (`Pflichtenheft.md:367-369`, via Explore): site restriction is preserved because the data source is already filtered.
5. **Test approach:** Playwright `Z0-P18.spec.ts`.
   - The field is visible on the four pages.
   - Type 4 characters, pick from the `role=listbox` option, then check the case `h1`.
   - Restricted user `forscher1` (org-uka, from `data/users.json` via Explore) typing a pseudonym of another site gets "Kein Fall gefunden". The pseudonym is chosen in the test from `localBundles` by `centerId`.
6. **Size and dependencies:** M. Depends on: Q15.

## Z0-P19
1. **Location:** `src/components/outcomes/OutcomesDataPreview.tsx` (via Explore). The first column `outcomesPreviewColPseudonym` is plain text. CSV export is `downloadCsv(headers, rows, …)` at lines 189-193.
2. **Root cause as observed:** raw-data rows are not interactive. Confirmed.
3. **Proposed change:**
   - In `OutcomesDataPreview.tsx`, render the pseudonym cell as a link or button that opens `/case/:id`, resolving the case the same way as `handlePointDrillDown` (`useOutcomesRouteState.ts:308-317`).
   - The CSV rows stay the unchanged plain-text arrays: the change touches only rendering.
   - Which case opens when a patient has several cases: same question as Q15.
4. **Regression risk**
   - REG `src/components/outcomes/OutcomesDataPreview.tsx`.
   - At risk: UIR-TRAJ-040, mapped to `tests/OutcomesPage.test.tsx` ("14. expanding <details> shows 8 column headers…", "15. Export CSV button calls downloadCsv…"). Neither should change.
   - AT-FALL-002-01 (`fall.spec.ts:83`, via Explore) concerns exports in the case view, not here.
5. **Test approach:** Playwright `Z0-P19.spec.ts`.
   - Each pseudonym cell has `role=link`; click the first and check the case `h1`.
   - CSV: catch the download with `page.waitForEvent('download')`, parse it, assert the header contains "Pseudonym" and no cell contains "http".
6. **Size and dependencies:** S. Depends on: Q15.

## Z0-P20
1. **Location:** per-patient tooltip at `OutcomesPanel.tsx:150-199` (via Explore).
   - It shows the pseudonym, x and "logMAR: …". The label is "logMAR" even for CRT, which is a defect sharing this tooltip.
   - There is no click hint, and there is no `cursor` styling in `src/components/outcomes/`.
2. **Root cause as observed:** clickability is not signalled on hover. Confirmed.
3. **Proposed change:**
   - The per-patient tooltip shows "Patient: <Pseudonym>" and ends with "Klicken öffnet die Einzelfallansicht" / EN "Click to open the case view".
   - The cursor over clickable curves and points is `pointer`.
   - The value label follows the metric (fix the wrong "logMAR" for CRT, because it is the same tooltip and would otherwise show inconsistent data).
   - Files: the panel renderer (Plotly or the Recharts component after P23) and `translations.ts`.
4. **Regression risk**
   - REG `src/components/outcomes/OutcomesPanel.tsx`.
   - **Conflict (C9):** UIR-TRAJ-023 expect (`TRAJ.yaml:539`): "three lines: the pseudonym, 'Tag: <n> d' … and 'logMAR: <value> Δ logMAR'". The new format adds "Patient:" and a fourth line.
   - Mapped `tests/OutcomesPanelHoverTooltip.test.tsx` ("shows the HOVERED point in the tooltip"): if it asserts exact line texts, it goes red, which is a stop condition. The implementing session must open it first.
5. **Test approach:** Playwright `Z0-P20.spec.ts`: hover a per-patient point, check the tooltip text, and check `getComputedStyle(...).cursor === 'pointer'` on the hovered element. EN variant included.
6. **Size and dependencies:** S. Depends on: C9, P23 (renderer).

## Z0-P21
1. **Location** (via Explore)
   - `PlotlyChart.tsx:146` forwards `plotly_click`.
   - `plotlyTraces.ts:58-62` `resolveDrillDownId`.
   - Lines carry `customdata` per vertex.
   - Hover widening exists only in single mode with per-patient on and scatter off (`OutcomesPanel.tsx:475-477`).
2. **Root cause as observed:** in Plotly a click on a `lines` trace resolves to the nearest vertex. Hover and click between vertices are not reliable (unverified; from Plotly behaviour, not tested here).
3. **Proposed change:**
   - Make the whole per-patient path clickable and hoverable: a Recharts `<Line>` with `onClick`/`onMouseEnter` on the curve and a wide invisible hit stroke, after P23. Hovering widens that curve by at least 1 px and shows the P20 tooltip.
   - Point clicks keep working.
   - Files: the trajectory panel renderer and the drill-down handler (`useOutcomesRouteState.ts`).
4. **Regression risk**
   - REG `src/components/outcomes/`.
   - **Conflict (C14):** UIR-TRAJ-027 expect (`TRAJ.yaml:617`): "Step 2: no line thickening and no tooltip" when hovering between visits. P21 requires the opposite.
   - At risk: UIR-TRAJ-026 and UIR-TRAJ-029, mapped to `tests/OutcomesPanelLineClick.test.tsx` ("hovering a line shows that patient tooltip; leaving hides it", "clicking a patient line calls onPointClick…").
5. **Test approach:** Playwright `Z0-P21.spec.ts`.
   - Read a curve's two vertex coordinates from DOM (path or `data-*`), click the midpoint, and check the case `h1` equals the tooltip pseudonym.
   - Hover the midpoint and compare `stroke-width` with the other curves.
   - Point click.
6. **Size and dependencies:** M. Depends on: C14, P20, P23.

## Z0-P22
1. **Location:** `AnalysisPage.tsx:97-101, 114-119, 160-169` (cohort from the URL), header `333-348` (no selector), and `useOutcomesRouteState.ts:519-546` (compare state), via Explore and opened.
   - The tester notes "Funktion hat in früherer Version funktioniert". The git history was not examined (unknown which version).
2. **Root cause as observed:**
   - The only way to switch cohorts in the analysis is through Kohortenbildung and the URL.
   - Together with P04 (Verläufe ignoring `?filters=`), a selected cohort did not reach Verläufe.
3. **Proposed change:**
   - Add a selector "Kohorte wählen" / EN "Select cohort" to the analysis header in `AnalysisPage.tsx`, listing "Alle Patienten" plus all saved cohorts. Choosing one writes `?cohort=<id>` (or removes it for "Alle Patienten"), so both tabs follow.
   - In compare mode, switching replaces the base cohort in `?cohorts=` and keeps the other comparison cohorts (`useOutcomesRouteState.ts`).
   - Whether the current unsaved "Gefilterte Kohorte" appears as an option, and the option order: Q16.
4. **Regression risk**
   - REG `src/pages/AnalysisPage.tsx src/components/outcomes/useOutcomesRouteState.ts`.
   - At risk: UIR-AGG-005/-006, UIR-AGG-016 (`tests/AnalysisPage.test.tsx`), UIR-TRAJ-031/-033, and UIR-AGG-017 (fulfilled).
   - Scenario 3 compares the header **case** count with the size of "Vergleichskohorte" in Kohortenbildung, while scenario 2 talks of patients. See C5.
5. **Test approach:** Playwright `Z0-P22.spec.ts`: `getByLabel('Kohorte wählen')` options, switch, check the Verläufe heading/count and Aggregiert. Compare-retention check via the legend texts.
6. **Size and dependencies:** M. Depends on: P04, P05 ("Alle Patienten" representation), C5, Q16.

## Z0-P23
1. **Location** (via Explore)
   - Trajectory charts in Plotly: `PlotlyChart.tsx`, `plotlyTraces.ts`, `plotlyRenderable.ts`, `OutcomesPanel.tsx`, and `package.json:46` `plotly.js-strict-dist-min` (opened).
   - Aggregiert in Recharts: `AnalysisPage.tsx:410-701`, compare only for diagnosis and age-vs-visus (`410-542`).
   - Interval and Responder are already in Recharts.
   - Case view in Recharts: `VisusCrtChart.tsx`, `CaseDetailPage.tsx:332-481`, `chartTheme.ts:18-33`.
   - Compare selection: drawer (`CohortCompareDrawer.tsx`) vs. case-view `<select>` (`PatientHeader.tsx:217-232`).
   - Palette: `palette.ts:37-42`. `DARK_COHORT_PALETTES` is unused.
   - Container smoke check: `scripts/container-smoke.sh:55` asserts the Plotly chunk (opened).
2. **Root cause as observed:**
   - Two chart libraries with different tooltip, legend and axis styles.
   - Compare is reachable only from Verläufe.
   - Two different selection UIs (drawer vs. select).
   - Different axis and median labels: the case view uses "Visus" with domain [0,1] decimal and "CRT (µm)"; the trajectories use "Visus (logMAR)" and "Netzhautdicke (µm)".
3. **Proposed change** (the team has prescribed the library choice in the feature header):
   - Replace the Plotly trajectory panels with a Recharts component (new `src/components/outcomes/TrajectoryChart.tsx`, reusing `chartTheme.ts`) and remove Plotly (`PlotlyChart.tsx`, `plotlyTraces.ts`, `plotlyRenderable.ts`, `package.json`).
   - Add a "Kohorten vergleichen" button and the shared selection panel to Aggregiert (`AnalysisPage.tsx`), extending compare to its charts (scope: Q17).
   - Generalise `CohortCompareDrawer.tsx` (props `maxSelections`, `optionsFilter`) and use it in the case view (`CaseDetailPage.tsx`/`PatientHeader.tsx`) with exactly one comparison cohort.
   - Unify the labels ("Visus (logMAR)", "Netzhautdicke (µm)", "Kohorten-Median CRT", tooltip "<Bezeichnung>: <Wert>", options "<Name> (N=<n> Patient:innen)") in `translations.ts`, and use the cohort palette with its dark variant in both tabs.
   - Performance for "Alle Patienten" with individual curves (≤ 2 s per toggle) needs decimation or a cap. That contradicts TRAJ-021 (C8).
4. **Regression risk** (largest in this cycle)
   - REG `src/components/outcomes/ src/pages/AnalysisPage.tsx src/pages/CaseDetailPage.tsx src/components/case-detail/ scripts/container-smoke.sh package.json`.
   - **Conflicts (C8, C11, C15):**
     - UIR-TRAJ-008 (`TRAJ.yaml:178`): zoom/pan/lasso "via the Plotly modebar".
     - UIR-TRAJ-021 (`TRAJ.yaml:479`): "full point cloud via WebGL (no 1,500-point cap)". Its expect (`TRAJ.yaml:500`) asks for responsiveness within ~1 s, stricter than the 2 s of P23.
     - UIR-TRAJ-022 (WebGL contexts, via Explore).
     - UIR-DEPLOY-014 (`DEPLOY.yaml:298`): "WebGL canvases … via the strict Plotly bundle".
     - `container-smoke.sh:55`, one of the 18 container checks.
     - UIR-TRAJ-031 (`TRAJ.yaml:719`): "(N=<n> patients)".
     - UIR-CASE-013 (`CASE.yaml:240`): selection via the select "Vergleichskohorte wählen".
     - UIR-CASE-012 (`CASE.yaml:215`, via Explore): checkbox "Kohorten-Referenz anzeigen".
     - UIR-CASE-034 expect (`CASE.yaml:689`, via Explore): 'Kohorten-Median Änderung'.
     - Aggregiert tooltips in Recharts default format "Fälle : <N>" (`AGG.yaml:272`) and similar (`:311, :330, :350`, via Explore) vs. "<Bezeichnung>: <Wert>".
   - Mapped Vitest tests that exercise Plotly (`tests/OutcomesPanelScatterCap.test.tsx`, `plotlyTracesHover.test.ts`, `plotlyDrillDownGate.test.ts`, `OutcomesPanelHoverTooltip.test.tsx`, `OutcomesPanelLineClick.test.tsx`, `OutcomesPanelDrillDown.test.tsx`, `OutcomesPanel.test.tsx`, `OutcomesPage.test.tsx`, `OutcomesPerfI2.test.tsx`, `OutcomesPerfA6.test.tsx`; via Explore) would lose their subject or go red.
   - Under the rule "never delete, skip or weaken a test", the migration **cannot be completed without a team decision** on these tests (C8).
   - EMDREQ: none mandates a library or a performance limit (scan of `Pflichtenheft.md`/`Lastenheft.md` for plotly|recharts|bibliothek|performance|sekunde, via Explore). EMDREQ-ANL-002/-003 and EMDREQ-FALL-006 (`Pflichtenheft.md:713-714`, via Explore) are supported.
5. **Test approach:** Playwright `Z0-P23.spec.ts`, 12 scenarios (2 `@visual` go to the browser pass).
   - Legend colours via `getComputedStyle` of the swatches.
   - Series counts via Recharts DOM (`.recharts-line`, `.recharts-scatter`) plus `data-series` hooks.
   - Performance: `performance.now()` around the click until the DOM state changes, against the "Alle Patienten" cohort.
   - Vitest for the generalised drawer (`maxSelections=1`).
6. **Size and dependencies:** **L** (probably several commit series within the one-problem session). Depends on: C8, C11, C15, Q17, Q18, P05. P03, P07, P08, P12, P20, P21 and P26 build on it.

## Z0-P24
1. **Location**
   - `QualityCaseDetail.tsx:289-331` (via Explore): row buttons "Bestätigen" with `title="Bestätigen"` and `aria-label="Bestätigen <param> <date>"`.
   - `QualityCaseDetail.tsx:400-412`: "Von Analysen ausschließen" without title or description.
   - Server storage is per user (`server/dataApi.ts:1-6`, `server/dataDb.ts:44-80`, via Explore). Source data is untouched (`server/fhirApi.ts` is GET-only, via Explore).
2. **Root cause as observed:** neither the effect nor the per-user scope is explained. The tooltip texts can be stated as substantiated: storage is per user, and no FHIR write happens.
3. **Proposed change:**
   - Add an explanatory tooltip with keyboard focus and `aria-describedby` to both actions in `QualityCaseDetail.tsx`:
     - Bestätigen: "Markiert diesen Messwert als geprüft und korrekt. Die Markierung gilt nur für Ihr Benutzerkonto. Die Daten im Quellsystem werden nicht verändert."
     - Ausschließen: "Dieser Fall wird in Ihren Kohortenanalysen nicht mehr berücksichtigt. Gilt nur für Ihr Benutzerkonto; jederzeit rückgängig über „In Analysen einschließen“."
     - EN equivalents with "applies to your user account only".
   - Mechanism: a custom tooltip (new primitive or an extension of `InfoTooltip.tsx`) or a replacement of the native `title`. See C16, because of AT-SYS-RB.
4. **Regression risk**
   - REG `src/components/quality/QualityCaseDetail.tsx src/components/primitives/InfoTooltip.tsx src/i18n/translations.ts`.
   - **Conflicts (C16):**
     - UIR-QUAL-026 expect (`QUAL.yaml:610`): "Hover shows the tooltip \"Bestätigen\"".
     - **AT-SYS-RB-001-01** (`sysrb.spec.ts:39-40`): every `title` of a `tbody button` must be exactly 'Bestätigen', 'Fehler melden' or 'Zurücksetzen'. A changed `title` makes it **fail**. A custom tooltip that keeps `title="Bestätigen"` does not, but then the native tooltip shows "Bestätigen" alongside the custom one.
     - The `aria-label` "Bestätigen <param> <date>" must stay a prefix "Bestätigen", for `qual.spec.ts:105, 208, 294` `getByRole('button',{name:/^Bestätigen/})` (via Explore).
   - At risk:
     - `InfoTooltip` users across the app, if the primitive itself changes;
     - UIR-QUAL-019, mapped to `tests/dataDb.test.ts`;
     - UIR-QUAL-036 (per-user, consistent).
5. **Test approach:** Playwright `Z0-P24.spec.ts`: hover, then the visible tooltip text; focus via `Tab`/`.focus()`, then the accessible description contains "gilt nur für Ihr Benutzerkonto". EN variant included.
6. **Size and dependencies:** S–M. Depends on: C16.

## Z0-P25
1. **Location:** `QualityCaseList.tsx:82-97` (via Explore): AB `bg-red-100 text-red-700`, UB `bg-amber-100 text-amber-700`, title only "<n> Tage ohne Behandlung", no dark-mode classes.
   - "auffällig" pill `bg-amber-50 text-amber-600` (`QualityCaseDetail.tsx:268-273`).
   - "Kritisch" is not on the Quality page. It appears as the red CRT threshold label in the case view and as a red pill in `PatientHeader.tsx:198-205` (via Explore).
2. **Root cause as observed:** the therapy-status badges share the amber/red family with the value status. Confirmed.
3. **Proposed change:**
   - Give AB/UB their own colour family (with dark variants) in `QualityCaseList.tsx` (and in `QualityCaseDetail.tsx` if the badge appears in the panel), distinct from amber/red and from each other.
   - Add a tooltip and `aria-label` "Therapieabbrecher"/"Therapieunterbrecher" (EN "Therapy discontinuer"/"Therapy interrupter", existing keys `therapyBreaker`/`therapyInterrupter`), keeping the gap-days text.
   - Concrete colours: Q19.
   - Scenario 1 compares with "Kritisch", which is not shown on the Quality page. The test compares against the class family used for "Kritisch" elsewhere (red), see Q19.
4. **Regression risk**
   - REG `src/components/quality/QualityCaseList.tsx src/components/quality/QualityCaseDetail.tsx`.
   - **Conflicts (C17):** UIR-QUAL-011 statement (`QUAL.yaml:264`): "UB badge, yellow … AB badge, red". Its expect (`QUAL.yaml:277`): "UB is amber/yellow and AB is red". UIR-QUAL-010 expect (`QUAL.yaml:259`, via Explore): "red AB badge".
   - AT-QUAL-010-01 (`qual.spec.ts:312-327`, via Explore) reads only the badge text, so it is not affected.
   - UIR-THEME entries apply to the dark-mode contrast (`tests/outcomesPalette.contrast.test.ts` pattern).
5. **Test approach:** Playwright `Z0-P25.spec.ts`: computed `background-color` of the AB/UB badges vs. the "auffällig" pill and a red reference; `title`/`aria-label`. The `@visual` scenario goes to the browser pass.
6. **Size and dependencies:** S. Depends on: C17, Q19.

## Z0-P26
1. **Location:** as P05 and P23 (Aggregiert compare, `AnalysisPage.tsx:410-542`), and the case-view "Alle Patienten" count `CaseDetailPage.tsx:87-102` (N = `cases.length`, including excluded cases; via Explore).
2. **Root cause as observed:** Aggregiert has no compare entry point and no base-population option (see P05/P23).
3. **Proposed change:**
   - Once P05 and P23 are in place, the Aggregiert drawer lists "Alle Patienten" first and preselected. The legend shows both cohorts with patient counts, and the diagnosis chart shows two cohorts.
   - The "Alle Patienten" count must be computed by one shared function for the drawer and the case-view selector (new helper in `shared/`, D-01).
   - Definition (accessible cases with or without the user's exclusions; patients or cases): C5/Q6.
4. **Regression risk:** as P05 and P23. At risk: UIR-AGG-016 (`tests/AnalysisPage.test.tsx` "cross-mode: …") and UIR-CASE-013/-014 (`CASE.yaml:240, 263`) if the case-view count changes.
5. **Test approach:** Playwright `Z0-P26.spec.ts`: the drawer in Aggregiert, the legend texts, the count of `[data-testid=compare-diagnosis]` pies, and an equality check of the N with the case-view option text "Alle Patienten (N=…)".
6. **Size and dependencies:** S (after P05 and P23). Depends on: P05, P23, C5, Q6.

---

## Order
1. **P01, P02.** Independent, small (Kohortenbildung) and a quick start.
2. **P04, then P10.** Shared root cause (`?filter=` vs `?filters=`). This is the precondition for every Verläufe test with a filtered cohort.
3. **P17, then P22.** Severity 5. They use the cohort resolution from P04. P22 needs the "Alle Patienten" representation, so P05 should come before P22 or be decided in the same way (Q6).
4. **P05.** Base population in the drawer, the precondition for P22 scenario 4, P23 and P26.
5. **P06.** Settings persistence. Independent of the renderer, but it touches the same hook as P04/P05, so do it after them.
6. **P23** (if C8 = migrate). Do the renderer and selection consolidation **before** the chart detail fixes. Otherwise P03, P07, P08, P12, P20 and P21 would be built twice (Plotly, then Recharts), and their Playwright selectors would break with the renderer change.
7. **P26.** Base population in Aggregiert (needs P05 and P23).
8. **P07, P03, P08, P20, P21.** Chart details on the new renderer; P20 comes before P21 (shared tooltip).
9. **P09, then P12.** Critical-values list, then highlighting (shared predicate).
10. **P19, P13, P11.** Raw-data links, hint, help. The help text describes the final functions, so it comes last.
11. **P15, P14.** Case view and Datenqualität entry point (P14 after P23 because of C11).
12. **P24, P25, P16.** Datenqualität. P16 restructures the filter area last, because it also touches the list.
13. **P18.** Global search. Independent, at the end because it touches `Layout.tsx`.

If C8 is answered "no migration", the chart fixes move to step 6 on Plotly. P23 then shrinks to compare in Aggregiert plus unified labels and selection.

## Conflicts
- **C1:** P01 vs. registry note UIR-COH-006 (`COH.yaml:124`, "Default upper bound when only Min is set is 120") and evidence `COH.yaml:114`. The note becomes untrue. Should the registry entry be amended in this cycle (by the study team or in `/useavibe-release`)?
  Answer: amend
- **C2:** P02 vs. UIR-COH-035 statement (`COH.yaml:713`) and UIR-COH-041 expect (`COH.yaml:866`), both naming "Ausführen", and **AT-KOH-003-02** (`koh.spec.ts:44`, `getByTitle('Ausführen')`). The AT case fails after the rename. Options:
  (a) the team amends the AT selector and the registry wording;
  (b) keep `title="Ausführen"` and put the new text only in `aria-label` plus a custom tooltip. This contradicts the P02 scenario "hovering that button shows the tooltip …" only if a native title is shown at the same time.
  Answer:a)
- **C3:** P03 vs. UIR-TRAJ-007 statement (`TRAJ.yaml:159`, old axis titles), UIR-TRAJ-001 expect (`TRAJ.yaml:40`, "'Δ µm'"), UIR-TRAJ-006 expect (`TRAJ.yaml:155`) and UIR-TRAJ-010 expect (`TRAJ.yaml:241`). Should these be superseded by the P03 titles?
  Answer:yes
- **C4:** P04/P17 vs. UIR-TRAJ-042 statement (`TRAJ.yaml:953`, heading "Outcomes: <name>", subtitle "Ad-hoc-Filter · <n> Patient:innen") and UIR-AGG-004 expect (`AGG.yaml:101`, "no name line" without a cohort). The mapped test `tests/AnalysisPage.test.tsx` :: "no ?cohort= and no ?filters=: no cohort name line rendered" **would go red** with "Aktive Kohorte: Alle Patienten". Under the iteration rules that is a stop condition. Does the team supersede UIR-AGG-004/UIR-TRAJ-042, and does it release this test for amendment?
  Answer: amend
- **C5:** Within Z0, the counting unit. P04 (scenarios 1-3) and P22 scenario 3 compare **cases** ("Fälle in der aktuellen Kohorte"). P10 scenario 1, P22 scenario 2 and P05 scenario 1 compare **patients**. Today the header counts cases and Verläufe labels the case count "Patient:innen". Per GLOSSARY/CLAUDE.md, "patients ≠ cases". Both comparisons can only hold if (a) the header shows both counts ("n Patient:innen · m Fälle"), or (b) patients = cases in the synthetic data (not verified). Which display does the team want?
  Answer: a)
- **C6:** P05/P26 vs. UIR-COH-042 expect (`COH.yaml:898`, split flow: "both sub-cohorts ticked and \"P\" unticked") and UIR-TRAJ-031 expect (`TRAJ.yaml:719`, "Rows read '<Name> (N=<n> patients)'"). Should "Alle Patienten" also be preselected in the split flow (`?compare=open` from the split dialog), and does it count toward the cap of 4?
  Answer: not needed to pre-select, but should be an option; It does count.
- **C7:** P06 vs. UIR-TRAJ-020 statement (`TRAJ.yaml:452`, "persists … per cohort"), UIR-TRAJ-019 notes (`TRAJ.yaml:449`) and UIR-TRAJ-001 expect (`TRAJ.yaml:40`, "a metric switch resets to Δ/days"). The mapped test `tests/outcomesViewStatePersist.test.ts` :: "keys state PER cohort (one cohort does not see another cohort state)" **would go red**. Does the team supersede UIR-TRAJ-020 and release that test?
  Answer: yes
- **C8:** P23 (Recharts for all analysis charts, prescribed by the team in the feature header) vs.:
  - UIR-TRAJ-008 (`TRAJ.yaml:178`, Plotly modebar zoom/pan/lasso);
  - UIR-TRAJ-021 (`TRAJ.yaml:479`, WebGL full point cloud without cap; expect `:500` about 1 s);
  - UIR-TRAJ-022 (WebGL contexts);
  - UIR-DEPLOY-014 (`DEPLOY.yaml:298`, strict Plotly bundle under CSP);
  - container check `scripts/container-smoke.sh:55`;
  - about ten mapped Vitest files that exercise Plotly (listed under P23).

  Recharts renders SVG without WebGL, so a full point cloud of "Alle Patienten" within 2 s is not realistic without decimation (reasoned assessment, unmeasured).

  Decisions needed:
  (a) Are these UIRs superseded, and is zoom/pan/lasso dropped?
  (b) Is a point cap or decimation for scatter and per-patient curves acceptable (number)?
  (c) May the Plotly-specific tests and the smoke check be replaced by Recharts equivalents? Without release this is a "weaken/delete" case.
  (d) Is 2 s (P23) or about 1 s (UIR-TRAJ-021) the binding performance limit?
  Answer: a) can't we zoom or pan in recharts? otherwise, yes, dropped; b) no c) yes; d) 1 s then.
- **C9:** P08/P20 vs. UIR-TRAJ-024 expect (`TRAJ.yaml:561`, "hovering the median line shows only Plotly's small 'Median' label") and UIR-TRAJ-023 expect (`TRAJ.yaml:539`, three-line tooltip "logMAR: <value> …"). Should they be superseded?
  Answer: yes
- **C10:** P14 vs. UIR-CASE-002 step (`CASE.yaml:41`, button "in the action row under the panel's header strip") and AT-QUAL-006-01 (`qual.spec.ts:220`, `getByRole('button', { name: 'Vollständige Fallansicht' })`, strict). A second button with the same name makes the AT case fail; moving the existing one does not. See Q13.
  Answer: the button should be replaced, not added -> move;
- **C11:** Within Z0, the comparison control in the case view.
  - P23 scenarios "Gleiche Kohortenauswahl …" and "Einzelfallansicht nutzt dieselbe Auswahl …" require a button "Kohorten vergleichen" with the shared panel.
  - P14 scenario 3 and P26 scenario 3 require a selector "Vergleichskohorte wählen".
  - P15 scenario 2 requires the checkbox "Kohorten-Referenz anzeigen".
  - Registry: UIR-CASE-013 (`CASE.yaml:240`) and UIR-CASE-012 (`CASE.yaml:215`, via Explore) describe the current select and checkbox.

  Options:
  (a) Button "Kohorten vergleichen" opens the panel, whose radio group is labelled "Vergleichskohorte wählen", and the checkbox stays. All scenarios hold; CASE-013 is amended.
  (b) Another combination.

  Also: P14 scenario 3 requires the selector to be visible for the first case. Today it is hidden when no saved cohort contains the case. Should it always be shown?
  Answer: it should look the same and open a visually similar or analogous dialog in an analog position; however, it does not need to be the exact same button and dialog, as the functionality differs (slightly). it should be shown and have the option of the Grundgesamtheit only then.
- **C12:** P15 title "(erste Visite)" vs. UIR-CASE-038 statement (`CASE.yaml:751`: Visus anchored to the first Visus measurement, CRT to the first CRT measurement) and UIR-CASE-037 (`CASE.yaml:732`, old title). If the first CRT is measured after the first visit, the title misdescribes the CRT curve. Options:
  (a) keep the scenario text;
  (b) change the title to "… zum Ausgangswert (jeweils erste Messung)". That requires amending the frozen scenario, which only the team can do.
  Answer: b)
- **C13:** P16 vs. UIR-QUAL-001 step (`QUAL.yaml:30`, "Kohorte" left of "CSV exportieren"), UIR-QUAL-006 step (`QUAL.yaml:173`, funnel `title="Filterkriterien"`), UIR-QUAL-012 (auto-open, mapped test `tests/qualityPageDeepLink.test.tsx`), and AT helpers `qual.spec.ts:67-71` (`getByTitle('Filterkriterien')`) and `:56`. If the region is always visible and the funnel toggle disappears, `openFilters` in AT-QUAL-001/003/006/007 fails, and the mapped test about "auto-opens" loses its subject. Should the toggle be kept, or do the AT helper and the UIRs get amended?
  Answer: see question answer, not always visible; is that fine for the AT?
- **C14:** P21 scenario "Kurve beim Überfahren hervorheben" vs. UIR-TRAJ-027 expect (`TRAJ.yaml:617`, "Step 2: no line thickening and no tooltip" between visits). Should UIR-TRAJ-027 be superseded?
  Answer: yes
- **C15:** P23 labels vs. registry:
  - UIR-TRAJ-031 (`TRAJ.yaml:719`, "(N=<n> patients)") vs. "(N=<n> Patient:innen)";
  - UIR-CASE-034 expect (`CASE.yaml:689`, via Explore, 'Kohorten-Median Änderung') vs. unified median naming;
  - Aggregiert expects in Recharts default format "Fälle : <N>" (`AGG.yaml:272`, likewise `:311, :330, :350`, via Explore) vs. "<Bezeichnung>: <Wert>".

  Should they be superseded?
  Answer: yes
- **C16:** P24 vs. UIR-QUAL-026 expect (`QUAL.yaml:610`, tooltip "Bestätigen") and **AT-SYS-RB-001-01** (`sysrb.spec.ts:39-40`: every row-button `title` must be exactly 'Bestätigen' | 'Fehler melden' | 'Zurücksetzen'). Options:
  (a) Keep `title="Bestätigen"` and show the explanation in a custom tooltip plus `aria-describedby`. The AT stays green; the native tooltip appears as well.
  (b) Replace the `title` and have the team amend the AT check and the UIR.
  Answer: a)
- **C17:** P25 vs. UIR-QUAL-011 statement (`QUAL.yaml:264`, "UB badge, yellow … AB badge, red"), its expect (`QUAL.yaml:277`) and UIR-QUAL-010 expect (`QUAL.yaml:259`, via Explore, "red AB badge"). Should they be superseded with the new colours?
  Answer: yes

## Open questions
- **Q1 (P01):** Wording of the filter summary (cohort name "Gefilterte Kohorte · …" and saved-search summary) for open bounds. Options: "Alter ≥ 70" / "Alter ≤ 60", or "Alter 70–" / "Alter –60". EN "Age ≥ 70". The summary is currently hard-coded in German (`cohortFilterSerialization.ts:89-90`); should it become i18n in passing?
  Answer: use the first option, do the passing
- **Q2 (P02):** Where is the loaded cohort name shown? Options: (a) status line "Geladene Kohorte: <Name>" above the filters, which disappears on the next filter change; (b) pre-filled save-name input; (c) both.
  Answer: a)
- **Q3 (P03):** (a) Info icon text. Proposal: "Ausgangswert = erste Messung der jeweiligen Kennzahl je Auge. Δ zeigt die Differenz, Δ % die prozentuale Änderung zum Ausgangswert." / EN "Baseline = first measurement of the metric per eye. Δ shows the difference, Δ % the percent change from baseline." This must match how the code defines baseline: per patient, eye and first measurement (not verified in this plan; to be checked in the P03 session). (b) Visus Δ% title "Visus-Veränderung zum Ausgangswert (%)": OK?
  Answer:ok
- **Q4 (P04/P17):** Wording of the Verläufe heading after the fix. Options: (a) "Outcomes: <Kohortenname|Gefilterte Kohorte>"; (b) the active cohort only in the shared header, with Verläufe keeping only "n Patient:innen". Does "Aktive Kohorte: …" replace the blue name line, or come in addition to it?
  Answer: replace, must be very universal across views.
- **Q5 (P04):** Should the "Zentren" narrowing in the analysis header (`AnalysisPage.tsx:209-217`) also apply to Verläufe? It shares the root cause, and without it header count and Verläufe count diverge as soon as centres are narrowed.
  Answer: yes.
- **Q6 (P05/P26/P22):** Definition of "Alle Patienten":
  (a) all accessible cases including the user's exclusions (as in today's case view, `cases`), or `activeCases` without exclusions;
  (b) is N the number of patients or of cases, in the label "(N=<n> Patient:innen)";
  (c) "preselected on first opening": once per session, or each time the drawer opens without a comparison?
  Answer: Eingeschlossene N / Aktive M?
- **Q7 (P06):** Scope of the session settings:
  (a) which ones (x-axis, y-mode, layers, grid points, centre selection?);
  (b) should they also survive a metric-tab switch (today's reset to Δ/days, UIR-TRAJ-001)?
  (c) do explicit choices override the size-dependent defaults (per-patient/scatter off above 100 patients, UIR-TRAJ-018) for large cohorts?
  Answer: b)
- **Q8 (P08):** In axis mode "Anzahl Behandlungen", should the grid slider (20–300 Stützstellen) be hidden or disabled because the grid is fixed to integers, or only take effect in time mode?
  Answer: hidden / deactivated with hint
- **Q9 (P09):**
  (a) List form: dialog, popover or side drawer?
  (b) Sorting: highest CRT descending, or pseudonym?
  (c) Threshold from `config/settings.yaml` (`crtImplausibleThresholdUm`) instead of hard-coded 400?
  (d) In compare mode: list only the base cohort (as the count does today), or per cohort?
  Answer: a) chose yourself, but the user should be able to open those cases in case view; b) yes; c) per cohort
- **Q10 (P11):** Approve the help text (DE/EN). Proposal: four short sections, "Einzelfallansicht öffnen" (click a curve or measurement point, or a pseudonym in "Rohdaten anzeigen"), "Kohorten vergleichen", "Diagramm-Anzeige" and "Rohdaten anzeigen". The team supplies or approves the final wording.
  Answer: do the wording; otherwise fine.
- **Q11 (P12):**
  (a) The scenario requires "as many highlighted curves as the number before 'Fälle mit kritischen Werten'". The count is per case, curves are per patient. Count curves per case (eye), or change the count to patients?
  (b) Also in compare mode?
  (c) Highlight colour: red, which collides with the OS eye colour `#b91c1c` (`palette.ts`, via Explore), or another colour?
  Answer: a) highlight the measurements from the cases; b) yes; c) use another colour for the eye colour (see unifying diagrams between views)
- **Q12 (P02/P13/P20/P21):**
  (a) Tooltip mechanism app-wide: native `title`, or a custom tooltip that is also visible on keyboard focus (relevant for P24 scenario 3)?
  (b) Drill-down is currently disabled in compare mode (`VisusMetricContainer.tsx:107`). Should hint, cursor and click (P13/P20/P21) also work in compare mode, or should the hint state that clicks only work in single view?
  Answer: a) why keyboard focus? If needed, use for all; b) decide yourself, I cannot tell how well that would work for compare mode. If its to busy / not usable, make it compare mode only with the hint.
- **Q13 (P14):** Move the existing "Vollständige Fallansicht" button into the header row (recommended because of AT-QUAL-006-01, C10), or add a second one? Where does the hint text go: below the header, or as a tooltip only?
  Answer: header row
- **Q14 (P16):**
  (a) Should Zentrum and "Ausgeschlossene anzeigen" also go into the region "Filterkriterien"? The scenario lists five controls; "no filter control … outside" implies yes.
  (b) Is the region always visible, or collapsible (C13)?
  (c) "Alle Fälle" (Datenqualität) vs. "Alle Patienten" (analysis, case view): align the naming?
  Answer: a) yes; b) collapsible; c) align naming to correct.
- **Q15 (P18/P19):**
  (a) A pseudonym belongs to a patient, who may have several cases (laterality/visits). Which case opens: the first, the most recent, or should the choice be offered (e.g. "PSN · OD")?
  (b) P18 matching: prefix or substring; how many suggestions at most?
  (c) Should the search be logged in the audit log (data-access logging, EMDREQ-USM?)? Not checked in this plan.
  Answer: a) currently all cases are displayed by timestamped data (implicit), right? maybe make it easier to look at the data by showing case-wise, newest first with pages per case? b) substring; all matching with match score descending; c) yes 
- **Q16 (P22):** Options of the selector "Kohorte wählen":
  (a) should the current unsaved "Gefilterte Kohorte" appear as an entry;
  (b) sorting of saved cohorts (name or creation date), consistent with the P23 scenario "options are sorted the same way in all 3 views";
  (c) should sub-cohorts be indented as in the drawer?
  Answer: a) yes somthing like "Aktive Kohorte"?; b) by name, sub-cohorts must be recognizable as such.
- **Q17 (P23):** Compare scope in Aggregiert: the scenario requires the diagnosis and age-vs-visus charts. Should the centre distribution, visus over time and CRT distribution also show compare series, or be hidden in compare mode?
  Answer: also show compares (also possible for histograms or bar plots like in patient view)
- **Q18 (P23):** "The same quantity uses the same colour in all three views". Which colour does Visus or CRT get in the case view (today green/violet tones) vs. the eye colours OD/OS in Verläufe? Does the team specify a reference palette, or approve a proposal?
  Answer: keep case view colours
- **Q19 (P25):** Colours for AB/UB. Proposal: AB slate/grey (`bg-slate-200 text-slate-800`), UB sky/blue (`bg-sky-100 text-sky-800`), with dark variants; both distinct from amber (auffällig) and red (kritisch). Note that blue is close to the OD colour in Verläufe. Is "Kritisch" on the Quality page meant as the red family (it is not rendered there)?
  Answer: fine.

### Follow-up questions (round 2, 2026-11-18)
- **Q20 (C6 → P05/P26):** "not needed to pre-select, but should be an option" contradicts the frozen scenarios Z0-P05 "Grundgesamtheit ist beim ersten Öffnen vorausgewählt" and Z0-P26 "Grundgesamtheit als erste Vergleichsoption" ("the option … is selected"). Options: (a) the answer applies only to the split flow (`?compare=open` from the split dialog), and "Alle Patienten" is preselected everywhere else as the scenarios require; (b) no preselection anywhere, in which case the team must amend both frozen features.
  Answer: a)
- **Q21 (C8 → P23):** (a) Recharts has no built-in zoom, pan or lasso. It offers a `Brush` (x-range slider) and a documented drag-to-zoom pattern with `ReferenceArea` (from training knowledge, not verified in this session). Is drag-zoom plus `Brush` an acceptable replacement, with pan and lasso dropped? (b) Full point cloud without a cap and ≤ 1 s per toggle for "Alle Patienten" with individual curves is probably not achievable in SVG (reasoned estimate, unmeasured). Fallback if the P23 session measures more than 1 s: (i) decimate only the individual curves and scatter points, keeping the median and IQR exact; (ii) relax the limit to 2 s, as in the P23 scenario; (iii) stop and report under Blocked.
  Answer: a) that is fine; b) test it, if it doesnt work -> fallback to 2s; if that doesnt work -> fallback back to plotly (1s)
- **Q22 (C11 → P23/P14/P26):** The answer ("analogous, not the exact same panel") differs from the P23 scenario step "the same selection panel as on Verläufe opens". May the P23 test check that step as an analogous panel: button label "Kohorten vergleichen", same position and look, "Alle Patienten" first, exactly one selectable comparison cohort (radio), heading "Vergleichskohorte wählen"? That heading would also satisfy P14 scenario 3 and P26 scenario 3.
  Answer: yes
- **Q23 (Q6 → P05/P22/P26):** "Eingeschlossene N / Aktive M?" Does this mean the "Alle Patienten" option shows both counts: N = all accessible cases, M = without the user's own exclusions ("Von Analysen ausschließen")? Which of the two is the cohort that is actually compared? Which goes into the label format "(N=<n> Patient:innen)" required by P23? Exact wording DE/EN?
  Answer: Only show the cases that were not excluded then. But number of excluded cases should be visible somewhere; compare the included (excluded from the analysis means of course also exclusion from comparison)
- **Q24 (Q7 → P06):** The answer "b)" covers one of three sub-questions. (a) Which settings are kept for the session: x-axis, y-mode, layers, grid points, centre selection? (b) Should they also survive a switch between metric tabs (Visus ↔ CRT)? Note that the y-mode options differ per metric. (c) Do explicit user choices override the size-dependent defaults for large cohorts (individual curves and scatter off above 100 patients, UIR-TRAJ-018)?
  Answer: a) all, b) yes, c) yes
- **Q25 (Q14c → P16/P17/P22):** "align naming to correct". In Datenqualität the list shows cases, so "Alle Fälle" is correct there. In the analysis, "Alle Patienten" is what the scenarios require. Since one case is one FHIR Patient in the code (`shared/patientCases.ts:94`, `id: pat.id`), both counts are the same. Options: (a) keep "Alle Fälle" in Datenqualität and "Alle Patienten" in the analysis and case view; (b) use "Alle Patienten" everywhere, which breaks the AT helper `qual.spec.ts:56` (cohort select found by option "Alle Fälle") and needs an AT amendment like C2.
  Answer: a)
- **Q26 (Q16a → P22):** Label of the unsaved filtered cohort in "Kohorte wählen". "Aktive Kohorte" is already the header prefix from P17. Options: (a) "Gefilterte Kohorte · <Filterzusammenfassung>", as in the header; (b) "Aktuelle Filterauswahl"; (c) other.
  Answer: a)
- **Q27 (Q4 → P04/P17):** Reading of "replace, must be very universal across views": the line "Aktive Kohorte: …" replaces the blue name line, and the Verläufe heading names the cohort with the same text and the same formatting function, as required by P04 scenario 1. "Outcomes: …" and the subtitle "Gespeicherte Kohorte / Ad-hoc-Filter" disappear. Correct?
  Answer: yes
- **Q28 (Q9 → P09):** The answer has three parts for four sub-questions: a) "choose yourself", b) "yes", c) "per cohort". Reading: list form is my choice (a dialog); sorting by highest CRT descending; threshold from `config/settings.yaml` (`crtImplausibleThresholdUm`) instead of hard-coded 400; in compare mode one list per cohort. Correct, or does "b) yes" refer to something else?
  Answer: correct
- **Q29 (C12 → P15):** Option b) ("… zum Ausgangswert (jeweils erste Messung)") requires amending the frozen, read-only `acceptance/Z0/Z0-P15.feature` (scenarios 1–3, DE and EN) and re-freezing it. Who does this, and when (before `/useavibe-fix Z0-P15`)? Proposed EN: "Change in visual acuity and CRT from baseline (first measurement of each)".
  Answer: did it
- **Q30 (Q15a → P18/P19):** Since one case is one Patient (`shared/patientCases.ts:94`), the question "which case opens" does not arise. The suggestion "show data case-wise, newest first, with pages per case" is a new feature outside P18/P19. Options: (a) record it under "Observed, not changed" for a later cycle; (b) put it in scope for Z0, which needs a problem/scenario definition by the team.
  Answer: a)

### Follow-up questions (round 3, 2026-11-19, from the Z0-P23 Blocked report; addendum after approval)
- **Q31 (P23 → UIR-CASE-022/-023):** The P23 scenario "Gleiche Achsenbeschriftung in Verläufe und Einzelfallansicht" requires "Visus (logMAR)" and "Netzhautdicke (µm)" in the case view, which today shows decimal Visus (axis 0–1, "Visus", legend "Visus (Dezimal, bestkorrigiert)", "CRT (µm)"; mapped test `tests/VisusCrtChartLabels.test.tsx`). Elsewhere only Verläufe uses logMAR; Aggregiert, case-view distribution/scatter and the cohort-builder filter are decimal; the data are stored as decimal. Options: Visus/CRT chart of the case view only; whole case view; all charts; keep decimal and amend the feature.
  Answer: Visus/CRT chart of the case view only, converted to logMAR (axis values, tooltip, "Visus Ø", legend). Case-view distribution/scatter, Aggregiert and the filter stay decimal. UIR-CASE-022/-023 are superseded; their mapped tests are released for amendment.
- **Q32 (P23 → UIR-CASE-013):** The case-view `<select>` "Vergleichskohorte wählen" is replaced by the always-visible "Kohorten vergleichen" button with a radio panel (C11, Q22). Are UIR-CASE-013 and the mapped tests `tests/CaseDetailRound7.test.tsx` "N11: renders a selector listing the patient-containing cohorts" / "N11: omits the selector when there is no real choice (single cohort)" superseded and released?
  Answer: yes
### Follow-up questions (round 4, 2026-11-20, from the Z0-P08 Blocked report; addendum after approval)
- **Q33 (P08 → Z0-P23 AT, UIR-TRAJ-024):** The P08 heading "<x-axis label>: <x>" collides with the Z0-P23 acceptance test (`tests/acceptance/Z0/Z0-P23.spec.ts:304`, Verläufe heading `/^Tag -?\d+$/`) and the mapped unit test `tests/OutcomesPanelRecharts.test.tsx:170` (patient tooltip heading 'Tag 10'). Options: (a) new heading only in compare mode; (b) every Verläufe tooltip (median and patient, single and compare, both axis modes), the two assertions released; (c) median tooltip only.
  Answer: b) Every Verläufe tooltip heading reads "Tage seit Baseline: <n>" / "Anzahl Behandlungen: <n>" (EN "Days since baseline: <n>" / "Number of treatments: <n>"). The two assertions are released and replaced by the operator before the fix session (O-49, workaround c): `Z0-P23.spec.ts:304` → `/^Tage seit Baseline: -?\d+$/`, `OutcomesPanelRecharts.test.tsx:170` → 'Tage seit Baseline: 10' (titles unchanged).
- **Q34 (P08 → Z0-P23 AT):** Single-cohort median rows: keep "Kohorten-Median Visus/CRT: …" (`Z0-P23.spec.ts:305`) or switch to "<Kohorte> · Median"?
  Answer: Keep. Without comparison the rows stay "Kohorten-Median Visus/CRT: …"; "<Kohorte> · Median: <Wert> <Einheit>" with the cohort colour applies in compare mode only.
### Follow-up questions (round 5, 2026-11-20, from the Z0-P09 Blocked report; addendum after approval)
- **Q35 (P09 → case view header):** `acceptance/Z0/Z0-P09.feature:24` requires the case view header to show the pseudonym "next to 'Pseudonym'". Today `PatientHeader.tsx:172-174` renders the pseudonym as a bare `<h1>` without a label, and §Z0-P09 limits the change to `AnalysisPage.tsx`/`translations.ts`. Options: (a) add a visible label; (b) amend and re-freeze the feature; (c) read the `<h1>` as the field.
  Answer: a) A small visible caption "Pseudonym" (EN "Pseudonym", existing key `pseudonym`) directly above the `<h1>` in `src/components/case-detail/PatientHeader.tsx`, in every case view. The `<h1>` text stays the bare pseudonym. `PatientHeader.tsx` is added to the P09 location and regression scope (REG `src/components/case-detail/PatientHeader.tsx`).
- **Q36 (P09 → Q28, compare mode):** In compare mode the header count "kritische Werte" covers the base cohort only, while Q28 c asks for one list per cohort.
  Answer: One count per cohort in compare mode; each count opens the list of its own cohort, so count and list always match. Without comparison: one count, one list (as planned).
### Follow-up questions (round 6, 2026-11-20, operator finding after the Z0-P09/Z0-P12 commits; addendum after approval)
- **Q37 (P09/P12 → threshold source):** §Z0-P09 and Q28 named `crtImplausibleThresholdUm` (cohort-builder implausibility limit, `config/settings.yaml:29`, not editable in the UI). The threshold the team meant ("aus den Einstellungen") is the admin-editable "Klinische Schwellenwerte → CRT kritischer Schwellenwert (µm)" = `thresholds.criticalCrtUm` (`config/settings.yaml:10`, `SettingsPage.tsx:679-682`), read via `CRITICAL_CRT_THRESHOLD()` (`src/config/clinicalThresholds.ts`) and already used by the case-view badge/chart and Datenqualität; UIR-AGG-008 requires exactly this. Both default to 400, so all tests pass. Correct it?
  Answer: Yes. A correction session under Z0-P09 switches the count, its label, the dialog list (P09) and the Verläufe highlight (P12) to `thresholds.criticalCrtUm` via `CRITICAL_CRT_THRESHOLD()`; `crtImplausibleThresholdUm` stays the cohort-builder limit. Test first: `tests/acceptance/Z0/Z0-P09.test.tsx` mocks the two settings with different values (e.g. `thresholds.criticalCrtUm` 350, `crtImplausibleThresholdUm` 400) and asserts the count, label and list follow 350; red before, green after. UIR-AGG-008 becomes implemented (operator registry update). This supersedes the threshold line of §Z0-P09 in "Decisions applied".
### Follow-up questions (round 7, 2026-11-20, from the Z0-P13 Blocked report; addendum after approval)
- **Q38 (P13 → feature):** "Testkohorte" has 146 patients, so "Individuelle Kurven" (default off above 100, `useOutcomesRouteState.ts:49,95`) and "Streupunkte" (default off above 30, `shared/cohortTrajectory.ts:228`) are off on first view. Scenario 1 and 3 required the click hint in that state, scenario 2 the "Blenden Sie … ein" text for the same state.
  Answer: The hint follows the actual layer state: with "Individuelle Kurven" or "Streupunkte" shown → "Klicken Sie auf eine Kurve oder einen Messpunkt, um die Einzelfallansicht zu öffnen."; with both hidden (including the default for large cohorts) → "Blenden Sie unter „Diagramm-Anzeige“ individuelle Kurven ein, um einzelne Fälle zu öffnen." The layers remain switchable by hand. The feature was amended by the operator for NF: scenarios 1 and 3 first tick "Individuelle Kurven" / "Per-patient curves"; criteria re-frozen (5d1861c). The Q12 b answer at "Q12 (b)" means "single view only with the hint" (as in "Decisions applied", Z0-P13/P20/P21).
- **Q39 (P13 → compare mode):** Hint text in compare mode, where drill-down from the chart is off (Q12 b)?
  Answer: "Einzelfallansicht nur ohne Kohortenvergleich" / EN "Case view only without cohort comparison", the same text as the P20 tooltip (`outcomesTooltipCompareClickHint`).

### Follow-up questions (round 8, 2026-11-23, from the Z0-P18 Blocked report; addendum after approval)
- **Q40 (P18 → feature):** All 245 synthetic pseudonyms have the form `EM-U<site>-<nnnn>` (`EM-UKA-0…` … `EM-UKT-0…`), so the first 4 characters are always "EM-U". With substring matching (Q15 b), scenario 3 ("a pseudonym of another site", first 4 characters) always matches the restricted user's own cases and can never show "Kein Fall gefunden"; scenario 2 would list all 245 cases.
  Answer: Scenarios 2 and 3 type the first "8" characters (e.g. "EM-UKC-0", which matches no UKA pseudonym). Q15 b (substring, all matches by score descending) stays. The feature was amended by the operator for NF and the criteria re-frozen.
  Side points from the same report, already settled: Q15 a is answered by Q30 a (one case per Patient; the case-wise paged view is out of scope for P18, "Observed, not changed"); Q15 c is in scope (each search is written to the audit log, see "Decisions applied", Z0-P18), although no scenario checks it.

### Follow-up questions (round 9, 2026-11-23, from the /useavibe-release 0 browser pass; addendum after approval)
The release pre-check (step 2e, emd-smoke built from c6edd3b) found deviations caused by the Recharts migration of Z0-P23 (c8d3cbd), class B: D1 unrounded x-axis end tick in Verläufe ("990.3865546218487"); D2 y-axis ticks at odd values ("98,59 / 51,41 / -48,59", CRT Δ µm); D3 individual curves drawn below the x-axis over the tick labels and the Brush (CRT, "Individuelle Kurven"); D4 decimal comma in Verläufe ("-26,71 µm") but decimal point in Aggregiert ("0.290") and the case view ("0.66", "9.8 Monate"). The diagnosis pies (colours by rank, clipped labels) predate Z0 and are not part of this round (backlog / AT defect).
- **Q41 (D1–D3 → Z0-P23 feature):** Add scenarios for rounded axis labels and curves kept inside the plot area?
  Answer: yes, as drafted. Added to acceptance/Z0/Z0-P23.feature: "Achsenbeschriftungen der Verläufe zeigen gerundete Werte" (x ticks of "Tage seit Baseline" whole numbers; y ticks at multiples of 1, 2, 2.5 or 5 × 10^n; at most 2 decimals; CRT Δ µm and Visus) and "Kurven bleiben innerhalb der Diagrammfläche" (@visual; clip curves, points and bands to the plot area). Criteria re-frozen (ed8fea9).
- **Q42 (D4 → Z0-P23 feature):** One number format across Aggregiert, Verläufe and the case view?
  Answer: decimal comma in the German UI everywhere, decimal point in English. Scenario "Einheitliches Zahlenformat in Aggregiert, Verläufe und Einzelfallansicht" added (tooltips and axis tick labels of the charts in the three views; locale-aware formatting, e.g. "0,5" / "0.5"). Numbers outside chart tooltips and axis ticks (e.g. "Visus Ø 0.40" in the case view, `tests/VisusCrtChartLogmar.test.tsx`, not registry-mapped) are not in this scenario; leave them unchanged and list them under "Observed, not changed".
  Fix in a fresh session `/useavibe-fix Z0-P23` (regression of its own fix, not the defect track).

### Follow-up questions (round 10, 2026-11-23, from the second /useavibe-release 0 browser pass; addendum after approval)
The release pre-check (step 2e, emd-smoke built from 4b7b17e) confirmed D1–D4 as fixed but found two gaps against the approved plan and one uncovered case. The frozen scenarios pass in all three, so a fix session would be refused as green before fix without a new scenario:
- D5 (Z0-P04/P17): the Verläufe heading still reads "Outcomes: Testkohorte", and the subtitle "Gespeicherte Kohorte / Ad-hoc-Filter" is still shown (`src/components/outcomes/OutcomesView.tsx:309`), contrary to Q27 and "Decisions applied" (Z0-P04 / Z0-P10). The P04 scenario only checks that the heading contains "Testkohorte".
- D6 (Z0-P26/P23): in the Aggregiert age-vs-visus chart with the default comparison "Testkohorte" vs. "Alle Patienten", all 147 points of the active cohort are hidden under the 245 points of "Alle Patienten". The active cohort is a subset, and its series is drawn first (`src/pages/AnalysisPage.tsx:704-706`). The tooltip does not name the cohort of a point. The scenarios only check that both series exist and are named.
- P17 case: if "Testkohorte" is loaded in Kohortenbildung and "Kohorte analysieren" is clicked without changes, the header reads "Gefilterte Kohorte · Alter ≥ 70" instead of the cohort name. The button always navigates with `?filters=` only (`src/pages/CohortBuilderPage.tsx:1023-1026`). No scenario covers this.
Out-of-scope observations from the same pass are listed under "Observed, not changed".
- **Q43 (D5 → Z0-P04 feature):** Q27 is decided, but no scenario enforces it. Add to `acceptance/Z0/Z0-P04.feature` the scenario "Verläufe-Überschrift nennt die aktive Kohorte wie der Kopf": the Verläufe heading shows exactly the text after "Aktive Kohorte: " in the header (saved name / "Gefilterte Kohorte · …" / "Alle Patienten"), with no "Outcomes:" prefix and no subtitle "Gespeicherte Kohorte / Ad-hoc-Filter", in DE and EN. Fix in a fresh session `/useavibe-fix Z0-P04`. Agree?
  Answer: yes, as proposed (NF, 2026-11-23).
- **Q44 (D6 → Z0-P26 feature):** How should the active cohort stay visible next to "Alle Patienten" in the age-vs-visus chart? Proposal: a) draw the series in descending N (largest at the bottom, subsets on top); b) semi-transparent points; c) the tooltip names the cohort of the point (e.g. "Kohorte: Testkohorte"). New scenario in `acceptance/Z0/Z0-P26.feature` (its own aspect "Grundgesamtheit als Standardvergleich"): "Testkohorte bleibt im Vergleich mit Alle Patienten sichtbar" (@visual for visibility; the tooltip line is checked automatically). Alternative d) compare against "Alle übrigen Patienten" (complement) instead. I advise against d), because it changes the definition of "Alle Patienten" from Q23 and the labels of P05/P26. Fix in a fresh session `/useavibe-fix Z0-P26`. a+b+c, or other?
  Answer: a) only (NF, 2026-11-23): series drawn in descending N, so subsets lie on top. No transparency, no tooltip change. The scenario checks visibility only (@visual).
- **Q45 (P17 case → Z0-P17 feature):** Should a saved cohort that was loaded and analysed without changes keep its name? Proposal: if the current filters equal the loaded saved cohort's filters, "Kohorte analysieren" navigates with `?cohort=<id>`; after any change the header shows "Gefilterte Kohorte · …" as before (Q26 a). New scenario in `acceptance/Z0/Z0-P17.feature`: "Unverändert geladene gespeicherte Kohorte behält ihren Namen". Fix together with Q43 in the same session `/useavibe-fix Z0-P04` (shared formatting of the cohort name), or in a separate session `/useavibe-fix Z0-P17`?
  Answer: as proposed, in one session with Q43 (NF, 2026-11-23). To keep one problem per session, the scenario goes into `acceptance/Z0/Z0-P04.feature` (it also checks the Verläufe heading), not into Z0-P17; fixed in `/useavibe-fix Z0-P04`.
- **Q46 (NF, follow-up in chat → Z0-P23 feature):** An unsaved filtered cohort cannot be compared: the drawer "Kohorten vergleichen" lists only "Alle Patienten" and saved cohorts (`src/components/outcomes/CohortCompareDrawer.tsx:88-147`), and the active cohort becomes the fixed base cohort only when it is opened as a saved cohort (`?cohort=`, `src/pages/AnalysisPage.tsx:239-249`). Q16 a covered only the selector "Kohorte wählen" (Z0-P22). Proposal: when the active cohort is an unsaved filtered cohort, the drawer shows it as "Gefilterte Kohorte · <Filterzusammenfassung>" (same text as the header, Q26 a), marked "Basis-Kohorte (fest)", and it is compared like a saved cohort in Aggregiert and Verläufe. Scenario in `acceptance/Z0/Z0-P23.feature` (selection panel): "Gefilterte, nicht gespeicherte Kohorte lässt sich vergleichen". Add it in Z0, or defer to Z1?
  Answer: add in Z0 as proposed (NF, 2026-11-23). Fixed in a fresh session `/useavibe-fix Z0-P23`.

## Decisions applied from the study team's answers (2026-11-18)
Settled answers are applied here per problem; they take precedence over the option lists in the problem sections above. Items that are still ambiguous are only referenced (Q20–Q30). Registry and AT amendments that the team approved (C1–C4, C7–C10, C14–C17) are made in the fix session of the problem that triggers them, in the same commit series, and named in the commit body. The registry-mapped Vitest tests named in C4 and C7 are released for amendment by those answers. No registry or test file is changed during planning.

- **Z0-P01:** registry note UIR-COH-006 is amended (C1). Summary text "Alter ≥ 70" / "Alter ≤ 60" (EN "Age ≥ 70" / "Age ≤ 60"). The summary becomes i18n in passing (Q1).
- **Z0-P02:** row button renamed. AT-KOH-003-02 (`koh.spec.ts:44`) and UIR-COH-035/-041 are amended to the new label (C2 a). The loaded cohort is shown as the status line "Geladene Kohorte: <Name>" / EN "Loaded cohort: <name>", cleared on the next manual filter change (Q2 a). Tooltip mechanism: one shared, keyboard-accessible tooltip (Q12 a, see P24).
- **Z0-P03:** titles as proposed. UIR-TRAJ-001/-006/-007/-010 are superseded (C3). The info text is approved in principle (Q3). The P03 session verifies the baseline definition in code before writing it.
- **Z0-P04 / Z0-P10:** UIR-TRAJ-042 and UIR-AGG-004 are amended, and the mapped test `tests/AnalysisPage.test.tsx` "no ?cohort= and no ?filters=…" is released for amendment (C4). Centre narrowing applies to Verläufe too (Q5). Counts: header shows patients and cases (C5 a); verified that both are equal in the current data model, since one case is one Patient (`shared/patientCases.ts:94`). The Verläufe heading uses the same "Aktive Kohorte" text, built by the same formatting function as the header; "Outcomes: …" and the subtitle "Gespeicherte Kohorte / Ad-hoc-Filter" are removed (Q27).
- **Z0-P05 / Z0-P26:** "Alle Patienten" is the first option and counts toward the cap of 4 (C6).
  - Preselection: it is preselected as the frozen scenarios require, except in the split flow (`?compare=open` from the split dialog), which keeps today's preselection (Q20 a).
  - Definition: "Alle Patienten" means all accessible cases minus the user's own exclusions (`activeCases`). Cases excluded from analyses are excluded from comparisons too. The label "(N=<n> Patient:innen)" counts only the included cases (Q23).
  - Excluded count: the number of excluded cases is shown next to the counts in the analysis header, e.g. "· 3 ausgeschlossen" / EN "· 3 excluded", only when it is greater than 0. Placement and wording are my choice under Q23 ("visible somewhere").
  - Consistency: the case-view option "Alle Patienten" (`CaseDetailPage.tsx:87-102`) switches from `cases` to `activeCases` to match. This shares the root cause and is required for the P26 scenario 3 equality.
- **Z0-P06:** settings are session-wide, not per cohort. UIR-TRAJ-020/-019/-001 are superseded, and `tests/outcomesViewStatePersist.test.ts` "keys state PER cohort…" is released for amendment (C7). Scope (Q24):
  - All settings are kept for the session: x-axis, y-mode, layers, grid points and centre selection.
  - They survive a switch of metric tab. The y-mode values `absolute|delta|delta_percent` are the same for both metrics.
  - Explicit user choices override the size-dependent defaults (UIR-TRAJ-018).
- **Z0-P07:** unchanged; done on the new renderer (C8: migrate).
- **Z0-P08:** UIR-TRAJ-024 superseded (C9). In treatments mode the grid slider is hidden or disabled, with a hint that the grid is fixed to whole treatment counts (Q8).
- **Z0-P09 (Q9, Q28):**
  - The list is a dialog, and its entries open the case view.
  - Entries are sorted by highest CRT, descending.
  - The threshold comes from `config/settings.yaml` (`crtImplausibleThresholdUm`).
  - In compare mode there is one list per cohort.
- **Z0-P11:** I draft the DE/EN help text in the P11 session; the structure is approved (Q10).
- **Z0-P12:** the measurements of critical cases are highlighted (count per case, consistent with P09). Also in compare mode. The highlight colour is red, so the eye colours of Verläufe change to a non-red scheme as part of the P23 colour unification, keeping the case-view colours (Q11, Q18).
- **Z0-P13 / Z0-P20 / Z0-P21:** drill-down in compare mode is my call (Q12 b). If hint, cursor and line click make the compare view too busy, they stay single-view only, and in compare mode the hint says so. UIR-TRAJ-023 and UIR-TRAJ-027 are superseded (C9, C14).
- **Z0-P14:** the existing "Vollständige Fallansicht" button moves into the header row, so there is no second button and AT-QUAL-006-01 stays green (C10, Q13). The hint text goes below the header row. The case-view comparison control is always shown, offering only "Alle Patienten" when no saved cohort contains the case (C11).
- **Z0-P15:** title with "(jeweils erste Messung)" (C12 b). The team has amended the feature in commit 56dc2be (verified at `acceptance/Z0/Z0-P15.feature:11, 15, 19`), so the title follows that file: DE "Veränderung von Visus und CRT zum Ausgangswert (jeweils erste Messung)", EN "Change in visual acuity and CRT from baseline (first measurement of each)" (Q29).
- **Z0-P16:** Zentrum and "Ausgeschlossene anzeigen" also go into the region "Filterkriterien". The region stays collapsible, and its toggle keeps `title="Filterkriterien"` so `qual.spec.ts:67-71` keeps working (Q14 a/b, C13). Naming: "Alle Fälle" stays in Datenqualität; "Alle Patienten" is used in the analysis and the case view (Q25 a).
- **Z0-P17 / Z0-P22:** "Aktive Kohorte: …" replaces the blue name line (Q4, Q27). Saved cohorts in the selector are sorted by name, with sub-cohorts indented under their parent (Q16 b). The unsaved filtered cohort is included as an option (Q16 a), labelled "Gefilterte Kohorte · <Filterzusammenfassung>", the same text as in the header (Q26 a).
- **Z0-P18:** substring matching; all matches, sorted by match score descending; each search is written to the audit log (Q15 b/c). The case-wise view with pages is out of scope for Z0 and is listed under "Observed, not changed" (Q30 a).
- **Z0-P23:** migrate all analysis charts to Recharts, and remove Plotly together with its smoke check. The Plotly-specific registry entries (UIR-TRAJ-008/-021/-022, UIR-DEPLOY-014) are superseded, and the Plotly-specific tests are replaced by Recharts equivalents (C8 a/c). No point cap (C8 b). Performance limit 1 s (C8 d). Zoom is drag-to-zoom with `ReferenceArea` plus a `Brush`; pan and lasso are dropped (Q21 a).
  Performance is measured in the P23 session with "Alle Patienten", the Visus tab, individual curves on, and IQR toggled (Q21 b):
  - ≤ 1 s: done.
  - > 1 s: accept up to 2 s (the P23 scenario limit).
  - > 2 s: keep Plotly for the trajectory panels with the 1 s limit. In that case the C8 supersessions for UIR-TRAJ-021/-022 and UIR-DEPLOY-014, the removal of the Plotly smoke check and the replacement of the Plotly tests do not apply. The chart fixes P03/P07/P08/P12/P20/P21 are then built on Plotly, and the deviation from the team's library rule is reported in the P23 commit body and in deviations.md.
  Labels per C15. Aggregiert shows comparison series in every chart, including histograms and bar charts, grouped as in the case view (Q17). Colours: keep the case-view colours as the reference (Q18). The case-view panel is analogous rather than identical (Q22): button "Kohorten vergleichen" in the same position and look, heading "Vergleichskohorte wählen", "Alle Patienten" first, exactly one comparison cohort (radio). The P23 test checks these properties.
- **Z0-P24:** keep `title="Bestätigen"`, so AT-SYS-RB-001-01 stays green. The explanation is a keyboard-accessible custom tooltip with `aria-describedby` (C16 a, Q12 a).
- **Z0-P25:** colours as proposed: AB slate, UB sky, with dark variants (Q19). UIR-QUAL-010/-011 amended (C17).

## Observed, not changed
- `CohortBuilderPage.tsx:365-369`: loading a saved search does not re-sync the visus text inputs (`visusMinText`/`visusMaxText`, 182-197), and `flaggedCaseIds` comes back as an array rather than a Set (unverified, via Explore).
- `CohortBuilderPage.tsx:437`: with 0 saved searches the "Gespeicherte Suchen" button does nothing visible.
- `plotlyTraces.ts:291-303`: `layers.median` is ignored in compare mode (median always drawn).
- `palette.ts:65-70`: `DARK_COHORT_PALETTES` is unused, so compare charts use the light palette in dark mode. This becomes relevant in P23 if colours are unified; there it is in scope.
- `OutcomesSettingsDrawer.tsx:90` vs. `useOutcomesRouteState.ts:194`: "Auf Standard zurücksetzen" sets `absolute`, while the initial value is `delta`. Shares P06's root cause only partially; P06 decides via Q7.
- `CaseDetailPage.tsx:390-422`: both median lines in the baseline tooltip carry the same label "Kohorten-Median Änderung", so Visus and CRT are indistinguishable. This will be touched in P23 (unified median naming).
- `QualityCaseList.tsx` / `QualityPage.tsx`: `<label>` elements are not associated with their `<select>`s (`htmlFor` missing); the time-range buttons have no `aria-pressed`.
- `InfoTooltip.tsx`: native `title` only, not visible on keyboard focus (relevant for Q12).
- `CohortCompareDrawer.tsx:72-74`: hard-coded English "patients" in the German UI (fixed in P05 because it is the same row).
- `AnalysisPage.tsx:303-308`: the critical threshold 400 is hard-coded instead of coming from settings. This is fixed in P09 (Q28).
- Team suggestion (Q15a/Q30): a case-wise data view, newest first, with pages per case. Out of scope for Z0; candidate for a later cycle.
- Release pre-check round 10 (browser pass on 4b7b17e), not covered by any Z0 scenario: the case-view x-axis ends at "9,8" (the rounding scenario covers Verläufe only); the case-view tooltip reads "CRT (µm): 622 µm" (unit twice); decimal points in the German UI outside chart tooltips and ticks ("Visusbereich 0.05–0.90", Datenqualität "0.38" and "Sprung > 0.3", see Q42); parameter names in Datenqualität are English in the German UI; the legend of the Aggregiert visus line chart lists the cohorts in reverse order to the main legend.

## Blocked
- Nothing is blocked so far. P04, P06, P17 and P23 cannot be completed without answers to C4, C7 and C8, because registry-mapped tests would go red.
- Update 2026-11-18 (round 2): all items C1–C17 and Q1–Q30 are answered. Nothing is blocked. The only remaining conditional path is the P23 performance fallback (Q21 b), which is decided by measurement in the P23 session.
- Update 2026-11-19 (round 3): the Z0-P23 session blocked on UIR-CASE-022/-023 and UIR-CASE-013 (not covered by C8/C15); answered by NF as Q31/Q32. Released tests in Z0 are amended by the operator outside the session (O-49, workaround c).
- Update 2026-11-20 (round 4): the Z0-P08 session blocked on the tooltip heading vs. the Z0-P23 AT and `OutcomesPanelRecharts.test.tsx`; answered by NF as Q33 (b) / Q34 (keep). The two assertions are replaced by the operator before the session is restarted.
- Update 2026-11-20 (round 5): the Z0-P09 session blocked on the "Pseudonym" label in the case view header (feature line 24) and asked about the compare-mode count; answered by NF as Q35 (a) / Q36 (count per cohort). No test release needed.
- Update 2026-11-20 (round 6): operator found that Z0-P09/Z0-P12 read `crtImplausibleThresholdUm` instead of the editable `thresholds.criticalCrtUm`; NF decided on a correction session under Z0-P09 (Q37).
- Update 2026-11-20 (round 7): the Z0-P13 session blocked on contradictory scenarios for the default state of large cohorts; answered by NF as Q38 (hint follows layer state, feature amended and re-frozen) / Q39 (compare text as P20).
- Update 2026-11-23 (round 8): the Z0-P18 session blocked because all synthetic pseudonyms share the prefix "EM-U", so scenario 3 could not pass with 4 typed characters; answered by NF as Q40 (8 characters in scenarios 2 and 3, feature amended and re-frozen).
- Update 2026-11-23 (round 9): the release pre-check browser pass found Recharts regressions of Z0-P23 (D1–D4); answered by NF as Q41 (rounded axis labels, curves clipped) / Q42 (decimal comma in German everywhere); feature amended and re-frozen, follow-up fix session under Z0-P23.
- Update 2026-11-23 (round 10): the second release pre-check browser pass (4b7b17e) found D5 (Verläufe heading not per Q27), D6 (active cohort hidden under "Alle Patienten" in the age-vs-visus chart) and an unchanged loaded saved cohort shown as "Gefilterte Kohorte"; NF added that an unsaved filtered cohort cannot be compared. Answered by NF as Q43/Q45 (Z0-P04, one session), Q44 a (Z0-P26, drawing order) and Q46 (Z0-P23, filtered cohort as base cohort in the comparison); features amended and re-frozen, follow-up fix sessions under Z0-P26, Z0-P04 and Z0-P23.
