---
plan: 06
phase: 13-new-outcome-metrics-crt-interval-responder
status: complete
---

# Plan 13-06 Summary — i18n Completeness Tests (metrics* namespace)

## What was done

Extended `tests/outcomesI18n.test.ts` with a new `describe('metrics* i18n bundle')` block containing three tests that enforce METRIC-06 (DE+EN i18n completeness for all Phase 13 strings):

1. **`every metrics* key has a non-empty de and en translation`** — filters translations to `metrics*` prefix, asserts count > 40, and checks both locale strings are non-empty.
2. **`placeholder tokens match between DE and EN`** — regex-extracts `{placeholder}` tokens from DE and EN for each key and asserts they are identical (prevents locale mismatch like `{count}` vs `{anzahl}`).
3. **`every t("metrics*") reference in src/ resolves to a defined key`** — walks `src/` recursively, extracts all `t('metricsXXX')` string literals, and asserts each referenced key exists in the translations object. Detects typos and dangling references.

## Metrics* key count

59 keys observed in `src/i18n/translations.ts` with the `metrics` prefix (seeded by Plan 13-01). Floor threshold in the test is 40 (conservative lower bound for regression detection).

## Unused metrics* keys

Test 3 walks `src/` for actual `t('metricsXXX')` calls. At the time of 13-06 execution (before 13-05 lands), Test 3 passes trivially (zero references found → zero missing keys). When Plan 13-05 wires up the metric selector and components, Test 3 will enforce that all referenced keys exist.

Candidates for cleanup in a follow-up milestone (keys seeded but potentially unused after component wiring): none identified yet — defer to post-13-05 verification pass.

## Test results

All 6 tests pass (3 outcomes* + 3 metrics*), runtime 142ms.

## Existing outcomes* block

Unmodified. The new block is appended after the existing `describe('outcomes* i18n bundle')` block.
