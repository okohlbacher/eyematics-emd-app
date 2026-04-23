# CLAUDE.md

Minimal project conventions for Claude sessions.

## Commands

- Test (safety net): `npm run test:ci` (608/608 must pass — Phase 21 baseline)
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

## Entry points

- `.planning/PROJECT.md` — domain + architecture
- `.planning/ROADMAP.md` — milestones + current phase
- `.planning/STATE.md` — active position
- `.planning/GLOSSARY.md` — terminology (sites, centers, patients, cases, cohort)
