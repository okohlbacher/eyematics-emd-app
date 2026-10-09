# CLAUDE.md

Minimal project conventions for Claude sessions.

## Commands

- Test (safety net): `npm run test:ci` (all must pass — 1 327 tests at v1.20.2)
- UI requirements harness: `npm run requirements [-- --round handoff/rounds/<vX.Y>]` (registry + round items vs tests/browser records)
- Container: `bash scripts/container-smoke.sh` (build + 18 checks)
- Build: `npm run build`
- Dev: `npm run dev` (Vite) + `npm start` (Express API on :3000)
- Lint: `npm run lint`
- Dead-code scan: `npm run knip` (config: `knip.json`)

## Conventions

- Naming: camelCase for TS identifiers; wire/DB/FHIR/HTTP strings stay as-is (D-05)
- Error handling: throw-only (D-03). No Result types.
- Async: async/await in new and touched files; `Promise.all` allowed (D-04)
- Cross-boundary helpers live in `shared/` (D-01)
- Config: `config/settings.yaml` is the single source — NO env vars
- Tests: no jest-dom; RTL assertions use `queryByText().not.toBeNull()` / `.toBeNull()`

## Terminology

- Prose uses "sites" for participating clinical locations
- Wire/DB forms ("center", `center_id`, `data/centers.json`, `/api/fhir/centers`,
  `CENTER-*` IDs, `centers` JSON field, `generate-center-bundle.ts`) are external
  contracts — do NOT rename (D-05, D-12)
- "patients" ≠ "cases": a patient has one or more cases (visits)

<!-- >>> useavibe (managed by the UseAVibe harness installer) -->
## UseAVibe iteration rules (study protocol V01)

- One usability problem (`Z<k>-P<nn>`) per fresh session and commit series: `/clear`, then `/useavibe-fix <ID>`.
- Done = the scenarios in `acceptance/Z<k>/<ID>.feature` (read-only) + the Stop-hook gate. Problem list: `.planning/useavibe/Z<k>/PROBLEMS.md` (frozen).
- Test first: the new acceptance test fails before the fix and passes after; all earlier cycles' tests stay green.
- Never weaken, skip or delete a test. A registry-mapped test keeps its title and assertions; if it goes red, stop and report.
- Change nothing outside the problem: other findings go under `## Observed, not changed`; ambiguity → `## Blocked`.
- Trailers `Usability-Problem:`, `Acceptance:`, `Attempts:`. Report evidence (command output), not claims.
- Skills: `/useavibe-cycle-open`, `/useavibe-plan`, `/useavibe-fix`, `/useavibe-release`, `/useavibe-accept`, `/useavibe-close`.
<!-- <<< useavibe -->

## Entry points

- `.planning/PROJECT.md` — domain + architecture
- `.planning/ROADMAP.md` — milestones + current phase
- `.planning/STATE.md` — active position
- `.planning/GLOSSARY.md` — terminology (sites, centers, patients, cases, cohort)
- `handoff/HANDOFF.md` — the UAT user-study loop (tester docx → triage → implement → verify → release); skills `/uat-round`, `/uat-triage`, `/uat-implement`, `/uat-verify`, `/uat-release`
