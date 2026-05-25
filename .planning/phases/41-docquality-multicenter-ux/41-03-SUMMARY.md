---
phase: 41-docquality-multicenter-ux
plan: "03"
subsystem: quality-review-ux
tags: [qual-025, flag-status, ux, rtl]
dependency_graph:
  requires: []
  provides: [QUAL-025-top-flag-status-control]
  affects: [QualityCaseDetail, quality-review-workflow]
tech_stack:
  added: []
  patterns: [compact-inline-controls, data-testid-dom-order-assertion]
key_files:
  created:
    - tests/QualityCaseDetail.test.tsx
  modified:
    - src/components/quality/QualityCaseDetail.tsx
decisions:
  - "Duplicate (not move) flag-status selects to header; bottom reviewResults section retained for full detail context"
  - "data-testid='top-flag-status-controls' wrapper enables reliable DOM-order assertion without jest-dom"
  - "Compact horizontal layout (flag label + select per flag) fits inside existing header card"
metrics:
  duration_seconds: 433
  completed_date: "2026-05-25"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 41 Plan 03: QUAL-025 Approve-Dropdown Top Placement Summary

**One-liner:** Per-flag status selects (open/acknowledged/resolved) duplicated into the QualityCaseDetail header card so reviewers reach approve/flag controls without scrolling past the full values table.

## What Was Built

QUAL-025 required the approve/flag-status control to be reachable at the top of the case detail, not only after scrolling past the entire patient values table.

**Task 1 — Repositioned flag-status control (feat commit a0f5f10):**
- Added a compact flag-status block inside the existing case-info header card (`QualityCaseDetail.tsx`), rendered before the patient data grid when `caseFlags.length > 0`
- Each flag is shown as: `[parameter label] [status <select>]` in a horizontal flex group
- The select is wired to the existing `onUpdateFlagStatus` callback — no signature change
- The bottom "Existing flags / reviewResults" section is retained so the full detail context remains available
- Mark-reviewed and Exclude buttons are untouched

**Task 2 — RTL coverage (test commit 4279c3a):**
- `tests/QualityCaseDetail.test.tsx` — 6 tests, no jest-dom
- Asserts status select present when flags exist
- Asserts `fireEvent.change` on top select calls `onUpdateFlagStatus(caseId, flaggedAt, newStatus)`
- Asserts mark-reviewed button calls `onMarkReviewed`
- Asserts DOM order: top controls precede values tab using `compareDocumentPosition`
- Asserts no control rendered when `caseFlags` is empty

## Test Results

- New tests: 6/6 pass (`npx vitest run tests/QualityCaseDetail.test.tsx`)
- Full suite: 1026/1026 pass (`npm run test:ci`) — up from 1020 baseline
- Lint: clean (`npm run lint`)

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | a0f5f10 | feat(41-03): QUAL-025 add flag-status controls near top of case detail header |
| 2 | 4279c3a | test(41-03): RTL coverage for QUAL-025 top flag-status control placement |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

T-41-06 (Tampering) mitigated: both the top and bottom controls bind the same parent-owned `onUpdateFlagStatus` and read `f.status` from the same `caseFlags` prop. No independent client state; duplication cannot desync or forge a status. UI-only change with no new network endpoints.

## Self-Check: PASSED

- `src/components/quality/QualityCaseDetail.tsx` — modified, exists
- `tests/QualityCaseDetail.test.tsx` — created, exists
- Commit a0f5f10 — verified in git log
- Commit 4279c3a — verified in git log
