---
gsd_state_version: 1.0
milestone: v1.8
milestone_name: TBD
status: planning
stopped_at: v1.7 closed — defining v1.8
last_updated: "2026-04-21T19:20:00.000Z"
last_activity: 2026-04-21
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-21)

**Core value:** Every user sees only authorized data, with tamper-proof audit trail — while `/outcomes` stays fast, visually polished, and useful beyond visus.
**Current focus:** Defining v1.8 milestone scope

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-21

## Milestones Shipped

| Version | Name | Phases | Shipped |
|---------|------|--------|---------|
| v1.0 | Foundational Backend | 1–6 | earlier |
| v1.1 | Frontend ↔ Backend Wiring | — | earlier |
| v1.5 | Site Roster Correction & Cohort Analytics | 7–9 | 2026-04-15 |
| v1.6 | Outcomes Polish & Scale | 10–13 | 2026-04-17 |

## v1.7 Phase Progress

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 14 | Security Quick Wins & Performance | 3/3 | Complete | 2026-04-17 |
| 15 | TOTP 2FA | 4/4 | Complete | 2026-04-21 |
| 16 | Cross-Cohort Comparison | 4/4 | Complete | 2026-04-21 |
| 17 | Audit Log Upgrade & Dark Mode | 5/5 | Complete | 2026-04-21 |
| 18 | Keycloak OIDC Redirect | 0/TBD | Not started | — |

## Accumulated Context

### Decisions (Phase 16)

- COHORT_PALETTES uses 4 fixed colors (emerald-700, amber-700, cyan-700, fuchsia-700) — WCAG 3:1+ against white
- VIS-04: per-patient lines suppressed in cross-mode (isCrossMode guard); desaturated to #9ca3af at 22%/12% opacity; median overplotted at 4px strokeWidth
- `?cohorts=id1,id2,...` URL param drives cross-cohort mode; max 4 cohorts enforced client-side with silent truncation
- CohortCompareDrawer mirrors OutcomesSettingsDrawer slide-over pattern; primary cohort always checked+disabled
- isCrossMode derives from `crossCohortIds.length >= 2` (WR-02 partially addressed in 16-04)

### Blockers/Concerns

- ⚠️ [Phase 16] CR-01: `loginDemoHint` in `src/i18n/translations.ts` embeds hardcoded credentials (`admin2025!`, `forscher2025!`, `123456`) — should be gated behind `import.meta.env.DEV`. Address with `/gsd-code-review-fix 16`.
- ⚠️ [Phase 16] HUMAN-UAT pending: 4 visual checks in `16-HUMAN-UAT.md` need manual browser testing (4-cohort overlay readability, VIS-04 hierarchy, reset flow, settings drawer suppression).
- ⚠️ [Phase 16] WR-01: CohortCompareDrawer close button uses generic i18n key — needs dedicated `outcomesCompareCloseDrawer` key for aria-label.

## Session Continuity

Last session: 2026-04-21T19:12:00.000Z
Stopped at: Phase 17 complete — advancing to Phase 18
Resume file: .planning/phases/18-keycloak-oidc-redirect/18-CONTEXT.md
