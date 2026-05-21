# Phase 29: Home Panel UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 29-home-panel-ux
**Areas discussed:** Persistence & privacy, UX-01 deep-link targets

---

## Gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Recent record shape | What a "last-visited view" captures/restores (route only vs route+params vs +scroll) | |
| Recording trigger & list | Which navigations count as a visit, max rows, ordering, dedupe | |
| Persistence & privacy | localStorage key scope + clear-on-logout behavior | ✓ |
| UX-01 deep-link targets | Exact destination + query contract per alert button | ✓ |

**User's choice:** Persistence & privacy + UX-01 deep-link targets. The other two areas
delegated to Claude's discretion (captured as guidance in CONTEXT.md).

---

## Persistence & privacy

### Q1 — localStorage key scope

| Option | Description | Selected |
|--------|-------------|----------|
| Per-username | Key includes signed-in username; no cross-user leakage on a shared browser | ✓ |
| Global key | Single shared key; leaks recently-viewed patient IDs across users | |

**User's choice:** Per-username (D-01)

### Q2 — On logout

| Option | Description | Selected |
|--------|-------------|----------|
| Clear on logout | Wipe entries at sign-out; safest for shared workstations | ✓ |
| Persist across sessions | Keep list across re-login; convenient but residual trail | |
| Persist, per-username only | Survive logout but only restored for same user | |

**User's choice:** Clear on logout (D-02)
**Notes:** Both choices align with the project's security-first ethos; clear-on-logout must wire
into the existing session-teardown / cross-tab logout path (Phases 20, 27–28).

---

## UX-01 deep-link targets

### Q1 — Therapy-breaker alert destination

| Option | Description | Selected |
|--------|-------------|----------|
| /quality?therapy=breaker | QualityPage already derives breaker status + has therapy filter | ✓ |
| /cohort with prebuilt filter | Needs new therapy-gap filter type in cohort model | |
| /analysis?filter=<json> | Aggregate-oriented, not a case-review list | |

**User's choice:** /quality?therapy=breaker (D-03)

### Q2 — Implausible-CRT / flagged alert destination

| Option | Description | Selected |
|--------|-------------|----------|
| /quality?status=flagged | QualityPage already filters by quality-flag status | ✓ |
| Keep /doc-quality | Preserves role gate but DocQualityPage has no flag filter yet | |
| You decide | Defer to planner | |

**User's choice:** /quality?status=flagged (D-04)
**Notes:** Both alerts unified onto QualityPage; requires new `?therapy=`/`?status=` read-on-mount
support (D-05). Role visibility of the flagged button to be re-evaluated by planner since /quality
is broadly accessible (ProtectedRoute) vs /doc-quality (QualityRoute).

---

## Claude's Discretion

- Recent-activity **record shape** — route + URL view params (no scroll); minimal & serializable.
- **Recording trigger & list semantics** — record case-detail + quality-review visits;
  most-recent-first; dedupe move-to-top; cap ~5 rows.
- **Role gating** of the flagged Review button after retargeting to /quality.

## Deferred Ideas

- Data-driven "Attention needed" alerts (real counts, deep-link to specific case) — future phase.
- Cross-session / cross-device persistence of recent activity — rejected in favor of D-02.
