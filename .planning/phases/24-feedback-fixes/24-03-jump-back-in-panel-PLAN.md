---
phase: 24-feedback-fixes
plan: 03
type: execute
wave: 3
depends_on:
  - 24-02
files_modified:
  - src/pages/LandingPage.tsx
  - tests/LandingPage.test.tsx
autonomous: true
requirements:
  - FB-03
must_haves:
  truths:
    - "Jump Back In rows either navigate to a real route on click OR show an explicit empty state"
    - "Arrow buttons no longer silently swallow clicks (D-10)"
    - "If no recent-activity state exists, the static placeholder rows are removed in favour of an empty-state message (D-11)"
  artifacts:
    - path: "src/pages/LandingPage.tsx"
      provides: "Jump Back In panel with real navigation OR explicit empty state"
      contains: "jumpBackIn"
  key_links:
    - from: "src/pages/LandingPage.tsx Jump Back In rows"
      to: "react-router-dom navigate (e.g. /cohort or /case/:caseId)"
      via: "onClick → navigate(path) when history exists; otherwise empty state"
      pattern: "navigate\\("
---

<objective>
Repair the Home-page "Jump Back In" panel (LandingPage.tsx lines ~228-282) so arrow rows either route to a real prior cohort/case or surface an explicit empty state (D-09..D-11). Today the rows render hard-coded placeholder content (`'AMD · female · 70+'`, `'PSN-UKA-0023'`) with `cursor-pointer` but no onClick — the classic dead-arrow bug FB-03 reports.
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
Lines 228-282 today: hard-coded array `[{ k, title, sub, icon, tone }, ...]` rendered as rows with `cursor-pointer` but no onClick wiring; an `ArrowRight` icon is shown decoratively.
Available routes for navigation: `/cohort` (Cohort Builder), `/case/:caseId` (Case Detail), `/analysis`.
Resolution path per D-11: because no recent-activity state has ever been wired up in app context, prefer the cleanest fix — replace the placeholder array with an explicit empty state message ("No recent activity yet" / matching i18n key) and remove the dead arrow buttons. If during inspection a real history source is discovered (e.g. recent cohort id in `useData()` or localStorage), wire the rows instead.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace dead Jump Back In rows with real navigation OR explicit empty state</name>
  <files>src/pages/LandingPage.tsx</files>
  <action>
    Per D-09/D-10/D-11:
    1. Inspect `useData()` and `useAuth()` (or any other context exported from `src/context/`) for genuine recent-activity state — recent cohort id, last viewed case id, etc.
    2. If such state exists: wire each row's onClick to `navigate('/cohort?id=...')` or `navigate('/case/' + caseId)` accordingly, using the data already in context. Drop placeholder rows that have no real backing data.
    3. If no such state exists (most likely outcome — placeholder data is currently hard-coded strings unrelated to any context): replace the entire mapped array with an explicit empty-state block — a single static message using existing typography classes, e.g. centered text reading the new i18n key `t('jumpBackInEmpty')` ("No recent activity yet" / "Noch keine kürzlichen Aktivitäten"). Add the new i18n key to whichever translation file `t()` reads from (find by grepping for an existing key like `jumpBackIn`).
    4. Remove the unused `ArrowRight` import if no longer referenced (knip will flag it).
    5. Reuse `useNavigate` already imported in plan 24-02.
    Commit message: `fix(24): wire Jump Back In rows or surface explicit empty state (FB-03)`
  </action>
  <verify>
    <automated>npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run lint &amp;&amp; npm run knip</automated>
  </verify>
  <done>Jump Back In panel either navigates on click for every visible row OR renders an explicit empty-state message; no row has `cursor-pointer` without a real onClick; new i18n key (if added) is present in all locale files; safety net green.</done>
</task>

<task type="auto">
  <name>Task 2: Add regression test for Jump Back In panel behaviour</name>
  <files>tests/LandingPage.test.tsx</files>
  <action>
    Extend `tests/LandingPage.test.tsx` (created in plan 24-02):
    1. Empty-state path: render LandingPage with a context shape that has no recent activity. Assert the empty-state copy is visible (`queryByText(/no recent activity|noch keine/i).not.toBeNull()`) and assert no `cursor-pointer` row claims to be a Jump Back In entry.
    2. Wired path (only if the implementation chose D-09 wiring): render LandingPage with mocked recent-activity context, click the row, and assert `useLocation().pathname` changed to the expected target.
    3. Per CLAUDE.md: no jest-dom; use `queryByText().not.toBeNull()` / `.toBeNull()`.
    Commit message: `test(24): cover Jump Back In navigation and empty state (FB-03)`
  </action>
  <verify>
    <automated>npm run test:ci -- LandingPage</automated>
  </verify>
  <done>New tests cover the chosen behaviour (empty state or wiring); full suite green.</done>
</task>

</tasks>

<verification>
- Visual inspection of LandingPage.tsx: no row carries `cursor-pointer` without an onClick that navigates
- New tests in `tests/LandingPage.test.tsx` green
- knip reports no newly-unused imports (e.g. ArrowRight)
- Full safety net (test:ci + build + lint + knip) green
</verification>

<success_criteria>
ROADMAP §Phase 24 success criterion 3: Jump Back In panel arrows route to a prior cohort/case OR show an explicit empty state when no history exists; click handlers no longer silently swallow events.
</success_criteria>

<output>
After completion, create `.planning/phases/24-feedback-fixes/24-03-SUMMARY.md`.
</output>
