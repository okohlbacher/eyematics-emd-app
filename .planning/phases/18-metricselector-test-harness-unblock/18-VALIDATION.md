---
phase: 18
slug: metricselector-test-harness-unblock
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/metricSelector.test.tsx tests/OutcomesViewRouting.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick targeted command for the affected test file
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | MSEL-06 | — | N/A | unit | `npx vitest run tests/OutcomesViewRouting.test.tsx` | ✅ | ⬜ pending |
| 18-01-02 | 01 | 1 | MSEL-06 | — | N/A | unit | `test -f tests/helpers/renderOutcomesView.tsx` | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 2 | MSEL-01 | — | N/A | unit | `npx vitest run tests/metricSelector.test.tsx` | ✅ | ⬜ pending |
| 18-02-02 | 02 | 2 | MSEL-02 | — | N/A | unit | `npx vitest run tests/metricSelector.test.tsx -t 'deep-link'` | ✅ | ⬜ pending |
| 18-02-03 | 02 | 2 | MSEL-03 | — | N/A | unit | `npx vitest run tests/metricSelector.test.tsx -t 'unknown'` | ✅ | ⬜ pending |
| 18-02-04 | 02 | 2 | MSEL-04 | — | N/A | unit | `npx vitest run tests/metricSelector.test.tsx -t 'back'` | ✅ | ⬜ pending |
| 18-02-05 | 02 | 2 | MSEL-05 | — | N/A | unit | `npx vitest run tests/metricSelector.test.tsx -t 'arrow'` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/helpers/renderOutcomesView.tsx` — shared render factory + 7 vi.mock blocks + MemoryRouter wrapper
- [ ] Delete duplicate `tests/metricSelector.test.ts` (byte-identical to `.tsx`)

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
