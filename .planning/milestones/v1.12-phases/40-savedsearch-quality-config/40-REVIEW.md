---
phase: 40-savedsearch-quality-config
reviewed: 2026-05-25
depth: standard
status: issues_found
findings:
  blocker: 1
  warning: 3
  info: 2
  total: 6
---

# Phase 40 Code Review — SavedSearch hardening (F-13) + cohort-scoped quality

Security core sound (prototype-pollution prevented, server-owned provenance confirmed, qualityParams tri-state consistent). Issues:

## BLOCKER
### CR-01 — QualityPage crashes scoping to a `flaggedQuality` cohort (Set vs array wire mismatch)
- `src/pages/QualityPage.tsx` passes `selectedSearch.filters` straight to `applyFilters`. Server returns `flaggedCaseIds` as `string[]` (wire form); `applyFilters` calls `.has()` (Set) → `TypeError`. Every other consumer routes through `safePickCohortFilter` (array→Set rehydrate); QualityPage skips it. `SavedSearch.filters: CohortFilter` masks it at compile time.
- **Fix:** `applyFilters(cases, safePickCohortFilter(selectedSearch.filters), {...})`.

## WARNING
### WR-01 — Center-ownership validation checks never-persisted fields
- `server/dataApi.ts` validates `caseIds`/`selectedCases` (not in CohortFilter, stripped by sanitizer), while the persisted case-ID field `flaggedCaseIds` is NOT center-validated. Not exploitable today (downstream filters by center first), but the check enforces nothing. **Fix:** validate `flaggedCaseIds`; drop dead `caseIds`/`selectedCases` checks; fix comment.
### WR-02 — Stale `validateCaseCenters` comment contradicts isBypass (admin-only, F-05). Update comment.
### WR-03 — `getSavedSearches` returns legacy filters without read-side sanitize. **Fix:** `sanitizeSavedSearchFilters(JSON.parse(r.filters))` on read (defense-in-depth).

## INFO
- IN-01: `addSavedSearch` JSON.stringify drops a live Set silently — normalize Set→array inside addSavedSearch (CohortBuilder pre-converts today, so safe).
- IN-02: compute `new Date().toISOString()` once for created_at/updated_at.
