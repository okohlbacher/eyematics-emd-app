---
phase: 13
slug: new-outcome-metrics-crt-interval-responder
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.4 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose 2>&1 | tail -20` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose 2>&1 | tail -20`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 0 | METRIC-01 | — | N/A | unit | `npx vitest run tests/crtTrajectory.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | METRIC-01 | — | N/A | unit | `npx vitest run tests/crtTrajectory.test.ts` | ✅ | ⬜ pending |
| 13-02-01 | 02 | 0 | METRIC-02 | — | N/A | unit | `npx vitest run tests/intervalMetric.test.ts` | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 1 | METRIC-02 | — | N/A | unit | `npx vitest run tests/intervalHistogram.test.tsx` | ✅ | ⬜ pending |
| 13-03-01 | 03 | 0 | METRIC-03 | — | N/A | unit | `npx vitest run tests/responderMetric.test.ts` | ❌ W0 | ⬜ pending |
| 13-03-02 | 03 | 1 | METRIC-03 | — | N/A | unit | `npx vitest run tests/responderView.test.tsx` | ✅ | ⬜ pending |
| 13-04-01 | 04 | 1 | METRIC-04 | — | N/A | unit | `npx vitest run tests/metricSelector.test.ts` | ❌ W0 | ⬜ pending |
| 13-05-01 | 05 | 1 | METRIC-05 | — | N/A | unit | `npx vitest run tests/csvExport.test.ts` | ✅ | ⬜ pending |
| 13-06-01 | 06 | 1 | METRIC-06 | — | N/A | unit | `npx vitest run tests/outcomesI18n.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/crtTrajectory.test.ts` — stubs for METRIC-01 (CRT trajectory panel)
- [ ] `tests/intervalHistogram.test.ts` — stubs for METRIC-02 (injection interval histogram)
- [ ] `tests/responderClassification.test.ts` — stubs for METRIC-03 (responder buckets)
- [ ] `tests/metricSelector.test.ts` — stubs for METRIC-04 (metric selector + deep-link)

*Existing infrastructure (outcomesI18n.test.ts, csvExport) covers METRIC-05 and METRIC-06.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CRT panel renders correct sub-panels in browser | METRIC-01 | Visual layout validation | Load `/outcomes?metric=crt`, verify OD/OS/OD+OS tabs, all y-metric toggles, layers |
| Interval histogram renders median annotation | METRIC-02 | Visual rendering | Load `/outcomes?metric=interval`, verify median text annotation on histogram |
| Responder bucket bar chart renders | METRIC-03 | Visual rendering | Load `/outcomes?metric=responder`, verify 3 buckets with counts |
| Metric selector deep-link round-trip | METRIC-04 | Browser state | Set `?metric=responder`, refresh, verify same metric shown |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
