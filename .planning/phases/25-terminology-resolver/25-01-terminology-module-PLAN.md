---
phase: 25-terminology-resolver
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/services/terminology.ts
  - tests/terminology.test.ts
  - tests/fixtures/terminologyBundle.ts
autonomous: true
requirements:
  - TERM-01
  - TERM-05
must_haves:
  truths:
    - "src/services/terminology.ts exists and exports collectCodings, resolveDisplay, getCachedDisplay, useDiagnosisDisplay, _seedMap (D-01, D-04)"
    - "_seedMap holds the 9 hardcoded diagnosis entries keyed by `system|code` for de + en locales (D-07, D-08)"
    - "getCachedDisplay returns seed value synchronously without firing fetch when seed hits (D-06)"
    - "getCachedDisplay returns the raw code string for unknown (system, code) pairs and fires a fire-and-forget async lookup (D-06, D-09)"
    - "resolveDisplay populates the L1 cache on a 200 server response; subsequent sync calls hit cache (D-04)"
    - "useDiagnosisDisplay re-renders when L1 fills (D-04)"
    - "Cache key format is `${system ?? '_'}|${code}|${locale}` (D-05)"
    - "No caller in src/ has been changed yet — module landing only (D-26 wave 1)"
    - "npm run test:ci grows by ~5 cases and stays green; build + lint + knip green (D-24)"
  artifacts:
    - path: "src/services/terminology.ts"
      provides: "Browser-side terminology resolver module — module-only, no callers wired"
      exports: ["collectCodings", "resolveDisplay", "getCachedDisplay", "useDiagnosisDisplay", "_seedMap"]
    - path: "tests/terminology.test.ts"
      provides: "Unit tests for module per D-21"
      contains: "describe"
    - path: "tests/fixtures/terminologyBundle.ts"
      provides: "FHIR bundle fixture for collectCodings tests"
      contains: "Condition"
  key_links:
    - from: "tests/terminology.test.ts"
      to: "src/services/terminology.ts"
      via: "import"
      pattern: "from.*services/terminology"
    - from: "src/services/terminology.ts resolveDisplay"
      to: "POST /api/terminology/lookup"
      via: "fetch (treats 503 as 'fall through to seed')"
      pattern: "/api/terminology/lookup"
---

<objective>
Create the new browser-side terminology resolver module at `src/services/terminology.ts` (D-01) and its test suite (D-21). Migrate the 9 hardcoded diagnosis entries from `fhirLoader.ts:112-170` into `_seedMap` keyed by `system|code` for `de` + `en` (D-07, D-08). Module is fully self-contained; no caller is wired in this plan (D-26 wave 1).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/25-terminology-resolver/25-CONTEXT.md
@.planning/REQUIREMENTS.md
@CLAUDE.md
@src/services/fhirLoader.ts
@src/types/fhir.ts

<interfaces>
Source of seed data — `src/services/fhirLoader.ts:112-170` (current main):

```ts
// Existing constants in fhirLoader.ts (above line 112)
export const SNOMED_AMD = '267718000';
export const SNOMED_DR  = '312898008';

// getDiagnosisLabel(code, locale) — SNOMED only:
//   SNOMED_AMD       → 'AMD'
//   SNOMED_DR        → en: 'Diabetic Retinopathy' / de: 'Diabetische Retinopathie'
//   default          → code

// getDiagnosisFullText(code, locale) — 9 entries (SNOMED + ICD-10-GM):
//   SNOMED_AMD       → 'Age-related macular degeneration (267718000)' / 'Altersbedingte Makuladegeneration (267718000)'
//   SNOMED_DR        → 'Diabetic retinopathy (312898008)' / 'Diabetische Retinopathie (312898008)'
//   E11.9, E10.9     → Diabetes mellitus type 2/1
//   H40.1, H25.1, H33.0 → Glaucoma / Cataract / Retinal detachment
//   I10              → Essential hypertension
//   E78.0            → Hypercholesterolemia
//   I25.1            → Coronary artery disease
//   default          → code
```

Coding system URLs in actual bundles (verified from `public/data/center-*.json`):
- SNOMED CT: `http://snomed.info/sct`
- ICD-10-GM: `http://fhir.de/CodeSystem/bfarm/icd-10-gm`  ← use this for ICD entries (D-07 first option)

FhirBundle shape (server-side mirror at `server/fhirApi.ts:41-47`; browser type `src/types/fhir.ts`):
- bundles have `entry: [{ resource: { resourceType, code?: { coding: [{system, code, display?}] }, ... } }]`
- Resources of interest for `collectCodings`: `Condition`, `Observation`, `Procedure` — all expose `resource.code.coding[*]` (D-04)

Cache key format (D-05): `${system ?? '_'}|${code}|${locale}`

Module API (D-04 binding signatures):

```ts
export function collectCodings(bundles: FhirBundle[]): Map<string, Set<string>>;
export function resolveDisplay(args: { system: string | undefined; code: string; locale: string }): Promise<string>;
export function getCachedDisplay(system: string | undefined, code: string, locale: string): string;
export function useDiagnosisDisplay(code: string, system: string | undefined, locale: string): { label: string; fullText: string; isResolving: boolean };
export const _seedMap: Map<string, { label: { de: string; en: string }; fullText: { de: string; en: string } }>;
```

Backward-compat note: callers will keep their existing prop signatures until plan 25-03. This plan creates new module only.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create terminology.ts module + seed map + collectCodings</name>
  <files>src/services/terminology.ts, tests/fixtures/terminologyBundle.ts</files>
  <behavior>
    - `_seedMap` contains exactly 9 entries keyed `system|code` (e.g. `http://snomed.info/sct|267718000`, `http://fhir.de/CodeSystem/bfarm/icd-10-gm|E11.9`)
    - For each entry, both `label.de` / `label.en` and `fullText.de` / `fullText.en` are populated; strings are byte-identical to the existing `getDiagnosisLabel` / `getDiagnosisFullText` outputs (D-08, specifics §1)
    - `collectCodings([bundle])` walks every `entry.resource.code.coding` for `resourceType in {Condition, Observation, Procedure}` and returns a `Map<system, Set<code>>` covering every distinct (system, code) pair seen
    - Codings without a `system` use the `'_'` sentinel (matches D-05 cache-key sentinel)
    - Pure function; no I/O, no caching, no side effects
  </behavior>
  <action>
    Per D-01, D-03, D-04, D-07, D-08:
    1. Create `src/services/terminology.ts`. Import only from `react`, `../types/fhir`. Do NOT import server modules.
    2. Define `_seedMap` as `Map<string, { label: {de,en}; fullText: {de,en} }>` with the 9 entries below. Keys use `${system}|${code}`. Use `http://snomed.info/sct` for the two SNOMED entries and `http://fhir.de/CodeSystem/bfarm/icd-10-gm` for the seven ICD-10-GM entries (per D-07; bundles confirm BfArM canonical).
       - SNOMED 267718000 (AMD): label de/en = 'AMD' / 'AMD'; fullText keep byte-identical to existing `getDiagnosisFullText` strings.
       - SNOMED 312898008 (DR): label de = 'Diabetische Retinopathie', en = 'Diabetic Retinopathy'; fullText byte-identical to existing.
       - ICD E11.9, E10.9, H40.1, H25.1, H33.0, I10, E78.0, I25.1: label can equal the code itself (the existing `getDiagnosisLabel` returns the raw code for these — preserve that behavior); fullText byte-identical to existing `getDiagnosisFullText` strings.
    3. Implement `collectCodings(bundles)` per D-04. Iterate `bundles[*].entry[*].resource`, narrow on `resourceType` (`Condition` | `Observation` | `Procedure`), iterate `resource.code?.coding ?? []`, push each `(system ?? '_', code)` into the result map.
    4. Export `_seedMap` only for tests (per D-04 — name with leading underscore signals test-only access).
    5. Create `tests/fixtures/terminologyBundle.ts` exporting a small `FhirBundle` literal containing 1 Condition with SNOMED AMD coding, 1 Condition with ICD E11.9 coding, 1 Observation (any code), 1 Procedure (any code), and 1 unrelated `Patient` resource (must be skipped by `collectCodings`).
    6. Tests `tests/terminology.test.ts` — first two cases:
       - `collectCodings(fixture)` returns a Map with 3 systems and the expected codes per system; Patient resource is ignored.
       - `_seedMap` size === 9 and SNOMED AMD entry has the expected `fullText.de` and `fullText.en` strings (byte-identical to current `fhirLoader.ts`).
  </action>
  <verify>
    <automated>npx vitest run tests/terminology.test.ts -t 'collectCodings|seedMap'</automated>
  </verify>
  <done>
    Tests pass for `collectCodings` shape and `_seedMap` byte-identical strings. `npm run lint` clean for the new file.
    Atomic commit: `feat(25-01): add terminology module with seedMap and collectCodings (TERM-01)`.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add resolveDisplay + getCachedDisplay (3-tier strategy)</name>
  <files>src/services/terminology.ts, tests/terminology.test.ts</files>
  <behavior>
    - `getCachedDisplay(system, code, locale)` is sync. Order (D-04, D-06, D-09):
        1. L1 in-memory cache hit on key `${system ?? '_'}|${code}|${locale}` → return cached display
        2. _seedMap hit on `${system ?? '_'}|${code}` → return seed value (label by default; see action for label vs fullText decision)
        3. fallthrough → return raw `code` string AND fire `void resolveDisplay(...)` as fire-and-forget side effect
    - `resolveDisplay({ system, code, locale })` is async. Order:
        1. If L1 cache has the key → return cached value (no network)
        2. POST to `/api/terminology/lookup` with `{ system, code, locale }`. If response is 200 with `{ display }`, write to L1 and return display.
        3. On 503 (`terminology.enabled: false` per D-12) OR any non-2xx → fall through to _seedMap; if seed hits, write seed value to L1 and return; if not, return raw `code` (no L1 write — D-09 preserves "raw code for unmapped" behavior, but caching prevents repeated server calls for genuinely-unknown codes; resolveDisplay writes a sentinel-or-empty into L1 keyed `null` is rejected — instead we cache the raw-code result to suppress repeat fetches).
    - When `getCachedDisplay` misses L1 and seed both, the returned string is the raw `code` AND a single async fetch is dispatched (test asserts mock fetch called exactly once even with two sync calls in a row before the fetch resolves).
    - Cache key sentinel for missing system is `'_'` (D-05).
  </behavior>
  <action>
    Per D-04, D-05, D-06, D-09, D-12, D-13:
    1. Add module-private `_l1Cache: Map<string, string>` and a `_pendingLookups: Set<string>` to dedupe concurrent fire-and-forget requests for the same key.
    2. Implement `cacheKey(system, code, locale) = `${system ?? '_'}|${code}|${locale}``.
    3. Implement `getCachedDisplay`:
       - L1 hit → return value.
       - Else seed hit on `${system ?? '_'}|${code}` → return `entry.label[locale] ?? entry.label.de` (label is the default for sync render contexts; fullText is exposed only via the hook + a separate `getCachedFullText` if a caller needs it — the hook covers the only fullText callsite that matters per D-19).
       - Else: schedule `void resolveDisplay({ system, code, locale })` (only if not already pending — check `_pendingLookups`), and return `code`.
    4. Implement `resolveDisplay`:
       - If L1 has key → return.
       - Mark key in `_pendingLookups`. `try`/`finally` to clear on completion.
       - `fetch('/api/terminology/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system, code, locale }), credentials: 'include' })`.
       - On `resp.ok` with `{ display }` → write display to L1, return display.
       - On non-OK (incl. 503) → seed fallback per D-12: if seed hits, write seed.label[locale] (or fullText — see note) to L1, return; else write `code` to L1 (suppress repeat fetches per behavior note), return `code`.
       - Throw-only error policy (CLAUDE.md D-03): network errors propagate; the catch block in `getCachedDisplay`'s fire-and-forget call swallows them silently (`void promise.catch(() => {})`).
    5. Add internal helpers `_resetForTests()` exported only when `process.env.NODE_ENV === 'test'` OR simply expose via underscore-prefix and document — Vitest can call it in `beforeEach` to clear L1 + pending sets between tests.
    6. Tests (extend `tests/terminology.test.ts`):
       - Test A — sync seed hit: `getCachedDisplay('http://snomed.info/sct', '267718000', 'de')` returns `'AMD'` AND `global.fetch` mock was NOT called (assert `vi.mocked(fetch)` not called).
       - Test B — sync miss → raw code + fire-and-forget: `getCachedDisplay(undefined, 'X.unknown', 'de')` returns `'X.unknown'` AND `fetch` mock called exactly once with `/api/terminology/lookup`. Mock returns `503`. After the awaited microtask flush, second sync call still returns `'X.unknown'` (L1 holds the raw code, not undefined).
       - Test C — resolveDisplay 200 path: mock fetch returns `{ ok: true, json: () => ({ display: 'Custom Display' }) }`. `await resolveDisplay({ system: 'urn:test', code: '42', locale: 'de' })` returns `'Custom Display'`. Subsequent `getCachedDisplay('urn:test', '42', 'de')` returns `'Custom Display'` without firing fetch a second time.
       - Test D — resolveDisplay 503 → seed: mock `fetch` returns 503; `await resolveDisplay({ system: 'http://snomed.info/sct', code: '267718000', locale: 'de' })` returns `'AMD'`.
  </action>
  <verify>
    <automated>npx vitest run tests/terminology.test.ts</automated>
  </verify>
  <done>
    All 4 cache/resolve tests green. Mock-fetch call counts asserted (no spurious network on seed hits). Atomic commit: `feat(25-01): add 3-tier resolveDisplay + getCachedDisplay (TERM-01)`.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add useDiagnosisDisplay React hook + safety net</name>
  <files>src/services/terminology.ts, tests/terminology.test.ts</files>
  <behavior>
    - `useDiagnosisDisplay(code, system, locale)` returns `{ label, fullText, isResolving }`.
    - Initial render synchronously returns the `getCachedDisplay` result (seed or raw) and `isResolving = true` if fire-and-forget was dispatched.
    - When the async `resolveDisplay` resolves, the hook re-renders with the freshly-cached value; `isResolving = false`.
    - The hook subscribes to a module-level event emitter (`Set<() => void>` of force-update callbacks) so cache writes from anywhere in the app trigger a re-render in any mounted hook. Unsubscribe on unmount.
    - Stable across re-renders: same `(code, system, locale)` triple does NOT cause infinite re-renders.
  </behavior>
  <action>
    Per D-04 + RTL test pattern (D-21 case 5):
    1. Add `_listeners: Set<() => void>` module-private. Helper `_notifyAll()` calls every listener; called from `resolveDisplay` after L1 write.
    2. Implement `useDiagnosisDisplay(code, system, locale)`:
       - `const [, force] = useReducer((x: number) => x + 1, 0)`
       - `useEffect(() => { _listeners.add(force); return () => { _listeners.delete(force); }; }, [])` — empty deps; force is stable from useReducer.
       - Compute `label = getCachedDisplay(system, code, locale)`; `fullText` from a sibling `getCachedFullText(system, code, locale)` helper (mirrors getCachedDisplay but reads `entry.fullText[locale]` for seed hits; falls back to label/raw code).
       - `isResolving = _pendingLookups.has(cacheKey(system, code, locale))`.
       - Return `{ label, fullText, isResolving }`.
    3. Add `getCachedFullText` (similar shape to getCachedDisplay; uses `entry.fullText[locale]` on seed hits; same fire-and-forget on miss).
    4. Test E (RTL + act):
       - Use `renderHook(() => useDiagnosisDisplay('XYZ', 'urn:test', 'de'))` from `@testing-library/react`.
       - Initial: `result.current.label === 'XYZ'` (raw code), `isResolving === true`.
       - Mock `fetch` resolves with `{ display: 'Resolved' }`.
       - `await act(async () => { await flushPromises(); })`.
       - `result.current.label === 'Resolved'`, `isResolving === false`.
    5. Run final safety net:
       - `npm run test:ci` — must be green; new test count = 619 baseline + 5 new cases (Tests A–E plus collectCodings/seed tests; final ~622–624 acceptable per D-24, claude-discretion in CONTEXT).
       - `npm run build` — green (Pitfall 3, Phase 22).
       - `npm run lint` — green.
       - `npm run knip` — no new dead exports (the `_seedMap` underscore export should be considered test-only; if knip flags it, add to `knip.json` ignore list with a one-line reason).
  </action>
  <verify>
    <automated>npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run lint &amp;&amp; npm run knip</automated>
  </verify>
  <done>
    Hook test green; full safety net green. Atomic commit: `feat(25-01): add useDiagnosisDisplay hook + complete TERM-01 module (TERM-01, TERM-05)`.
  </done>
</task>

</tasks>

<verification>
- `src/services/terminology.ts` exists, exports the 5 names per D-04.
- 9 seed entries verified by test; strings byte-identical to existing fhirLoader output.
- No caller file in src/ has been modified yet (grep `getDiagnosisLabel\|getDiagnosisFullText` still shows old fhirLoader callers — those move in plan 25-03).
- Test count grew by ~5 cases.
</verification>

<success_criteria>
- TERM-01 partially satisfied (module created with full API surface; callers wired in 25-03).
- TERM-05 partially satisfied (module-level tests in place; server tests in 25-02; caller-migration coverage in 25-03).
- Safety net (test:ci + build + lint + knip) green at end of plan.
- No behavior change visible to users yet — module is dormant until callers migrate in 25-03.
</success_criteria>

<output>
After completion, create `.planning/phases/25-terminology-resolver/25-01-SUMMARY.md` per the standard summary template.
</output>
