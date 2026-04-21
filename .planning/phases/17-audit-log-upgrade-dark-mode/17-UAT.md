---
status: complete
phase: 17-audit-log-upgrade-dark-mode
source: [17-01-SUMMARY.md, 17-02-SUMMARY.md, 17-03-SUMMARY.md, 17-04-SUMMARY.md]
started: 2026-04-21T00:00:00Z
updated: 2026-04-21T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Theme Toggle in Sidebar
expected: A theme toggle is visible in the sidebar footer. Clicking it cycles through light / dark / system modes. When dark is selected the entire UI shifts to a dark background. Reloading the page keeps the selected theme (preference saved in localStorage under "emd-theme").
result: issue
reported: "The toggle switch changes, but the overall view of the dashboard remains unchanged when changing themes."
severity: major

### 2. FOUC Prevention on Dark Reload
expected: While in dark mode, do a hard reload (Cmd+Shift+R / Ctrl+Shift+R). The page should load immediately in dark colors — no white flash before the dark theme applies.
result: pass

### 3. Dark Mode Page Theming
expected: With dark mode active, navigate to Login, Admin, and Analysis pages. All three should render with dark backgrounds (gray-900 / gray-800), light-colored text, and dark-styled inputs and cards — no white panels visible.
result: pass

### 4. Dark Mode Chart Colors
expected: In dark mode, open the Analysis page and view any Recharts chart (trajectories, outcomes). Chart series colors should use the high-contrast dark palette (e.g. blue-300 / red-300 for OD/OS eye lines) rather than the default light palette.
result: pass

### 5. Audit Filter: Action Category
expected: On the Audit page, a category dropdown (or similar control) is visible. Selecting "auth" filters the log to authentication-related API calls only. Selecting "admin" shows user-management entries. Clearing the filter (selecting "All" / blank) restores the full list.
result: pass

### 6. Audit Filter: Body / Text Search
expected: A text input on the Audit page lets you search by body or query string content. Typing a term (e.g. a username or param name) narrows the list to matching entries. The list updates after a short pause (~300 ms) without a full page reload.
result: pass

### 7. Audit Filter: HTTP Status ≥
expected: A numeric input (or dropdown) on the Audit page lets you filter by minimum HTTP status. Entering 400 shows only entries with status 400 or higher (errors/client issues). Entering a non-numeric value is ignored gracefully (no crash, no empty list).
result: pass
reason: Implemented as a "Failures only" checkbox (sends status_gte=400 server-side). Checkbox confirmed working — test expectation was wrong about the UI shape (input vs checkbox).

## Summary

total: 7
passed: 6
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Switching to dark mode applies dark backgrounds and light text across the dashboard"
  status: failed
  reason: "User reported: The toggle switch changes, but the overall view of the dashboard remains unchanged when changing themes."
  severity: major
  test: 1
  artifacts: [src/pages/LandingPage.tsx, src/components/Layout.tsx]
  missing: [dark: Tailwind variants on LandingPage and Layout wrapper div]
