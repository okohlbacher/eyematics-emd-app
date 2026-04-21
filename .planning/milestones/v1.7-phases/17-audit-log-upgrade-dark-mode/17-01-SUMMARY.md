---
plan: 17-01
phase: 17
status: complete
self_check: PASSED
---

## Summary

Created 4 failing test scaffolds for Phase 17 behaviours. All test files compile with no syntax errors; failures are assertion errors or missing-export errors, not compile errors. Existing green tests remain unaffected.

## What Was Built

### tests/audit.test.ts
- New `describe('Phase 17 filter arms')` block with 8 test cases
- Covers: action_category (auth/data/admin/outcomes), body_search, status_gte=400, combined filter
- All 8 fail because `buildWhereClause` does not yet implement these arms

### tests/auditApi.test.ts
- New `describe('Phase 17 audit API params')` block with 6 test cases
- Covers: action_category=auth route filtering, enum invalid (no 500), status_gte=400, NaN guard (no 500), body_search=needle, non-admin auto-scope preservation
- All 6 fail because the GET /api/audit handler does not yet parse these params

### tests/outcomesPalette.contrast.test.ts
- Added import of `DARK_EYE_COLORS`, `DARK_COHORT_PALETTES` (not yet exported by palette.ts)
- 2 new describe blocks: DARK_EYE_COLORS (3 cases ≥ 4.5:1 vs #111827), DARK_COHORT_PALETTES (4 cases ≥ 3.0:1 vs #111827)
- Fails at import until Plan 03 adds these exports

### tests/outcomesI18n.test.ts
- New `describe('Phase 17 i18n keys (theme + audit filters)')` with 32 assertions (16 keys × 2 locales)
- Keys: themeLight/Dark/System, auditFilter*, auditCategory*, auditEmptyFiltered
- All 32 fail because keys don't yet exist in translations.ts

## Commits
- `b610934` test(17-01): add failing Phase 17 filter arm cases to audit.test.ts
- `89c1656` test(17-01): add failing Phase 17 API param validation cases to auditApi.test.ts
- `d055b39` test(17-01): add failing DARK_EYE_COLORS + DARK_COHORT_PALETTES WCAG cases
- `08eb5f3` test(17-01): add failing Phase 17 i18n key coverage (32 assertions)

## key-files
created:
  - tests/audit.test.ts (extended)
  - tests/auditApi.test.ts (extended)
  - tests/outcomesPalette.contrast.test.ts (extended)
  - tests/outcomesI18n.test.ts (extended)

## Deviations
None. All tasks executed as specified.

## Self-Check
- [x] 4 test files extended, each with new failing describe blocks
- [x] Each task committed individually
- [x] No production code modified
- [x] Existing tests still compile and run green
