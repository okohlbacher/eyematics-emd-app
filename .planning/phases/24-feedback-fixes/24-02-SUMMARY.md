---
phase: 24-feedback-fixes
plan: 02
subsystem: home-attention-panel
tags: [ui, navigation, tests, fb-02]
requires:
  - 24-01 (no functional dependency, but waved sequentially per D-19)
provides:
  - "Attention panel Review buttons wired to real routes (D-06..D-08)"
  - "QUALITY_ROLES gate on /doc-quality entry from Home (D-07 fallback 2)"
affects:
  - src/pages/LandingPage.tsx
  - tests/LandingPage.test.tsx
tech-stack:
  added: []
  patterns:
    - "useNavigate + role-gated CTA pattern reused from Layout/admin entry points"
key-files:
  created:
    - tests/LandingPage.test.tsx
  modified:
    - src/pages/LandingPage.tsx
decisions:
  - "Therapy-breakers → /cohort (cohort-shaped intent matches the panel copy)"
  - "Implausible-CRT → /doc-quality (plausibility metric lives there)"
  - "Hide implausible-CRT Review button for non-QUALITY_ROLES users (D-07 step 2) instead of removing the row, so admin/clinic_lead/data_manager still see the affordance and the panel content stays informative for everyone else"
  - "No new i18n keys needed — reused existing review/attention* keys"
metrics:
  duration: ~10 min
  completed: 2026-04-28
  tasks: 2
  commits: 2
  test_count_before: 607
  test_count_after: 612
---

# Phase 24 Plan 02: Attention Panel Review Buttons Summary

Wire (or role-gate) every Home-page "Attention needed" Review button so no dead onClick ships, and add a five-case regression test that locks the wiring + role gate in place.

## What changed

`src/pages/LandingPage.tsx`
- Imported `useNavigate` from `react-router-dom` and `QUALITY_ROLES` from `AuthContext`.
- Pulled `user` out of `useAuth()` and computed `canSeeDocQuality = QUALITY_ROLES.includes(user.role)`.
- Therapy-breakers Review button now `onClick={() => navigate('/cohort')}`.
- Implausible-CRT Review button now `onClick={() => navigate('/doc-quality')}` and is rendered conditionally on `canSeeDocQuality` — non-QUALITY_ROLES users (e.g. researcher) no longer see a button that would route to a 403 redirect.

`tests/LandingPage.test.tsx` (new)
- Five cases: therapy-breakers → /cohort, implausible-CRT → /doc-quality (admin), implausible-CRT button hidden for researcher, every rendered Review button has a non-null onClick (D-08 lock), Attention header still renders.
- Uses MemoryRouter + a `useLocation` effect spy. Adheres to CLAUDE.md "no jest-dom" rule (`queryByText().not.toBeNull()`, `expect(...).toBe('/cohort')`).

## Routes considered & rejected

- `/quality` (cohort-level quality view) — therapy breakers are a cohort-shaping concept, not a quality metric. `/cohort` is the closer match.
- `/analysis` for therapy breakers — too specific (analysis is per-cohort outcome trajectories); panel intent is "go look at the breakers cohort", not "analyse outcomes".
- Removing the implausible-CRT row entirely (D-07 step 3) — rejected because the row carries informational value (count + sub-text) for *every* user; only the action target is role-gated, so step 2 (hide the button) is the right knob.

## Deviations from Plan

### Tooling deviation (noted, not a code change)

**Write/Edit tools were sandboxed in this worktree** — Write/Edit reported success but did not persist to the working tree on disk (`git status` stayed clean and `git hash-object` matched HEAD even after multiple "successful" Edit calls). Confirmed by writing a marker file via Bash echo (worked) and via Write (silently dropped). Workaround: applied all file mutations through small Bash + python heredoc scripts. All committed changes are real and verified by `git diff` and the test suite. No code-level deviation from the plan.

### No code deviations

Plan executed exactly as written: 2 tasks, 2 commits, no Rule 1/2/3 auto-fixes needed beyond what the plan already prescribed.

## Verification

- `npm run lint` — clean
- `npm run build` — clean (chunk-size warning is pre-existing)
- `npm run test:ci` — 612/612 passed (607 baseline after 24-01 + 5 new)
- `npm run knip` — no new unused/unlisted findings
- `grep -n "Button variant="ghost" size="sm"" src/pages/LandingPage.tsx` — both Review buttons carry an onClick

## Commits

- `78ba27e` fix(24-02): wire (or hide) Review buttons in Attention needed panel (FB-02)
- `c9fa74f` test(24-02): assert Attention panel Review buttons navigate or are absent (FB-02)

## Self-Check: PASSED

- FOUND: src/pages/LandingPage.tsx (with useNavigate + canSeeDocQuality gate)
- FOUND: tests/LandingPage.test.tsx (5 tests, all passing)
- FOUND: 78ba27e
- FOUND: c9fa74f
