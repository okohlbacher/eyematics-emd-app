---
phase: 24-feedback-fixes
reviewed: 2026-04-28T07:16:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - data/centers.json
  - public/data/manifest.json
  - scripts/generate-all-bundles.ts
  - server/constants.ts
  - server/index.ts
  - server/initAuth.ts
  - src/i18n/translations.ts
  - src/pages/LandingPage.tsx
  - src/services/fhirLoader.ts
  - src/utils/qualityMetrics.ts
  - tests/LandingPage.test.tsx
  - tests/qualityMetrics.test.ts
  - tests/adminCenterFilter.test.tsx
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-04-28
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found (1 WARNING, 3 NIT)

## Summary

Phase 24 delivers four narrowly-scoped feedback fixes (FB-01..04). The diff is
clean and focused: roster trim (UKD/UKMZ removal with migration set
expansion), wired Attention buttons, Jump-Back-In empty state, and DocQuality
palette swap to muted tokens. New tests (12) pass. No source files outside the
declared scope were touched. `jsonwebtoken` pinning (F-23 / T-20-13) is
untouched — no auth surface change. Residual UKD/UKMZ string hits are all
intentional (migration set, comments, historical Lastenheft note).

## Warnings

### WR-01: epidemiologe seed reassignment may surprise existing deployments

**File:** `server/index.ts:108`
**Issue:** The `defaultUsers` literal changed `epidemiologe.centers` from
`['org-uka', 'org-ukc', 'org-ukd']` to `['org-uka', 'org-ukc', 'org-ukg']`
and `diz_manager.centers` from `['org-ukmz']` to `['org-ukm']`. This block
only runs when `users.json` is absent (fresh seed), so existing installs are
unaffected — but any test/dev fixture rebuilt from scratch now binds these
seed users to UKG / UKM rather than to a documented fallback. The migration
in `initAuth.ts` (REMOVED_CENTER_IDS) reassigns *only-removed-centre* users
to `['org-uka']`, so seed and migration disagree on the fallback target.
**Fix:** Either align the seed with the migration fallback (use `['org-uka']`
for `diz_manager`, and document the UKG choice for `epidemiologe`), or add a
short comment justifying the divergent target so future readers don't read
it as a typo:
```ts
// Phase 24 / FB-01: re-pointed to UKG/UKM (sites that remain in roster).
// Seed-only — runtime migration uses ['org-uka'] as the safe fallback.
```

## Info

### IN-01: `jumpBackInEmpty` translation key lacks usage outside LandingPage

**File:** `src/i18n/translations.ts:841`
**Issue:** New key is fine, but consider whether the panel itself should be
hidden when no history exists (rather than rendering an empty card). Current
choice (visible empty state) is defensible for discoverability — non-blocking.
**Fix:** None required; flagging for future UX iteration.

### IN-02: Inline-arrow `onClick={() => navigate(...)}` recreated each render

**File:** `src/pages/LandingPage.tsx:262, 277`
**Issue:** Two new `onClick={() => navigate('/cohort')}` / `'/doc-quality'`
handlers are inline. Harmless at this scale (no memoised children downstream),
matches surrounding style. Mentioned only because the FB-02 test asserts
`onclick !== null` — a future `useCallback` refactor must keep that guarantee.
**Fix:** None required.

### IN-03: `CENTRE_ACCENTS` UKM colour collides semantically with old UKD

**File:** `src/pages/LandingPage.tsx:23`
**Issue:** UKM was assigned `var(--color-indigo)` — the exact token UKD used.
Functionally fine (UKD is gone), but if UKD is ever reinstated for demo data,
the palette will clash. Low risk.
**Fix:** None now; document in `CENTRE_ACCENTS` if roster ever grows again.

## Cleanup Hygiene

`grep -ri "ukd|ukmz|dresden|mainz"` (excluding `.planning/`, `node_modules`,
`dist`) returns 5 hits across `server/initAuth.ts`,
`tests/adminCenterFilter.test.tsx`, `tests/constants.test.ts`,
`docs/Lastenheft.md`, `scripts/generate-all-bundles.ts`. **All intentional**:
migration set entries, FB-01 annotations, and the historical Lastenheft note.
Bundle blobs (`public/data/center-dresden.json`, `center-mainz.json`) are
deleted; `manifest.json` regenerated. Clean.

## Verdict

**CONCERNS** — one WARNING (seed/migration fallback mismatch in
`server/index.ts`) worth addressing before tagging v1.9.3, but no blockers.
Tests, scope discipline, and security posture all hold.

---

_Reviewed: 2026-04-28T07:16:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
