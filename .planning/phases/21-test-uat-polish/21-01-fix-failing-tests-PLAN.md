---
phase: 21-test-uat-polish
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/outcomesPanelCrt.test.tsx
  - src/components/outcomes/OutcomesView.tsx
  - scripts/check-skipped-tests.mjs
  - package.json
autonomous: true
requirements: [TEST-01, TEST-02, TEST-03, TEST-04]
gap_closure: false

must_haves:
  truths:
    - "tests/outcomesPanelCrt.test.tsx passes with zero failures (visus absolute + backward-compat cases green)"
    - "tests/OutcomesPage.test.tsx 'fires audit beacon POST' test passes (credentials: 'include' present in beacon init)"
    - "npm run test:ci exits 0 — vitest suite green + zero unexplained .skip usages"
    - "A grep-based CI gate fails the build on any describe.skip/it.skip/test.skip lacking a SKIP_REASON: comment"
  artifacts:
    - path: "tests/outcomesPanelCrt.test.tsx"
      provides: "Updated y-domain assertions to [0, 1] (logMAR)"
      contains: "toEqual([0, 1])"
    - path: "src/components/outcomes/OutcomesView.tsx"
      provides: "Audit beacon with credentials:'include' (Phase 20 cookie-auth)"
      contains: "credentials: 'include'"
    - path: "scripts/check-skipped-tests.mjs"
      provides: "Zero-skip CI gate"
      contains: "SKIP_REASON"
    - path: "package.json"
      provides: "test:ci + test:check-skips scripts"
      contains: "test:check-skips"
  key_links:
    - from: "package.json"
      to: "scripts/check-skipped-tests.mjs"
      via: "npm run test:check-skips script"
      pattern: "check-skipped-tests"
    - from: "src/components/outcomes/OutcomesView.tsx"
      to: "tests/OutcomesPage.test.tsx (Phase 11 beacon contract)"
      via: "credentials: 'include' on authFetch init"
      pattern: "credentials:\\s*'include'"
---

<objective>
Green the 3 pre-existing failing tests in the Phase 21 scope and install a zero-skipped-tests
CI gate. Two outcomesPanelCrt cases are **test-side drift** (assertions expect [0,2], source
correctly emits [0,1] per admin-feedback Apr-17; v1.6 commit 668bfaf). One OutcomesPage case
is **source-side drift** (beacon missing `credentials: 'include'` from the Phase 20 cookie
auth contract). Add `scripts/check-skipped-tests.mjs` + `test:ci` script to enforce TEST-04.

Purpose: Unblocks CI for every subsequent refactor in v1.9. Without this, Phase 22 has no
trustworthy safety net.
Output: 2 test-file edits, 1 source one-liner, 1 new script, 1 package.json script block.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/21-test-uat-polish/21-CONTEXT.md
@.planning/phases/21-test-uat-polish/21-RESEARCH.md
@.planning/phases/21-test-uat-polish/21-VALIDATION.md
@tests/outcomesPanelCrt.test.tsx
@tests/OutcomesPage.test.tsx
@src/components/outcomes/OutcomesPanel.tsx
@src/components/outcomes/OutcomesView.tsx
@package.json

<interfaces>
From src/components/outcomes/OutcomesPanel.tsx:49-76 (per RESEARCH Primary sources):
```typescript
// yDomain() returns [0, 1] for visus absolute (logMAR 0–1.0 covers 20/200→20/20)
// Admin feedback Apr-17, shipped in v1.6 commit 668bfaf — AUTHORITATIVE
// CRT returns [0, 800] (µm clinical range)
```

From src/components/outcomes/OutcomesView.tsx:158-180 (audit beacon useEffect):
```typescript
authFetch('/api/audit/events/view-open', {
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'Content-Type': 'application/json' },
  keepalive: true,
  // MISSING: credentials: 'include'  ← TEST-03 contract
}).catch(() => { /* beacon is fire-and-forget */ });
```

From tests/OutcomesPage.test.tsx (around line 311-342): asserts
`expect(init?.credentials).toBe('include')` — fails with "expected undefined to be 'include'".
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Update outcomesPanelCrt y-domain assertions to [0, 1]</name>
  <files>tests/outcomesPanelCrt.test.tsx</files>
  <read_first>
    - tests/outcomesPanelCrt.test.tsx (full file — understand assertion sites)
    - src/components/outcomes/OutcomesPanel.tsx lines 49-76 (yDomain() source of truth)
    - .planning/phases/21-test-uat-polish/21-RESEARCH.md (Pitfall 2 — source is canonical, test is stale)
    - .planning/phases/21-test-uat-polish/21-CONTEXT.md (D-07, D-08 — root-cause-first; D-09 minimal-scoped)
  </read_first>
  <behavior>
    - "visus absolute mode: y-domain is [0, 1]" — assertion updated from [0, 2] to [0, 1]
    - "backward compat: no metric prop defaults to visus absolute [0, 1]" — same update
    - describe/it TITLE text updated from "[0, 2]" to "[0, 1]" (strings must not lie)
    - Inline comments near the assertions updated to reference "logMAR 0–1.0 (admin Apr-17, v1.6 commit 668bfaf)"
    - No source file touched for TEST-01/TEST-02
  </behavior>
  <action>
    1. Open tests/outcomesPanelCrt.test.tsx. Find the two failing cases:
       - `it('visus absolute mode: y-domain is [0, 2]', ...)` → rename title to `'visus absolute mode: y-domain is [0, 1]'`
       - `it('backward compat: no metric prop defaults to visus absolute [0, 2]', ...)` → rename title to `'backward compat: no metric prop defaults to visus absolute [0, 1]'`
    2. In each case body, update assertions from `toEqual([0, 2])` (or equivalent) to `toEqual([0, 1])`. Search the file for `[0, 2]` literal and `0, 2` in any related context.
    3. Replace any inline describe-block comments about the `[0, 2]` contract with: `// Phase 13 Plan 02 guard, updated v1.9 Phase 21: source emits [0, 1] per admin Apr-17 (commit 668bfaf)`.
    4. DO NOT touch src/components/outcomes/OutcomesPanel.tsx — source is authoritative.
    5. Commit message: `test(21-01): fix outcomesPanelCrt visus y-domain assertions to [0,1] (TEST-01, TEST-02)` — body notes test-side drift per RESEARCH (D-07 root-cause decision).
  </action>
  <verify>
    <automated>npx vitest run tests/outcomesPanelCrt.test.tsx --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run tests/outcomesPanelCrt.test.tsx` exits 0
    - `grep -c "\\[0, 2\\]" tests/outcomesPanelCrt.test.tsx` returns 0
    - `grep -c "\\[0, 1\\]" tests/outcomesPanelCrt.test.tsx` returns ≥ 2
    - `grep -c "admin Apr-17" tests/outcomesPanelCrt.test.tsx` returns ≥ 1
    - `git diff src/components/outcomes/OutcomesPanel.tsx` is empty (source untouched)
  </acceptance_criteria>
  <done>Both previously-failing outcomesPanelCrt tests pass; no source file modified; commit logged with TEST-01/TEST-02 tags.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add credentials: 'include' to OutcomesView audit beacon (source fix)</name>
  <files>src/components/outcomes/OutcomesView.tsx</files>
  <read_first>
    - src/components/outcomes/OutcomesView.tsx lines 158-180 (beacon useEffect)
    - tests/OutcomesPage.test.tsx lines 311-342 (Phase 11 beacon test — assertion shape)
    - src/services/authHeaders.ts (authFetch — confirm it does NOT default credentials:'include' for callers)
    - .planning/phases/21-test-uat-polish/21-RESEARCH.md (Example 7 — exact patch; Pitfall 1 — why not fix authFetch)
    - .planning/phases/21-test-uat-polish/21-CONTEXT.md (D-09 minimal scoped source fix)
    - .planning/milestones/v1.8-phases/20-jwt-refresh-flow-session-resilience/20-04-SUMMARY.md (cookie-auth contract reference)
  </read_first>
  <behavior>
    - OutcomesView audit beacon at line ~171 passes `credentials: 'include'` in the authFetch init
    - tests/OutcomesPage.test.tsx "fires audit beacon POST with JSON body, keepalive, and no cohort id in URL (Phase 11)" passes
    - No other authFetch call site changed (minimal scoped fix per D-09)
    - authFetch itself NOT modified (avoids broadcast impact per RESEARCH Pitfall 1)
  </behavior>
  <action>
    1. Open src/components/outcomes/OutcomesView.tsx. Locate the beacon useEffect around line 158-180 that calls
       `authFetch('/api/audit/events/view-open', { method: 'POST', body: ..., headers: ..., keepalive: true })`.
    2. Add a single init field: `credentials: 'include',` — place it immediately after `keepalive: true,`.
    3. Add an inline comment on the new line verbatim: `// Phase 20 cookie-auth contract (TEST-03, v1.9 Phase 21)`.
    4. Leave every other file untouched. Do NOT modify src/services/authHeaders.ts (would ripple to 25+ call sites).
    5. Run the impacted test file to confirm greening. Expected pre-fix failure message is
       `expected undefined to be 'include'`; post-fix should be green.
    6. Commit: `fix(21-01): add credentials:'include' to OutcomesView audit beacon (TEST-03)` — body notes source drift per RESEARCH, Phase 20 cookie-auth contract.
  </action>
  <verify>
    <automated>npx vitest run tests/OutcomesPage.test.tsx -t "fires audit beacon POST" --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run tests/OutcomesPage.test.tsx -t "fires audit beacon POST"` exits 0
    - `grep -c "credentials: 'include'" src/components/outcomes/OutcomesView.tsx` returns ≥ 1
    - `grep -c "Phase 20 cookie-auth contract" src/components/outcomes/OutcomesView.tsx` returns ≥ 1
    - `git diff src/services/authHeaders.ts` is empty (authFetch untouched)
  </acceptance_criteria>
  <done>Beacon test passes; source change is one-line-only + one comment; authFetch untouched.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Create scripts/check-skipped-tests.mjs + wire test:ci / test:check-skips in package.json</name>
  <files>scripts/check-skipped-tests.mjs, package.json</files>
  <read_first>
    - .planning/phases/21-test-uat-polish/21-RESEARCH.md (Example 6 — verbatim grep script source)
    - .planning/phases/21-test-uat-polish/21-CONTEXT.md (D-10, D-11 — grep policy, SKIP_REASON format)
    - package.json (current scripts block — know what exists)
    - tests/ directory listing (confirm zero existing .skip per RESEARCH Grep verification)
  </read_first>
  <behavior>
    - `node scripts/check-skipped-tests.mjs` exits 0 when no unexplained .skip exists
    - `node scripts/check-skipped-tests.mjs` exits 1 and lists violations when any describe.skip/it.skip/test.skip appears without a `// SKIP_REASON:` comment on the immediately preceding line
    - `npm run test:check-skips` invokes the script
    - `npm run test:ci` runs `test:check-skips` AND the vitest suite (chained with &&), exiting non-zero if either fails
    - Script header documents known grep limitations (e.g., it['skip'](...) evasion) and defers AST-based enforcement to Phase 23
  </behavior>
  <action>
    1. Create scripts/check-skipped-tests.mjs with the EXACT content from RESEARCH.md Example 6 (Code Examples section). Use Node ESM (`.mjs`, `import` syntax), no dependencies beyond `node:fs` + `node:path`.
    2. Regex constants (verbatim from RESEARCH):
       - `const SKIP_RE = /\\b(describe|it|test)\\.skip\\s*\\(/;`
       - `const REASON_RE = /^\\s*\\/\\/\\s*SKIP_REASON:/;`
    3. Walk `tests/` recursively, read each `*.test.ts` / `*.test.tsx`, and for every line matching SKIP_RE check that the immediately-preceding line matches REASON_RE. Violations print as `${file}:${lineNo}  ${lineText}` and exit 1.
    4. Add a top-of-file comment: `// TEST-04 CI gate: forbid describe.skip/it.skip/test.skip in tests/** without a SKIP_REASON: comment on the prior line. Known limitation: alternative constructs like it['skip']() or aliased variables are not detected — ESLint-based enforcement deferred to v1.9 Phase 23 (D-11).`
    5. In package.json `scripts` block, add (in this order, preserving existing scripts):
       - `"test:check-skips": "node scripts/check-skipped-tests.mjs"`
       - `"test:ci": "npm run test:check-skips && npm test"`
       Do NOT rename or remove existing scripts (Phase 23 scope per D-11).
    6. Verify empty-baseline: since RESEARCH confirms zero existing .skip usages in tests/**, the first run must exit 0.
    7. Commit: `chore(21-01): add zero-skip CI gate + test:ci script (TEST-04)`.
  </action>
  <verify>
    <automated>node scripts/check-skipped-tests.mjs && npm run test:ci</automated>
  </verify>
  <acceptance_criteria>
    - `node scripts/check-skipped-tests.mjs` exits 0 (baseline clean per RESEARCH grep)
    - `npm run test:check-skips` exits 0
    - `npm run test:ci` exits 0 (full suite green after Tasks 1–2)
    - `grep -c "test:check-skips" package.json` returns ≥ 2 (definition + ci chain)
    - `grep -c "test:ci" package.json` returns ≥ 1
    - `grep -c "SKIP_REASON" scripts/check-skipped-tests.mjs` returns ≥ 1
    - Simulated violation test: temporarily add `it.skip('x', () => {})` without comment in any tests/*.test.ts, re-run script, confirm exit 1; revert.
  </acceptance_criteria>
  <done>Zero-skip gate is live; test:ci script chains skip-gate + vitest; baseline run is green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → /api/audit/events/view-open | Authenticated audit beacon crossing cookie-auth boundary (Phase 20 contract) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-21-01 | Repudiation | src/components/outcomes/OutcomesView.tsx audit beacon | mitigate | Task 2 adds `credentials: 'include'` so the beacon carries the session cookie; otherwise audit entries would be orphaned from the authenticated session, undermining non-repudiation. Severity: low (audit accuracy, not auth bypass). |
| T-21-02 | Tampering | tests/** skip policy | mitigate | Task 3 installs grep gate; prevents regression where a test is silently skipped and a security contract stops being verified. Severity: low. |
</threat_model>

<verification>
- `npm run test:ci` exits 0 end-to-end
- `npx vitest run tests/outcomesPanelCrt.test.tsx` green
- `npx vitest run tests/OutcomesPage.test.tsx` green
- `node scripts/check-skipped-tests.mjs` green
- No source file outside `src/components/outcomes/OutcomesView.tsx` modified
</verification>

<success_criteria>
- 3 previously-failing tests now pass (TEST-01, TEST-02, TEST-03)
- Zero-skip CI gate live and baseline-green (TEST-04)
- Phase 22/23 now have a trustworthy safety net for refactors
</success_criteria>

<output>
After completion, create `.planning/phases/21-test-uat-polish/21-01-SUMMARY.md` documenting:
- Per-test root-cause decisions (test-side vs source-side, per D-07)
- Commits in order with messages
- Baseline `npm run test:ci` output (exit 0)
</output>
