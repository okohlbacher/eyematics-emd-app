---
phase: 29
slug: home-panel-ux
status: final
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-21
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom per-file via `// @vitest-environment jsdom`; node default) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/<file>` |
| **Full suite command** | `npm run test:ci` |
| **Estimated runtime** | ~25 seconds (full suite, 619 baseline) |

Conventions (CLAUDE.md): no jest-dom; RTL assertions use `queryByText().not.toBeNull()` / `.toBeNull()`. localStorage mocked via `vi.stubGlobal` (see `tests/authHeaders.test.ts`); `MockBroadcastChannel` shim in `tests/setup.ts`.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/<file>` for the touched test file
- **After every plan wave:** Run `npm run test:ci`
- **Before `/gsd-verify-work`:** Full suite must be green (619 baseline must not regress)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | UX-02 | — | per-username key isolates A/B on shared workstation | unit | `npx vitest run tests/recentActivityStore.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UX-02 | — | localStorage failure swallowed (no leak, no crash) | unit | `npx vitest run tests/recentActivityStore.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UX-02 | T-29 logout-clear | recents cleared before user nulled | unit | `npx vitest run tests/recentActivityStore.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UX-01 | — | unknown param falls back to `'all'` silently | unit | `npx vitest run tests/qualityPageDeepLink.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UX-01 | — | deep-link seeds `filterTherapy`/`filterStatus` on mount | integration | `npx vitest run tests/qualityPageDeepLink.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UX-01 | — | Review buttons navigate to locked targets | integration | `npx vitest run tests/landingPageAlerts.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UX-02 | — | Jump Back In renders empty state / rows correctly | integration | `npx vitest run tests/jumpBackIn.test.tsx` | ❌ W0 | ⬜ pending |

*Task IDs assigned by planner; the nyquist auditor finalizes this map. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/recentActivityStore.test.ts` — store unit tests (dedupe/move-to-top, cap-5, clear, clearAll, silent-failure) — pure logic, node env
- [ ] `tests/qualityPageDeepLink.test.tsx` — UX-01 filter seeding from `?therapy=` / `?status=`, plus unknown-value fallback (jsdom)
- [ ] `tests/landingPageAlerts.test.tsx` — UX-01 Review-button navigation targets (jsdom, MemoryRouter + navigate spy)
- [ ] `tests/jumpBackIn.test.tsx` — UX-02 panel empty-state vs rows + row-click navigation (jsdom)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-tab logout clears recents in a second browser tab | UX-02 / D-02 | BroadcastChannel cross-tab behavior is awkward to assert in jsdom (single-context) | Open two tabs signed in as same user, generate recents in tab A, log out in tab B, confirm tab A's Jump Back In is empty after reload |
| Dark-mode token retint of new rows | — (UI-SPEC) | Visual | Toggle theme, confirm Jump Back In rows + dividers retint via CSS custom properties |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-24 (V&V backfill, Phase 35)

Wave 0 scaffolds confirmed GREEN per 29-VERIFICATION.md (status: passed, 754/754); npm run test:ci 901/901.
