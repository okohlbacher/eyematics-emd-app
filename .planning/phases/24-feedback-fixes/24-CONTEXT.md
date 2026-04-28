# Phase 24: Production Feedback Fixes — Context

**Gathered:** 2026-04-28
**Status:** Ready for planning
**Mode:** `--auto` (decisions auto-selected from feedback content)
**Source:** 4 in-app feedback submissions by `admin` on 2026-04-27

<domain>
## Phase Boundary

Resolve all four issues reported via the in-app feedback channel:

1. **FB-01 (data)** — Remove UKD (Dresden) and UKMZ (Mainz) from the site roster
2. **FB-02 (bug)** — Home-page "Attention needed" panel: dead "Review" buttons
3. **FB-03 (bug)** — Home-page "Jump Back In" panel: arrows go nowhere, no error/empty state
4. **FB-04 (design)** — Documentation Quality bar-chart palette clashes with page

Out of scope:
- New product features
- Refactors beyond what is needed to fix these four issues
- Adding new sites (only removing two)
- Reskinning the entire app (only DocQuality bars)

</domain>

<decisions>
## Implementation Decisions

### FB-01 — Site roster cleanup

- **D-01:** Remove `org-ukd` and `org-ukmz` entries from `data/centers.json` outright. Do NOT add a `disabled: true` flag — full removal keeps the data layer simple and matches the user's instruction ("will not participate").
- **D-02:** Delete the corresponding bundle files in `public/data/` (e.g., `center-ukd.json`, `center-ukmz.json`) and any pre-generated FHIR bundles for those sites. Audit `scripts/generate-all-bundles.ts` and `scripts/generate-center-bundle.ts` for hard-coded references; remove them.
- **D-03:** Update README site table (8 → 6 rows). Update `docs/Anforderungsabgleich.md` and any other doc that lists 8 sites.
- **D-04:** Audit tests for hard-coded `expect(centers).toHaveLength(8)` or string assertions like `'UKD'`/`'UKMZ'`. Update or remove.
- **D-05:** Run `npm run test:ci` after the data change to confirm 608/608 still passes (or adjust the count if site-count tests legitimately change).

### FB-02 — "Attention needed" panel

- **D-06:** Inspect every "Review" button in the panel. For each: if a sensible target route exists (Quality page, Audit page, Cohort page), wire it. Otherwise, remove the button and the corresponding panel item.
- **D-07:** Acceptable resolution paths in priority order:
  1. Wire the button to the correct existing route (preferred when intent is obvious)
  2. Hide the button conditionally (when the underlying entity has no detail view)
  3. Remove the button if no route makes sense
- **D-08:** No silent click handlers. Every onClick must either navigate or be removed.

### FB-03 — "Jump Back In" panel

- **D-09:** Inspect arrow buttons. The intent appears to be "navigate to the most recent cohort/case from history". Wire arrows to that route if such a state exists in app context.
- **D-10:** When no history exists, show an explicit empty-state (e.g., "No recent activity yet") instead of dead arrows. Do NOT silently swallow clicks.
- **D-11:** If the panel wraps state that has never been wired up (premature feature), prefer to remove the arrow buttons and leave only the static content, rather than ship broken interactivity.

### FB-04 — DocQuality palette

- **D-12:** Align bar-chart colours with the muted palette already used on the page. Inspect the existing `recharts` instances on the same page (`src/pages/DocQualityPage.tsx` and components in `src/components/doc-quality/`) for the established colour tokens; reuse them.
- **D-13:** Default token candidates (Tailwind/design-system): the project uses muted slate/zinc/neutral families and an existing chart-token palette. Pick the existing chart tokens (do NOT introduce a new palette).
- **D-14:** Series must remain visually distinguishable. If reducing saturation collapses two series visually, vary lightness or use a perceptually-distinct hue from the same muted family.
- **D-15:** No contrast regression: dark-mode and light-mode both must remain readable. Spot-check both modes.

### Cross-cutting

- **D-16:** Safety net per commit: `npm run test:ci` (608/608 baseline) + `npm run build` + `npm run knip` + `npm run lint`. Adjust the test count only if FB-01 legitimately removes site-count assertions.
- **D-17:** One plan per feedback item (4 plans total): plan-by-plan atomic commits keep diffs reviewable and let the user verify each fix independently.
- **D-18:** Wave grouping: FB-01 is a data change with broad test impact → Wave 1. FB-02/FB-03 both touch HomePage → Wave 2 (sequential within wave to avoid file collision). FB-04 is isolated to DocQuality → can run alongside Wave 2 OR sequentially as Wave 3.
- **D-19:** Suggested wave layout: Wave 1 = [24-01-site-roster], Wave 2 = [24-02-attention-panel, 24-04-docquality-palette] (parallel; non-overlapping files), Wave 3 = [24-03-jump-back-in] (after 24-02 to avoid HomePage collision).

### Claude's Discretion

- Whether 24-02 and 24-03 should merge into one plan (if both panels live in the same component file with high coupling) — Claude judges during planning.
- Exact muted-palette token selection for FB-04 — Claude inspects existing usage and picks the closest established token.
- Whether to keep FB-02 panel items where the underlying entity has no route (D-07 option 2 vs 3) — Claude judges per item; bias toward removal if uncertain.

</decisions>

<specifics>
## Specific Ideas

- The Home page is `src/pages/HomePage.tsx` (or similar — verify during planning). Both flagged panels likely live there or in `src/components/home/`.
- DocQuality bar chart is in `src/pages/DocQualityPage.tsx` or `src/components/doc-quality/`. Recharts `<Bar fill=...>` is the typical colour attachment.
- Site list is canonical in `data/centers.json`. The 8 current entries are: UKA, UKC, UKD, UKG, UKL, UKM, UKMZ, UKT. After FB-01: UKA, UKC, UKG, UKL, UKM, UKT (6).
- `Note from Phase 22 SUMMARY:` `data/centers.json` is the single source for the site roster. F-23 / T-20-13 (jsonwebtoken restriction) is not affected by this phase.

</specifics>

<canonical_refs>
**Downstream agents MUST read these before planning or implementing.**

### ROADMAP & requirements
- `.planning/ROADMAP.md` §Phase 24 — Phase goal, success criteria
- `.planning/REQUIREMENTS.md` FB-01..FB-04 — binding requirement text
- This CONTEXT file (D-01..D-19)

### Codebase entry points
- `data/centers.json` — site roster
- `public/data/center-*.json` — FHIR bundles per site
- `src/pages/HomePage.tsx` (or detected equivalent) — Home panels
- `src/pages/DocQualityPage.tsx` and `src/components/doc-quality/` — bar chart
- `scripts/generate-all-bundles.ts`, `scripts/generate-center-bundle.ts` — bundle generation

### Phase history (pattern references)
- Phase 22 atomic-commit + knip safety-net pattern
- Phase 23 conscious gating: test:ci + build + knip + lint after every commit

### Source feedback files
- `feedback/issue-2026-04-27T19-50-37-789Z_d3eff9a0.json` (FB-01 — site removal)
- `feedback/issue-2026-04-27T19-52-51-665Z_7a71577a.json` (FB-02 — Attention panel)
- `feedback/issue-2026-04-27T19-54-01-206Z_14682e47.json` (FB-03 — Jump Back In)
- `feedback/issue-2026-04-27T20-00-21-053Z_5144a283.json` (FB-04 — DocQuality colours)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `data/centers.json` is canonical — no duplicate site lists elsewhere (verified in Phase 22).
- Existing chart palette tokens are already in use on the same page (DocQuality); reuse rather than introduce.
- `feedback/` directory already in place from issueApi (Phase 17/22).

### Known pitfalls (carried forward)
- **Pitfall 3 (Phase 22):** `npm run build` catches Vite/rolldown dynamic-import breakage that `npm test` misses. Run after every commit.
- **Site-count test brittleness:** Some tests may hard-code `length === 8`; FB-01 will surface and require updating.

</code_context>

<deferred_ideas>
## Deferred Ideas

- **Site management UI** — adding/removing sites at runtime via Settings page. Out of scope.
- **Generic "empty state" component** — extract a reusable empty-state pattern after FB-03 lands. Future polish.
- **Full Home page redesign** — only repair the two flagged panels; broader rework belongs in a future milestone.

</deferred_ideas>
