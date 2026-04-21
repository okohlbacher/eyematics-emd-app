---
phase: 17
slug: audit-log-upgrade-dark-mode
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.5 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run tests/audit.test.ts tests/auditApi.test.ts tests/outcomesPalette.contrast.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/audit.test.ts tests/auditApi.test.ts tests/outcomesPalette.contrast.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-W0-01 | Wave 0 | 0 | AUDIT-01 | — | N/A | unit | `npx vitest run tests/audit.test.ts` | ✅ extend | ⬜ pending |
| 17-W0-02 | Wave 0 | 0 | AUDIT-01 | — | N/A | unit | `npx vitest run tests/auditApi.test.ts` | ✅ extend | ⬜ pending |
| 17-W0-03 | Wave 0 | 0 | VIS-03 | — | N/A | unit | `npx vitest run tests/outcomesPalette.contrast.test.ts` | ✅ extend | ⬜ pending |
| 17-W0-04 | Wave 0 | 0 | VIS-01 | — | N/A | unit | `npx vitest run tests/outcomesI18n.test.ts` | ✅ extend | ⬜ pending |
| 17-01-01 | 01 | 1 | AUDIT-01 | T-17-01 | `action_category` validated as enum before SQL; non-enum values rejected | unit | `npx vitest run tests/audit.test.ts` | ✅ | ⬜ pending |
| 17-01-02 | 01 | 1 | AUDIT-01 | T-17-02 | `status_gte` parsed as number; NaN rejected | unit | `npx vitest run tests/auditApi.test.ts` | ✅ | ⬜ pending |
| 17-01-03 | 01 | 1 | AUDIT-01 | — | N/A | unit | `npx vitest run tests/audit.test.ts` | ✅ | ⬜ pending |
| 17-02-01 | 02 | 1 | VIS-03 | — | N/A | unit | `npx vitest run tests/outcomesPalette.contrast.test.ts` | ✅ | ⬜ pending |
| 17-02-02 | 02 | 1 | VIS-01 | — | N/A | unit | `npx vitest run tests/outcomesI18n.test.ts` | ✅ | ⬜ pending |
| 17-03-01 | 03 | 2 | VIS-01 | T-17-03 | Theme localStorage only stores `light\|dark\|system`; read validates against enum | manual | Browser: toggle sun/moon/monitor → `<html>` dark class applied | N/A | ⬜ pending |
| 17-03-02 | 03 | 2 | VIS-02 | — | N/A | manual | Browser: dark mode → chart axes/grid render correct colors | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/audit.test.ts` — extend with `action_category` (all 4 values + boundary), `body_search` (LIKE match), `status_gte` (400 threshold) filter cases
- [ ] `tests/auditApi.test.ts` — extend with API param parsing for `action_category` (enum validation), `body_search`, `status_gte` (NaN guard), confirm non-admin auto-scope not bypassed
- [ ] `tests/outcomesPalette.contrast.test.ts` — extend with `DARK_EYE_COLORS >= 4.5:1` and `DARK_COHORT_PALETTES >= 3.0:1` assertions against `#111827`
- [ ] `tests/outcomesI18n.test.ts` (or `tests/phase17I18n.test.ts`) — cover all new `theme*` and `auditFilter*`, `auditCategory*`, `auditEmpty` i18n keys for both EN and DE locales

*Existing infrastructure (vitest, `tests/` directory) is sufficient — no new framework install required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `@custom-variant dark` activates `dark:` classes | VIS-01 | CSS-only — no runtime test can assert Tailwind class expansion | Toggle theme → inspect `<html>`: `dark` class present; verify elements with `dark:bg-*` visually change |
| Recharts internals render correct dark colors | VIS-02 | SVG props not assertable via vitest (no DOM rendering in node env) | Dark mode active → open trajectory chart → confirm axis labels, grid lines, tick text are visible (not black-on-dark) |
| FOUC prevention (no flash on reload) | VIS-01 | Timing-dependent browser behavior | Set dark theme → hard reload → confirm no white flash before dark applies |
| System mode tracks `prefers-color-scheme` | VIS-01 | OS-level media query change cannot be simulated in vitest | Set System mode → use OS/DevTools to toggle dark preference → confirm `<html>` class updates without page reload |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
