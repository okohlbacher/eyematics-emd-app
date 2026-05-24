---
phase: 30
slug: terminology-configuration-docs-cleanup-only
status: final
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-21
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Doc/config-only cleanup phase — no behavioral change. Validation is verification-style
> (grep/file-content assertions) plus a full-suite regression gate.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via `npm run test:ci`) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npm run test:ci` |
| **Full suite command** | `npm run test:ci` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task's grep assertion(s)
- **After the plan completes:** Run `npm run test:ci` (full suite green)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 01 | 1 | TERM-01 | — | N/A (docs) | grep assertion | `! grep -q 'terminology.serverUrl.*https://r4.ontoserver' docs/Konfiguration.md && grep 'terminology.serverUrl' docs/Konfiguration.md \| grep -qiE 'Platzhalter\|Beispiel'` | ✅ | ⬜ pending |
| 30-01-02 | 01 | 1 | TERM-02 | — | N/A (config) | grep assertion | `grep -E '^# +(terminology\|enabled\|serverUrl\|cacheTtlMs)' config/settings.yaml \| wc -l` (≥4, block stays commented) | ✅ | ⬜ pending |
| 30-01-03 | 01 | 1 | TERM-02 | — | N/A (req tracking) | grep assertion | `grep 'TERM-02' .planning/REQUIREMENTS.md` shows `[x]` + traceability "Complete (Phase 30)" | ✅ | ⬜ pending |
| 30-01-R | 01 | 1 | Both | — | No regression | suite | `npm run test:ci` (all green) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* No new test files are needed — verification is grep-based on the three edited files plus the existing Vitest suite. No Wave 0 setup required.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The `docs/Konfiguration.md` table reads cleanly to an operator (Default = empty/undefined; URL clearly an example) | TERM-01 | Human readability/clarity is subjective | Open `docs/Konfiguration.md`, find the `terminology.serverUrl` row, confirm the Default no longer implies the Ontoserver URL is the runtime default and the prose section is unchanged |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none needed)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-21
