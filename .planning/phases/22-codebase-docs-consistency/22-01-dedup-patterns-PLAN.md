---
phase: 22-codebase-docs-consistency
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/cohortTrajectory.ts
  - src/services/fhirLoader.ts
  - src/types/fhir.ts
  - src/components/outcomes/OutcomesPanel.tsx
  - src/services/outcomesAggregateService.ts
  - server/hashCohortId.ts
  - server/outcomesAggregateApi.ts
  - src/context/DataContext.tsx
  - src/context/AuthContext.tsx
  - src/components/outcomes/OutcomesView.tsx
  - src/pages/LoginPage.tsx
  - src/pages/AdminPage.tsx
  - src/pages/SettingsPage.tsx
  - server/index.ts
autonomous: true
requirements: [CONSIST-01, CONSIST-02]
must_haves:
  truths:
    - "Phase 12 backward-compat shims are either deleted (with callers migrated) or carry an inline `// retained: <concrete reason>` comment per D-06"
    - "Zero `.then(` chains remain in the 7 identified caller files (fire-and-forget sites may use `void (async () => { ... })()` IIFE)"
    - "Result-type audit documented (0 occurrences confirmed; D-03 retroactively satisfied)"
    - "Naming confirmation-pass recorded in SUMMARY (no TS-identifier rewrites needed; all snake_case matches are D-05-exempt wire strings)"
    - "`npm run test:ci` exits 0 with 608/608 passing tests after every atomic commit in this plan"
  artifacts:
    - path: "shared/cohortTrajectory.ts"
      provides: "Canonical cohort trajectory math (import target post-shim-inlining)"
    - path: "shared/fhirQueries.ts"
      provides: "Canonical FHIR query builders"
    - path: "shared/fhirCodes.ts"
      provides: "Canonical FHIR code constants"
    - path: "shared/patientCases.ts"
      provides: "Canonical patient-cases helpers"
    - path: "shared/outcomesProjection.ts"
      provides: "Canonical outcomes projection helpers"
  key_links:
    - from: "All callers of src/utils/cohortTrajectory"
      to: "shared/cohortTrajectory"
      via: "direct import (shim removed or retained+documented)"
      pattern: "from ['\"]shared/cohortTrajectory['\"]"
    - from: "7 files with .then chains"
      to: "async/await style"
      via: "rewrite per D-04; useEffect uses inner-async-function pattern"
      pattern: "await "
---

<objective>
Plan 22-01 (Wave 1): Dedup + pattern alignment.

Scope per D-15 (RESEARCH reality check):
1. Inline or document-retention the 7 Phase 12 backward-compat shim files
2. Rewrite 15 `.then(` chains across 7 files to async/await per D-04 (IIFE for fire-and-forget; inner-async pattern in useEffect)
3. Record a Result-type audit (0 occurrences, D-03 satisfied retroactively — D-16)
4. Record a D-05 naming confirmation-pass (no rewrites — D-17)

Purpose: Eliminate surviving duplication and establish one canonical async pattern across the codebase so that Plan 22-02's dead-code and type work operates on a consolidated surface.

Output: One commit per shim target (per D-06 retain-or-delete decision), one commit per .then-file rewrite, and a SUMMARY documenting the Result-type and naming audits.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/22-codebase-docs-consistency/22-CONTEXT.md
@.planning/phases/22-codebase-docs-consistency/22-RESEARCH.md
@.planning/phases/22-codebase-docs-consistency/22-VALIDATION.md

<interfaces>
Canonical shared/ modules (targets — DO NOT modify; shims import from here):

From shared/cohortTrajectory.ts: exports cohort trajectory math (consumed via shim `src/utils/cohortTrajectory.ts`)
From shared/fhirQueries.ts: 36-line file; FHIR query builders (re-exported via `src/services/fhirLoader.ts`)
From shared/fhirCodes.ts: FHIR code constants
From shared/patientCases.ts: patient-case helpers
From shared/outcomesProjection.ts: outcomes projection helpers (re-exported via `src/services/outcomesAggregateService.ts`)

Canonical async pattern (D-04) — useEffect inner-async-function:

```typescript
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const resp = await authFetch('/api/...');
      const data = await resp.json();
      if (!cancelled) setState(data);
    } catch (err) {
      if (!cancelled) console.error(err);
    }
  })();
  return () => { cancelled = true; };
}, []);
```

Fire-and-forget IIFE (D-04 permitted):

```typescript
void (async () => {
  await authFetch('/api/audit/events/view-open', { method: 'POST' });
})();
```

`Promise.all` / `Promise.race` remain allowed (D-04 explicit exception).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Audit and resolve the 7 Phase 12 backward-compat shim files</name>
  <files>
    src/utils/cohortTrajectory.ts,
    src/services/fhirLoader.ts,
    src/types/fhir.ts,
    src/components/outcomes/OutcomesPanel.tsx,
    src/services/outcomesAggregateService.ts,
    server/hashCohortId.ts,
    server/outcomesAggregateApi.ts
  </files>
  <read_first>
    src/utils/cohortTrajectory.ts,
    shared/cohortTrajectory.ts,
    src/services/fhirLoader.ts,
    shared/fhirQueries.ts,
    shared/fhirCodes.ts,
    shared/patientCases.ts,
    src/types/fhir.ts,
    src/components/outcomes/OutcomesPanel.tsx,
    src/services/outcomesAggregateService.ts,
    shared/outcomesProjection.ts,
    server/hashCohortId.ts,
    server/outcomesAggregateApi.ts
  </read_first>
  <action>
For each of the 7 shim files, perform this per-file sequence (one atomic commit per file):

1. Diff the shim against its canonical source. Confirm it is a re-export / backward-compat shim (not live logic).
2. Run `grep -rn "from ['\"]<shim-path-without-ext>['\"]" src/ server/ shared/ tests/ scripts/` to find all static importers.
3. Also `grep -rn "<bare-filename>" src/ server/ shared/ tests/ scripts/ --include="*.ts" --include="*.tsx" --include="*.json"` to catch dynamic imports / Vite aliases (Pitfall 3).
4. Decision per D-06:
   - **If all callers can be migrated to the canonical path:** Update every import to point to the `shared/` canonical path, then `git rm` the shim. Example: `src/utils/cohortTrajectory.ts` → rewrite all `from '../utils/cohortTrajectory'` and `from 'src/utils/cohortTrajectory'` to `from 'shared/cohortTrajectory'`, then delete the shim.
   - **If the shim must stay (e.g., `server/hashCohortId.ts` and `server/outcomesAggregateApi.ts` whose "shim" comments are about settings-init / compat, NOT dedup targets per RESEARCH §Dedup Candidates):** Add a single-line `// retained: <concrete reason — e.g., settings-init boundary; not a dedup target per Phase 22 RESEARCH §Dedup Candidates>` comment at the top of the file.
5. After each file's decision, run `npm run test:ci` AND `npm run build` (Pitfall 3 — bundler catches dynamic resolution). If either fails, revert and mark file "retained" with justification.
6. Commit per D-10 with message `refactor(22-01): dedup shim <file> (delete|retain) per D-06`.

Apply this to all 7 files. At minimum, `src/utils/cohortTrajectory.ts` is a confirmed 3-line re-export shim and is the canonical delete target. The two server `*.ts` "shims" per RESEARCH likely stay as `// retained:` because their shim-comments are about non-dedup concerns.

Do NOT manufacture duplication per D-15. If a file does not re-export from `shared/`, do not invent a move.
  </action>
  <verify>
    <automated>npm run test:ci</automated>
  </verify>
  <acceptance_criteria>
    - `npm run test:ci` exits 0 with 608 passing tests (D-10 safety net) after EACH per-shim commit
    - `npm run build` exits 0 after each shim deletion (Pitfall 3 guard)
    - `grep -rn "from ['\"].*utils/cohortTrajectory['\"]" src/ server/ shared/ tests/` returns 0 matches if the shim was deleted (all callers migrated)
    - Every shim NOT deleted contains an inline `// retained:` comment with a concrete reason (grep-verified)
    - Git log shows one commit per shim target (atomic dedup per D-06)
  </acceptance_criteria>
  <done>
    All 7 shim files are either git-removed (with callers migrated to canonical `shared/` imports) OR carry an inline `// retained: <concrete reason>` comment. Full test suite passes after every commit. Build succeeds.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Rewrite 15 `.then(` chains across 7 files to async/await (D-04)</name>
  <files>
    src/context/DataContext.tsx,
    src/context/AuthContext.tsx,
    src/components/outcomes/OutcomesView.tsx,
    src/pages/LoginPage.tsx,
    src/pages/AdminPage.tsx,
    src/pages/SettingsPage.tsx,
    server/index.ts
  </files>
  <read_first>
    src/context/DataContext.tsx,
    src/context/AuthContext.tsx,
    src/components/outcomes/OutcomesView.tsx,
    src/pages/LoginPage.tsx,
    src/pages/AdminPage.tsx,
    src/pages/SettingsPage.tsx,
    server/index.ts
  </read_first>
  <action>
For each of the 7 files (one atomic commit per file):

1. Find every `.then(` occurrence: `grep -n "\.then(" <file>`.
2. Classify each site:
   - **Inside a `useEffect`** → rewrite using the inner-async-function pattern shown in `<interfaces>`. NEVER make the effect callback itself `async` (Pitfall 2).
   - **Inside an event handler** (onClick, onSubmit, etc.) → rewrite as `async` handler with `try/catch`.
   - **Fire-and-forget beacon** (e.g., `OutcomesView.tsx` line ~171 audit beacon) → rewrite as `void (async () => { await authFetch(...); })();` OR leave as a single `.then` with an inline `// retained: fire-and-forget beacon per D-04 allowance` comment. Planner discretion — pick one per file and document in commit message.
   - **`Promise.all` / `Promise.race` orchestration** → LEAVE (D-04 explicit exception).
3. Preserve error-handling semantics: every awaited call that had a `.catch(...)` gets an equivalent `try/catch`.
4. Run `npx vitest run <related-test-file>` for the module under edit, then `npm run test:ci` before committing.
5. Commit per-file with message `refactor(22-01): rewrite .then -> async/await in <file> per D-04`.

Expected net count after: `grep -rn "\.then(" src/ server/ shared/ --include="*.ts" --include="*.tsx" | wc -l` returns either 0 OR a small number equal to the count of intentionally-retained fire-and-forget sites (each of which carries an inline `// retained:` comment).
  </action>
  <verify>
    <automated>npm run test:ci</automated>
  </verify>
  <acceptance_criteria>
    - `npm run test:ci` exits 0 with 608 passing tests after EACH per-file commit
    - No `useEffect(async () => ...)` anywhere: `grep -rnE "useEffect\(\s*async" src/` returns 0 (Pitfall 2 guard)
    - Post-rewrite `.then(` count: every remaining `.then(` site in the 7 listed files has an adjacent `// retained:` comment (grep-verified)
    - 7 atomic commits present in git log, one per file
  </acceptance_criteria>
  <done>
    All 15 identified `.then(` sites are either rewritten to async/await or explicitly retained with justification. No `useEffect` callback is itself async. Full test suite passes after every commit.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Record Result-type audit (D-16) and D-05 naming confirmation-pass (D-17)</name>
  <files>
    .planning/phases/22-codebase-docs-consistency/22-01-SUMMARY.md
  </files>
  <read_first>
    .planning/phases/22-codebase-docs-consistency/22-RESEARCH.md,
    $HOME/.claude/get-shit-done/templates/summary.md
  </read_first>
  <action>
Produce the plan summary `.planning/phases/22-codebase-docs-consistency/22-01-SUMMARY.md`. It MUST include these two confirmation-only sections in addition to the standard summary template:

1. **Result-type audit (D-03 / D-16):** Run `grep -rnE "type Result<|type Ok<|type Err<|type Either<" src/ server/ shared/ --include="*.ts" --include="*.tsx"`. Record the exact count (expected: 0 per RESEARCH). Write: "Result-type audit: 0 occurrences found; D-03 satisfied retroactively per D-16."

2. **Naming confirmation-pass (D-05 / D-17):** Run `grep -rnE "^\s*(let|const|var|function)\s+[a-z]+_[a-z_]+" src/ server/ shared/ --include="*.ts" --include="*.tsx"`. For every match, classify it as one of: (a) wire-format string literal, (b) JSON field, (c) enum/role/error-code value, or (d) genuine TS-identifier violation. Record all matches and classifications in a table. If (d) > 0, STOP and escalate. Expected: (d) = 0 per RESEARCH §Naming Audit and D-17. Write the grep evidence into the SUMMARY.

Also include:
- Count of shims deleted vs retained (from Task 1)
- Count of `.then` sites rewritten vs retained (from Task 2)
- Final baseline: `grep -rn "\.then(" src/ server/ shared/ | wc -l`
- `npm run test:ci` final output (608/608)
  </action>
  <verify>
    <automated>test -f .planning/phases/22-codebase-docs-consistency/22-01-SUMMARY.md &amp;&amp; grep -q "Result-type audit" .planning/phases/22-codebase-docs-consistency/22-01-SUMMARY.md &amp;&amp; grep -q "Naming confirmation-pass" .planning/phases/22-codebase-docs-consistency/22-01-SUMMARY.md</automated>
  </verify>
  <acceptance_criteria>
    - `.planning/phases/22-codebase-docs-consistency/22-01-SUMMARY.md` exists
    - SUMMARY contains a "Result-type audit" section with explicit count 0 and D-16 citation
    - SUMMARY contains a "Naming confirmation-pass" section with grep evidence and D-17 citation
    - SUMMARY cites final `npm run test:ci` → exit 0, 608/608 passing
    - SUMMARY lists every shim file with disposition (deleted | retained + reason)
    - SUMMARY lists every `.then`-file with count before / after / retained-sites-with-reason
  </acceptance_criteria>
  <done>
    Plan 22-01 SUMMARY exists with both audit sections populated with grep evidence, and all dedup/pattern work from Tasks 1 and 2 enumerated.
  </done>
</task>

</tasks>

<verification>
Final verification for Plan 22-01:

```bash
# Safety net
npm run test:ci                                    # exits 0, 608/608
npm run build                                      # exits 0

# .then rewrites landed
grep -rn "\.then(" src/ server/ shared/ --include="*.ts" --include="*.tsx"
# every remaining match must be adjacent to a `// retained:` comment

# No async useEffect callbacks introduced (Pitfall 2)
grep -rnE "useEffect\(\s*async" src/
# returns 0

# Result-type audit still empty
grep -rnE "type Result<|type Ok<|type Err<|type Either<" src/ server/ shared/
# returns 0

# Summary exists
test -f .planning/phases/22-codebase-docs-consistency/22-01-SUMMARY.md
```
</verification>

<success_criteria>
- All 7 shim files audited; dispositions applied per D-06; full test suite green after each per-file commit
- All 15 `.then(` sites in 7 files rewritten to async/await or explicitly retained; no `useEffect(async)` patterns
- Result-type audit (D-16) and naming confirmation-pass (D-17) documented in SUMMARY with grep evidence
- `npm run test:ci` exits 0 with 608/608 passing tests at plan completion
- Zero modifications to `shared/*` (canonical modules are targets, not touched by this plan)
</success_criteria>

<output>
After completion, create `.planning/phases/22-codebase-docs-consistency/22-01-SUMMARY.md` (see Task 3 for required content).
</output>
