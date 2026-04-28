---
phase: 24-feedback-fixes
plan: 02
type: execute
wave: 2
depends_on:
  - 24-01
files_modified:
  - src/pages/LandingPage.tsx
  - tests/LandingPage.test.tsx
autonomous: true
requirements:
  - FB-02
must_haves:
  truths:
    - "Every Review button in the Attention needed panel either navigates to a real route or is removed"
    - "No Review button has a silent or undefined onClick (D-08)"
    - "Therapy-breakers item routes to a real destination OR the item is removed"
    - "Implausible-CRT item routes to a real destination OR the item is removed"
  artifacts:
    - path: "src/pages/LandingPage.tsx"
      provides: "Attention panel with wired or removed Review buttons"
      contains: "attentionNeeded"
    - path: "tests/LandingPage.test.tsx"
      provides: "Test asserting every Review button has a navigation target (or panel item is absent)"
  key_links:
    - from: "src/pages/LandingPage.tsx Review buttons"
      to: "react-router-dom navigate (e.g. /quality, /audit, /cohort)"
      via: "onClick → navigate(path)"
      pattern: "navigate\\("
---

<objective>
Repair the Home-page "Attention needed" panel (LandingPage.tsx lines ~284-316) so every Review button either navigates to a real route or the dead button + its panel row are removed entirely (D-06..D-08). No silent click handlers remain.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/24-feedback-fixes/24-CONTEXT.md
@CLAUDE.md
@src/pages/LandingPage.tsx
@src/App.tsx

<interfaces>
Available routes (from src/App.tsx): `/`, `/cohort`, `/analysis`, `/case/:caseId`, `/quality`, `/account`, `/doc-quality` (clinic-lead/admin), `/admin` (admin), `/audit` (admin), `/settings` (admin).
Use `useNavigate` from `react-router-dom` (already a project dependency).
Two attention items today (LandingPage.tsx ~288-301 and ~302-315):
- Therapy-breakers (`attentionTherapyBreakers`) — closest semantic match: `/cohort` (build a cohort filtered to therapy breakers) or `/quality` (cohort-level quality view).
- Implausible CRT (`attentionImplausibleCrt`) — closest semantic match: `/doc-quality` (implausibility lives in the data-quality plausibility metric).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wire or remove every Review button in the Attention panel</name>
  <files>src/pages/LandingPage.tsx</files>
  <action>
    Per D-06/D-07/D-08:
    1. Import `useNavigate` from `react-router-dom`. Inside the component: `const navigate = useNavigate();`.
    2. For the therapy-breakers item (~lines 288-301): if `/cohort` is a sensible target (it is — therapy breakers are a cohort-shaped concept), wire `onClick={() =&gt; navigate('/cohort')}` on the Review button. If during inspection the panel content makes another route obviously better (e.g. `/analysis`), pick that instead and document the choice in the commit message.
    3. For the implausible-CRT item (~lines 302-315): wire `onClick={() =&gt; navigate('/doc-quality')}` on the Review button (plausibility lives there). If `/doc-quality` is gated by role and the current user lacks access, fall back to D-07 option 2: hide the button conditionally using `useAuth()` role check.
    4. If during the audit either item's intent is genuinely ambiguous and no route fits, apply D-07 option 3: remove that item's entire `<div>` (icon + text + button) so no dead UI ships.
    5. Verify no Review button retains a default-empty onClick. Every Review button in the final tree either navigates somewhere real or has been removed along with its row.
    Commit message: `fix(24): wire (or remove) Review buttons in Attention needed panel (FB-02)`
  </action>
  <verify>
    <automated>npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run lint &amp;&amp; npm run knip</automated>
  </verify>
  <done>Every remaining Review button has a concrete `navigate(...)` target; any item without a sensible target is removed entirely; build + tests + lint + knip green.</done>
</task>

<task type="auto">
  <name>Task 2: Add regression test asserting Review buttons are wired</name>
  <files>tests/LandingPage.test.tsx</files>
  <action>
    Create or extend `tests/LandingPage.test.tsx`:
    1. Render LandingPage inside a MemoryRouter with mocked auth + data contexts (follow the pattern from existing landing-page tests if any; otherwise copy the rendering pattern from `tests/adminCenterFilter.test.tsx`).
    2. Assert: for every button whose accessible name matches the `t('review')` label, clicking it either changes the router location to a non-`/` path or the button does not exist in the DOM. Use `MemoryRouter` initialEntries `['/']` and a location-spy route that records `useLocation().pathname`.
    3. Per CLAUDE.md: no jest-dom; use `queryByText().not.toBeNull()` / `.toBeNull()`.
    Commit message: `test(24): assert Attention panel Review buttons navigate or are absent (FB-02)`
  </action>
  <verify>
    <automated>npm run test:ci -- LandingPage</automated>
  </verify>
  <done>New test covers every present Review button; full suite still green.</done>
</task>

</tasks>

<verification>
- Manual grep `grep -n 'review' src/pages/LandingPage.tsx` shows every Review button has a real onClick navigation OR the row is removed
- New LandingPage test passes
- Full safety net (test:ci + build + lint + knip) green
</verification>

<success_criteria>
ROADMAP §Phase 24 success criterion 2: every Review button in the Home-page Attention needed panel either navigates to a real route OR is removed; no dangling click handlers.
</success_criteria>

<output>
After completion, create `.planning/phases/24-feedback-fixes/24-02-SUMMARY.md`.
</output>
