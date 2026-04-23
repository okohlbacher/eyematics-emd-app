---
phase: 19
slug: auditpage-state-machine-refactor
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-23
validated: 2026-04-23
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react ^16.3.2 + jsdom |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/auditPageReducer.test.ts tests/auditPageCharacterization.test.tsx` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 s quick / ~30 s full |

---

## Sampling Rate

- **After every task commit:** `npx vitest run tests/auditPageReducer.test.ts tests/auditPageCharacterization.test.tsx`
- **After every plan wave:** `npm test`
- **Before `/gsd-verify-work`:** Full suite green; `npm run build` green; `npm run lint` green
- **Max feedback latency:** ~5 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | AUDIT-02, AUDIT-01(a) | — | Loading render state visible on first mount | RTL | `npx vitest run tests/auditPageCharacterization.test.tsx -t "loading state on mount"` | ✅ | ✅ green |
| 19-01-02 | 01 | 1 | AUDIT-02, AUDIT-01(b) | — | Error render state visible on fetch failure | RTL | `npx vitest run tests/auditPageCharacterization.test.tsx -t "error state on non-OK"` | ✅ | ✅ green |
| 19-01-03 | 01 | 1 | AUDIT-02, AUDIT-01(c) | — | Empty state when filteredEntries.length === 0 | RTL | `npx vitest run tests/auditPageCharacterization.test.tsx -t "empty state"` | ✅ | ✅ green |
| 19-01-04 | 01 | 1 | AUDIT-02, AUDIT-01(d) | — | Populated table renders N rows | RTL | `npx vitest run tests/auditPageCharacterization.test.tsx -t "populated table"` | ✅ | ✅ green |
| 19-01-05 | 01 | 1 | AUDIT-02, AUDIT-01(e) | — | 300 ms debounce on filter change | RTL + waitFor | `npx vitest run tests/auditPageCharacterization.test.tsx -t "debounced refetch"` | ✅ | ✅ green |
| 19-01-06 | 01 | 1 | AUDIT-02, AUDIT-01(f) | — | Cancel-on-unmount (no setState warning, no extra fetch) | RTL | `npx vitest run tests/auditPageCharacterization.test.tsx -t "unmount cancels"` | ✅ | ✅ green |
| 19-01-07 | 01 | 1 | AUDIT-02, AUDIT-01(g) | — | Admin-gated CSV (always) and JSON (admin-only) buttons | RTL | `npx vitest run tests/auditPageCharacterization.test.tsx -t "admin-gated export"` | ✅ | ✅ green |
| 19-01-08 | 01 | 1 | AUDIT-02, AUDIT-01(h) | — | 6-dim filter URL params emit correctly | RTL — assert on authFetch mock call | `npx vitest run tests/auditPageCharacterization.test.tsx -t "6-dim filter URL"` | ✅ | ✅ green |
| 19-01-09 | 01 | 1 | AUDIT-02 | — | Two-commit ordering: characterization commit precedes refactor commit; bisect-friendly | git log review | `git log --oneline -- tests/auditPageCharacterization.test.tsx src/pages/AuditPage.tsx` | ✅ | ✅ green (f2dfe93 before 96ac771) |
| 19-02-01 | 02 | 2 | AUDIT-04 | — | All 5 reducer actions covered | unit | `npx vitest run tests/auditPageReducer.test.ts -t "FILTER_SET\|FILTERS_RESET\|FETCH_START\|FETCH_SUCCESS\|FETCH_ERROR"` | ✅ | ✅ green |
| 19-02-02 | 02 | 2 | AUDIT-04 | — | requestEpoch stale-response guard ignores out-of-order FETCH_SUCCESS / FETCH_ERROR | unit | `npx vitest run tests/auditPageReducer.test.ts -t "stale epoch"` | ✅ | ✅ green |
| 19-02-03 | 02 | 2 | AUDIT-01(i) | — | `selectFilteredEntries` filters out noise GETs (mirrors `isRelevantEntry`) | unit | `npx vitest run tests/auditPageReducer.test.ts -t "selectFilteredEntries"` | ✅ | ✅ green |
| 19-02-04 | 02 | 2 | AUDIT-01(j) | — | `describeAction` / `describeDetail` byte-identical outputs for all known method/path pairs | unit | `npx vitest run tests/auditPageReducer.test.ts -t "describeAction\|describeDetail"` | ✅ | ✅ green |
| 19-02-05 | 02 | 2 | AUDIT-03 | — | Files exist at exact paths; AuditPage.tsx contains no useState/useEffect in its body | static | `test -f src/pages/audit/auditPageState.ts && test -f src/pages/audit/auditFormatters.ts && test -f src/pages/audit/useAuditData.ts && ! grep -E "useState\|useEffect" src/pages/AuditPage.tsx` | ✅ | ✅ green |
| 19-02-06 | 02 | 2 | AUDIT-01..04 | — | Characterization tests still green after refactor (no behavior drift) | RTL | `npx vitest run tests/auditPageCharacterization.test.tsx` | ✅ | ✅ green (11/11) |
| 19-02-07 | 02 | 2 | AUDIT-01..04 | — | Full suite + build + lint green (Phase-19 surface; 3 pre-existing unrelated test failures + pre-existing lint errors documented) | suite | `npm test && npm run build && npm run lint` | ✅ | ⚠️ partial — phase-19 tests green; pre-existing failures in outcomesPanelCrt + OutcomesPage tests unrelated to phase 19 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/auditPageCharacterization.test.tsx` — characterization spec for AUDIT-01 (a)–(h)
- [x] `tests/auditPageReducer.test.ts` — reducer + selectors + formatters spec for AUDIT-04 + AUDIT-01 (i)–(j)
- [x] `src/pages/audit/auditPageState.ts` — `AuditFilters`, `AuditState`, `AuditAction`, `auditReducer`, `initialState`, selectors
- [x] `src/pages/audit/auditFormatters.ts` — verbatim move of `describeAction`, `describeDetail`, `isRelevantEntry`, `statusBadgeClass`
- [x] `src/pages/audit/useAuditData.ts` — hook owning reducer + 300 ms debounce + AbortController
- [x] `src/pages/AuditPage.tsx` — render-only (consumes hook)

(No framework install needed — Vitest + RTL + jsdom already present.)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-commit ordering preserved on push | AUDIT-02 | Git history check; tooling can grep but human confirms intent | `git log --oneline -- tests/auditPageCharacterization.test.tsx src/pages/AuditPage.tsx` shows test commit hash strictly before refactor commit hash on the merged branch (verified: f2dfe93 → 96ac771) |
| Visual regression of audit page in browser (light + dark mode, admin + non-admin role) | AUDIT-01 | RTL doesn't render dark-mode CSS variables | Open `/audit` as `admin` and as `forscher1`; verify export buttons gating, filter row layout, 4 render states (loading on hard refresh, empty on impossible filter, error by stopping Express, populated default state) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5 s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-23

---

## Validation Audit 2026-04-23

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 15 per-task entries verified COVERED against the live codebase:
- `tests/auditPageCharacterization.test.tsx` — 11/11 green
- `tests/auditPageReducer.test.ts` — 36/36 green
- `src/pages/audit/{auditPageState,auditFormatters,useAuditData}.ts` — all present
- `src/pages/AuditPage.tsx` — no useState/useEffect in body; authFetch retained only for handleExportJson (2 occurrences: import + call, per plan note)
- Commit order: `f2dfe93` (test) strictly precedes `96ac771` (refactor) ✓

No auditor spawn needed — gap count = 0.
