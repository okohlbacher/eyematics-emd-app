---
phase: 24-feedback-fixes
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - data/centers.json
  - public/data/center-dresden.json
  - public/data/center-mainz.json
  - public/data/manifest.json
  - scripts/generate-all-bundles.ts
  - src/pages/LandingPage.tsx
  - tests/centerBypass.test.ts
  - tests/ui-requirements.test.ts
  - tests/initAuthMigration.test.ts
  - tests/fhirApi.test.ts
  - tests/generatedBundles.test.ts
  - tests/adminCenterFilter.test.tsx
  - tests/constants.test.ts
  - tests/dataApiCenter.test.ts
  - README.md
  - docs/Benutzerhandbuch.md
  - docs/Konfiguration.md
  - docs/Lastenheft.md
  - docs/Anforderungsabgleich.md
autonomous: true
requirements:
  - FB-01
must_haves:
  truths:
    - "data/centers.json contains 6 entries (UKA, UKC, UKG, UKL, UKM, UKT) — UKD and UKMZ removed"
    - "No FHIR bundle files for Dresden or Mainz remain in public/data/"
    - "scripts/generate-all-bundles.ts no longer references org-ukd or org-ukmz"
    - "README site table shows 6 sites (8 → 6)"
    - "npm run test:ci passes (count adjusted from 608 if site-count assertions are removed); npm run build, npm run lint, npm run knip all clean"
  artifacts:
    - path: "data/centers.json"
      provides: "Canonical 6-site roster"
      contains: "org-uka"
    - path: "scripts/generate-all-bundles.ts"
      provides: "Bundle generator without UKD/UKMZ entries"
  key_links:
    - from: "data/centers.json"
      to: "src/pages/LandingPage.tsx CENTRE_ACCENTS map"
      via: "shorthand keys must align"
      pattern: "CENTRE_ACCENTS"
---

<objective>
Remove UKD (Dresden) and UKMZ (Mainz) from every authoritative location — `data/centers.json`, generated FHIR bundles in `public/data/`, the bundle generator script, hard-coded test fixtures, and user-facing docs — per D-01..D-05. The site roster shrinks from 8 to 6 (UKA, UKC, UKG, UKL, UKM, UKT). No new behaviour; pure data + test cleanup.
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
@data/centers.json
@scripts/generate-all-bundles.ts
@src/pages/LandingPage.tsx

<interfaces>
data/centers.json schema: `Array<{ id: string; shorthand: string; name: string; file: string }>`
After this plan: 6 entries — `org-uka`, `org-ukc`, `org-ukg`, `org-ukl`, `org-ukm`, `org-ukt`.
LandingPage `CENTRE_ACCENTS` keys must mirror the new shorthand set (UKD and UKMZ entries dropped).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove UKD + UKMZ from data sources and bundle generator</name>
  <files>data/centers.json, public/data/center-dresden.json, public/data/center-mainz.json, public/data/manifest.json, scripts/generate-all-bundles.ts, src/pages/LandingPage.tsx</files>
  <action>
    Per D-01/D-02:
    1. Edit `data/centers.json`: delete the `org-ukd` and `org-ukmz` objects. File ends with 6 entries.
    2. Delete `public/data/center-dresden.json` and `public/data/center-mainz.json` (rm).
    3. If `public/data/manifest.json` references those bundle filenames, remove those references.
    4. Edit `scripts/generate-all-bundles.ts`: delete the two CENTERS array entries with `centerId: 'org-ukd'` and `centerId: 'org-ukmz'` (lines ~34 and ~37).
    5. Edit `src/pages/LandingPage.tsx` `CENTRE_ACCENTS` (lines 20-28): remove the `UKD:` and `UKMZ:` keys. Keep the rest.
    Commit message: `chore(24): remove UKD and UKMZ from site roster (FB-01)`
  </action>
  <verify>
    <automated>npm run build &amp;&amp; npm run lint &amp;&amp; npm run knip</automated>
  </verify>
  <done>centers.json has 6 entries; the two bundle files are gone; generator + LandingPage no longer reference UKD/UKMZ; build + lint + knip pass.</done>
</task>

<task type="auto">
  <name>Task 2: Update tests to drop UKD/UKMZ assertions</name>
  <files>tests/centerBypass.test.ts, tests/ui-requirements.test.ts, tests/initAuthMigration.test.ts, tests/fhirApi.test.ts, tests/generatedBundles.test.ts, tests/adminCenterFilter.test.tsx, tests/constants.test.ts, tests/dataApiCenter.test.ts</files>
  <action>
    Per D-04/D-05. For each test file below, drop `org-ukd` and `org-ukmz` from hard-coded site-id arrays and adjust expected lengths (`toHaveLength(8)` → `toHaveLength(6)`):
    - `tests/centerBypass.test.ts` lines 18, 30, 34, 35
    - `tests/ui-requirements.test.ts` lines 362, 366, 369 (`toHaveLength(8)` → `toHaveLength(6)`), 424, 441, 445 (the explicit UKD-filter test loses its meaning — replace with a still-existing site like `org-ukm` filter, or drop if no longer expressive)
    - `tests/initAuthMigration.test.ts` line 45
    - `tests/fhirApi.test.ts` lines 252, 257, 302 (UKD/UKT/UKG fixture — replace UKD with UKM), 309 (adjust expected mapped IDs accordingly), 315
    - `tests/generatedBundles.test.ts` lines 22, 25 — delete those array entries
    - `tests/adminCenterFilter.test.tsx` lines 34-37 (drop UKD + UKMZ rows), 51-55 (re-target the `u-ukd` user fixture to a still-existing site such as UKM, OR delete the fixture and adjust downstream assertions at lines 63, 150, 153, 159, 162, 172, 179, 184, 187-199 accordingly)
    - `tests/constants.test.ts` line 87 — change `toContain('org-ukmz')` to `toContain('org-ukm')` (or drop and assert one of the remaining 6)
    - `tests/dataApiCenter.test.ts` lines 52, 56 — replace `case-ukd-001`/`org-ukd` mapping with a still-existing site (e.g., `case-ukm-001`/`org-ukm`)
    - `tests/OutcomesPage.test.tsx` lines 718, 740 — `toHaveLength(8)` → `toHaveLength(6)` if the headers correspond to the site list (verify by reading surrounding context; if they correspond to something else like quarters, leave alone)
    Run `npm run test:ci`. The 608/608 baseline will adjust to a new count reflecting removed/changed assertions; record the new count in the commit message (D-05).
    Commit message: `test(24): update fixtures and length assertions for 6-site roster (FB-01)`
  </action>
  <verify>
    <automated>npm run test:ci</automated>
  </verify>
  <done>Full test suite passes with the new site count; no test references UKD or UKMZ; commit message records the new green test count.</done>
</task>

<task type="auto">
  <name>Task 3: Update README and docs to reflect 6-site roster</name>
  <files>README.md, docs/Benutzerhandbuch.md, docs/Konfiguration.md, docs/Lastenheft.md, docs/Anforderungsabgleich.md</files>
  <action>
    Per D-03. Grep each file for `UKD`, `UKMZ`, `Dresden`, `Mainz`, and any "8 sites"/"acht Standorte" prose. For each hit:
    1. Remove the row from site tables.
    2. Update count text (8 → 6).
    3. Leave historical milestone references alone (e.g. "v1.5 added 8 sites") — only update current-state prose.
    Run `npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run knip &amp;&amp; npm run lint` to confirm the safety net (per D-16).
    Commit message: `docs(24): reduce site roster from 8 to 6 in README and docs (FB-01)`
  </action>
  <verify>
    <automated>npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run knip &amp;&amp; npm run lint</automated>
  </verify>
  <done>No current-state doc lists UKD or UKMZ; site count updated; full safety net green.</done>
</task>

</tasks>

<verification>
- `data/centers.json` has exactly 6 entries
- `grep -r 'UKD\|UKMZ\|Dresden\|Mainz' data/ public/data/ scripts/ src/` returns no current-state hits (historical milestone text in archived ROADMAPs is OK)
- `npm run test:ci` green; new green count recorded in commit
- `npm run build`, `npm run knip`, `npm run lint` all clean
</verification>

<success_criteria>
ROADMAP §Phase 24 success criterion 1: `data/centers.json` no longer lists UKD or UKMZ; generated FHIR bundles for those sites are removed; README site table updated; `npm run test:ci` and `npm run build` green.
</success_criteria>

<output>
After completion, create `.planning/phases/24-feedback-fixes/24-01-SUMMARY.md`.
</output>
