---
phase: 25-terminology-resolver
plan: 04
subsystem: settings + docs
tags: [terminology, settings, configuration, documentation]
requires:
  - 25-02 (server/terminologyApi.ts readTerminologySettings — code defaults)
  - 25-03 (caller migration complete; resolver wired end-to-end)
provides:
  - "config/settings.yaml terminology.* commented example block"
  - "docs/Konfiguration.md German section + table rows for terminology.enabled, .serverUrl, .cacheTtlMs"
affects:
  - "operator UX: opt-in path to enable an external terminology server is now documented"
  - "upgrade behavior: existing v1.9.3 settings.yaml continues to work unchanged (offline)"
tech-stack:
  added: []
  patterns:
    - "Phase 23 D-17 minimal-YAML pattern: keep non-UI keys as commented examples, code supplies defaults"
    - "D-18 documentation pattern: German Konfiguration.md sections per top-level key with 'Minimal vs. voll' note"
key-files:
  created:
    - .planning/phases/25-terminology-resolver/25-04-SUMMARY.md
  modified:
    - config/settings.yaml
    - docs/Konfiguration.md
decisions:
  - "Kept terminology.* commented in settings.yaml rather than active keys — preserves D-17 minimal-YAML invariant; defaults come exclusively from server/terminologyApi.ts readTerminologySettings()"
  - "Did not modify server/index.ts: it neither reads nor logs terminology config, so D-17 is fully satisfied at the router level (plan 25-02)"
  - "Did not modify README/BOM: README points to Konfiguration.md and has no per-key settings table; BOM lists dependencies, not settings"
metrics:
  duration: ~5 minutes
  completed: 2026-04-29
  tasks: 2
  files_modified: 2
  commits: 2
  test_count: 642 (unchanged from baseline; no new code paths in this plan)
---

# Phase 25 Plan 04: Settings & Docs Summary

Closes Phase 25 by surfacing the terminology resolver's three configuration keys without changing default behavior: `config/settings.yaml` gains a commented `terminology:` example block (Phase 23 D-17 minimal-YAML pattern), and `docs/Konfiguration.md` gets a full German section documenting `enabled`, `serverUrl`, and `cacheTtlMs` with the same "Minimal vs. voll" note style used by other Phase 23-era keys (D-18).

## What Shipped

### Task 1 — settings.yaml (commit `fee8ba0`)

- Appended a commented `terminology:` block after the existing `auth:` block in `config/settings.yaml`.
- Three keys with inline comments per D-16 verbatim: `enabled: false`, `serverUrl: 'https://r4.ontoserver.csiro.au/fhir'`, `cacheTtlMs: 86400000`.
- Block is **commented** (`#`-prefixed) — keeps the file in line with Phase 23 D-17 (only UI-set keys live as active YAML; everything else is code-defaulted). The active source-of-truth defaults remain in `server/terminologyApi.ts readTerminologySettings()` (plan 25-02): `enabled=false`, `serverUrl=undefined` (→ 503), `cacheTtlMs=86_400_000`.
- YAML still parses cleanly (`js-yaml` smoke test); existing structure unchanged.
- `server/index.ts` was inspected and required no change: it neither reads nor logs terminology config at boot, so adding a console.log line would be deviation-by-addition. The router-level read is the single source.

### Task 2 — docs/Konfiguration.md (commit `eb46862`)

- Extended the "Vollständiges Beispiel" YAML block with an active (uncommented) `terminology:` block — the docs example shows full overrides; the production file keeps it commented per D-17.
- Added three rows to the "Parameter im Detail" table: `terminology.enabled`, `terminology.serverUrl`, `terminology.cacheTtlMs` with type, default, and one-line description.
- Added a dedicated `## Terminologie-Server (\`terminology\`)` section in German with:
  - Intro paragraph describing the 3-tier resolver (L1 in-memory cache → L2 server proxy → L3 seed map).
  - "Minimal vs. voll" callout matching the file's existing pattern.
  - Three subsections (`### terminology.enabled`, `### terminology.serverUrl`, `### terminology.cacheTtlMs`) covering: opt-in semantics, the 503 disabled-response contract, the Ontoserver placeholder rationale, the SSRF guard (D-10), and the LRU/process-local/no-audit-log behavior (D-11, D-15).
- Updated the "Minimalkonfiguration vs. Vollbeispiel" hint at the top to list `terminology.*` among the code-defaulted keys.

## Files Modified

| File | Change |
| --- | --- |
| `config/settings.yaml` | +6 lines (commented `terminology:` example block + header comment) |
| `docs/Konfiguration.md` | +27/-1 lines (YAML example, table rows, full German section, hint update) |

## Decisions Made

- **Commented-block approach in settings.yaml.** The plan task action says "add the `terminology:` block ... verbatim". Combined with the user's invocation note ("commented examples per Phase 23 D-17 minimal-YAML pattern; defaults supplied in code") and the existing file's invariant (only UI-set keys are active), the block was kept commented. This is the only configuration that preserves D-17. Test: omitting/commenting the block → 503 from `/api/terminology/lookup` → client falls through to seed map → offline behavior intact.
- **No `server/index.ts` change.** The plan explicitly allows skipping if `index.ts` doesn't already log terminology config; it doesn't. Adding a boot-log line would expand surface area without satisfying any requirement. D-17 is satisfied entirely by `readTerminologySettings()` in `server/terminologyApi.ts`.
- **No `README.md` / `BOM.md` change.** README points operators at `docs/Konfiguration.md` and contains no per-key settings table; BOM is a license/dependency manifest. Both are out of scope per plan Task 2 step 3.

## Verification

- **Task 1 safety net:** `node -e "yaml.load(...)"` parses → `npm run test:ci` 642/642 → `npm run build` clean.
- **Task 2 final safety net (D-24):** `npm run test:ci` 642/642 → `npm run build` clean → `npm run lint` clean → `npm run knip` clean (only the pre-existing unlisted-binaries/redundant-entry hints remain — not introduced by this plan).
- **Test count unchanged at 642** — this plan adds zero runtime code paths; behavior is fully covered by the existing `tests/terminologyApi.test.ts` (plan 25-02) which exercises the disabled (503) path and the enabled (200/cache/remote) paths against the same `readTerminologySettings()` defaults this plan documents.
- **Upgrade-safety check:** A v1.9.3 user's existing `settings.yaml` (no `terminology:` block at all) continues to work — the resolver stays dormant; `/api/terminology/lookup` returns 503; the client falls through to the seed map. Verified by inspection of `readTerminologySettings()` fallback paths (lines 51-67 of `server/terminologyApi.ts`).

## Phase 25 — End-to-End Closure

With this plan complete, all five Phase 25 requirements (TERM-01 .. TERM-05) are green:

- **TERM-01** (terminology module): plan 25-01 — `src/services/terminology.ts` + `useDiagnosisDisplay` hook + seed map.
- **TERM-02** (caller migration): plan 25-03 — 5 callers migrated; `getDiagnosisLabel`/`getDiagnosisFullText` removed from `fhirLoader.ts`.
- **TERM-03** (server proxy): plan 25-02 — `POST /api/terminology/lookup` with SSRF guard + LRU cache.
- **TERM-04** (settings + docs): **this plan**.
- **TERM-05** (tests): covered across plans 25-01 / 25-02 / 25-03.

A user upgrading from v1.9.3 with their existing `settings.yaml` sees zero behavior change — the terminology resolver is dormant until they opt in via `terminology.enabled: true` + a real `serverUrl`.

## Deviations from Plan

None — plan executed exactly as written (the commented-block interpretation of D-16/D-17 was clarified by the invocation note and is consistent with the existing file's invariant; not a deviation).

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: `.planning/phases/25-terminology-resolver/25-04-SUMMARY.md`
- FOUND: commit `fee8ba0` (Task 1 — settings.yaml)
- FOUND: commit `eb46862` (Task 2 — docs/Konfiguration.md)
- FOUND: `terminology` token in `config/settings.yaml`
- FOUND: `terminology` token in `docs/Konfiguration.md`
- VERIFIED: `npm run test:ci` 642/642 green
- VERIFIED: `npm run build` clean
- VERIFIED: `npm run lint` clean
- VERIFIED: `npm run knip` clean (no new findings introduced by this plan)
