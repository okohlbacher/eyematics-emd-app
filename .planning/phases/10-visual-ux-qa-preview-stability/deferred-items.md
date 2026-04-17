# Phase 10 — Deferred Items (Out-of-Scope Discoveries)

Discoveries made during plan execution that are NOT caused by the current plan's changes. Per GSD scope boundary: log here, do not fix inline.

## 10-02a

- **Test runs leave untracked JSON files in `feedback/`.** Running `npx vitest run` creates files matching `feedback/issue-<timestamp>_<hash>.json`. These appear to be produced by `tests/issueApi.test.ts` (or similar test path) and are not cleaned up. They are **not** caused by plan 10-02a's changes — they already accumulate when the full suite is run on a clean tree. Candidate fix: add `feedback/issue-*.json` to `.gitignore` or have the test clean up its outputs. Not fixed here because it is unrelated to the IQR band guard work and would expand plan scope.
