# Phase 29: Home Panel UX - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 29 makes the home (Landing) panel actionable. Two locked requirements:

- **UX-01** — The two static "Attention needed" Review buttons route to the appropriate
  pre-filtered review area via a defined query contract (NOT to a specific case — the alerts
  are static copy, not data-driven flagged-case lists; making them data-driven is explicitly
  out of scope, deferred in the 2026-05-21 adversarial review).
- **UX-02** — A new **client-side** recent-activity store records the last-visited view per
  patient/case and powers the "Jump Back In" panel, which currently renders only an empty
  state (`src/pages/LandingPage.tsx:238-250`). No recent-activity tracking exists anywhere in
  the app today — this is net-new infrastructure, not "UI wiring."

**In scope:** recent-activity store + tracking + Jump Back In rows; deep-link query contracts
for the two attention alerts; query-param read support on the target page.
**Out of scope:** making the "Attention needed" alerts data-driven (real flagged-case counts);
any new backend/API; new persistence beyond browser localStorage.
</domain>

<decisions>
## Implementation Decisions

### Persistence & privacy (UX-02) — DISCUSSED
- **D-01 (key scope):** The recent-activity store is keyed **per-username** in localStorage
  (e.g. `emd-recent:<username>`). On a shared clinical workstation, user A must never see the
  patient/case IDs that user B viewed. Aligns with the project's security-first / least-leakage
  ethos.
- **D-02 (logout):** Recent-activity entries are **cleared on logout**. Safest for shared
  workstations — no residual patient/case trail after sign-out. "Jump Back In" therefore starts
  empty on each fresh login. Wire the clear into the existing logout/sign-out path (coordinate
  with the session teardown from Phases 27–28; cross-tab logout via BroadcastChannel from Phase
  20 should also clear recents).

### UX-01 deep-link targets — DISCUSSED
- **D-03 (therapy-breaker alert):** Routes to **`/quality?therapy=breaker`** (was `/cohort`).
  `QualityPage` already derives `'breaker'` status from `therapyBreakerDays`
  (`src/pages/QualityPage.tsx:43-63`) and has an internal `filterTherapy` control
  (`QualityPage.tsx:142`). Add query-param read support so the link pre-selects the breaker
  filter. One consistent case-review surface, minimal new code.
- **D-04 (implausible-CRT / flagged alert):** Routes to **`/quality?status=flagged`** (was
  `/doc-quality`). `QualityPage` already filters by quality-flag status using `qualityFlags`
  from `DataContext` (`QualityPage.tsx:100-105`). Add query-param read support to pre-select
  flagged cases. Pairs with D-03 for one unified review page.
- **D-05 (query-param contract):** Both contracts are **read on mount** into QualityPage's
  existing filter state (`filterTherapy`, `filterStatus`). Reuse the `useSearchParams` pattern
  already established across the app (`OutcomesView.tsx:83`, `AnalysisPage.tsx:52`,
  `CohortBuilderPage.tsx:551`). No new global routing abstraction.

### Claude's Discretion
- **Recent-record shape (UX-02):** Not separately discussed — planner/researcher decides. Guidance:
  capture enough to **restore the view**, i.e. route path + the view params the existing pages
  already encode in the URL (`?cohort=`, `?filter=`, `?tab=`, `?metric=`, eye selection). Scroll
  position is NOT required. Keep the record minimal and serializable.
- **Recording trigger & list semantics (UX-02):** Not separately discussed — planner decides.
  Reasonable defaults: record a "visit" on opening a case detail (`/case/:caseId`) and on
  quality-review views; most-recent-first ordering; **dedupe** repeat visits to the same
  case (move-to-top, don't duplicate); cap the list (suggest ~5 rows to match the panel size).
- **Role visibility of the flagged button (D-04):** `/quality` is reachable by all authenticated
  users (`ProtectedRoute`), unlike `/doc-quality` (`QualityRoute` / `QUALITY_ROLES`). The button
  is currently gated by `canSeeDocQuality` (`LandingPage.tsx:281`). Planner: re-evaluate whether
  to keep that gate now the target is `/quality` — keep visibility sensible and consistent; do
  not expose a button that routes somewhere the user can't act.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` § "Phase 29: Home Panel UX" — locked goal, success criteria, scope note
- `.planning/REQUIREMENTS.md` § "UX Fixes" (UX-01, UX-02) — reworded 2026-05-21

### Home panel (target of changes)
- `src/pages/LandingPage.tsx` — "Attention needed" alerts (`:253-286`) and "Jump Back In" empty
  state (`:238-250`); the FB-03 / D-09..D-11 comment documents why no history was ever wired
- `src/i18n/translations.ts:845-861` — `jumpBackInEmpty`, `attention*`, `review` keys (static copy)

### Deep-link targets & query-param precedent
- `src/pages/QualityPage.tsx` — therapy `breaker`/`interrupter` derivation (`:43-63`),
  `filterTherapy` + flag `filterStatus` filters (`:100-146`); needs new `?therapy=`/`?status=` read
- `src/App.tsx:55-64` — route table (`/quality` = ProtectedRoute; `/doc-quality` = QualityRoute)
- `src/components/outcomes/OutcomesView.tsx:83-197` — `useSearchParams` deep-link pattern
- `src/pages/AnalysisPage.tsx:52-96` — `?cohort=` / `?filters=` / `?tab=` read-on-mount pattern

### Recent-activity persistence & session teardown
- `src/context/DataContext.tsx:36-115` — `qualityFlags`, `excludedCases`, `reviewedCases`,
  `activeCases` surface (data the panels relate to)
- `src/context/ThemeContext.tsx`, `src/context/LanguageContext.tsx` — the only existing
  localStorage usage; mirror their try/catch-guarded read/write pattern for the recents store
- Session teardown / cross-tab logout (Phase 20 BroadcastChannel; Phases 27–28 session control) —
  the clear-on-logout hook (D-02) must fire here

### Project conventions
- `CLAUDE.md` — naming (camelCase TS), throw-only errors (D-03), async/await, RTL no-jest-dom
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useSearchParams` deep-link pattern (OutcomesView, AnalysisPage, CohortBuilderPage) — reuse
  verbatim for D-05 query-param reads; no new abstraction needed.
- `QualityPage` therapy-status + flag filters — already implement the *semantics* both alerts
  need; only the URL→filter binding is missing.
- `ThemeContext`/`LanguageContext` localStorage try/catch idiom — template for the recents store.
- `DataContext` (`qualityFlags`, `activeCases`) — source of truth for what "flagged" / "breaker"
  mean; the recents store should reference case IDs that resolve against `activeCases`.

### Established Patterns
- View state is encoded in the URL across the app — so a recent-activity record can be a
  route + query string and "restore the view" cheaply (informs the discretion record-shape note).
- localStorage is keyed by a stable string; per-username keying (D-01) follows naturally.

### Integration Points
- Logout/sign-out path (incl. cross-tab BroadcastChannel) — add the clear-recents call (D-02).
- `LandingPage` Jump Back In tile — replace the empty-state-only block with rows when records exist.
- `QualityPage` mount — read `?therapy=` / `?status=` into existing filter state (D-03/D-04/D-05).
</code_context>

<specifics>
## Specific Ideas

- Exact deep-link URLs are locked: `/quality?therapy=breaker` (D-03) and `/quality?status=flagged`
  (D-04). The param *values* must match QualityPage's existing filter vocabulary (`'breaker'` for
  `filterTherapy`; the flag-status value QualityPage uses for "has open quality flag").
- "Jump Back In" rows must keep the existing empty state (`jumpBackInEmpty`) as the zero-records
  fallback (success criterion #3) — do not error on empty.
</specifics>

<deferred>
## Deferred Ideas

- **Data-driven "Attention needed" alerts** (real flagged-case counts, deep-link to a specific
  case rather than a filtered area) — explicitly out of scope for Phase 29 per the adversarial
  review; candidate for a future phase if desired.
- Persisting recent-activity across sessions / cross-device — rejected here in favor of
  clear-on-logout (D-02). Revisit only if a real user need emerges.
</deferred>

---

*Phase: 29-home-panel-ux*
*Context gathered: 2026-05-21*
