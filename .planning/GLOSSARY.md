# Glossary

Canonical terminology for the EMD project. Prose across `.planning/`, README, and
user-facing copy SHOULD use the canonical prose form. Wire/DB/FHIR/HTTP/identifier
forms are external contracts and MUST NOT be renamed (see D-05).

## sites

Canonical domain term for participating clinical research locations.
Used in: prose across `.planning/`, user-facing UI copy, ROADMAP / PROJECT /
MILESTONES narratives, RETROSPECTIVE entries.

Wire/DB form appears as "center" (legacy external naming, kept for schema
compatibility). Do NOT rename wire payloads, file paths, JSON fields, or URL
segments (D-05, D-12).

## centers

Wire/DB synonym of "sites". Appears in:

- `data/centers.json` — seed file for site metadata
- `/api/fhir/centers` — HTTP endpoint path
- `center_id` — database / FHIR column
- `CENTER-*` — requirement IDs from the Pflichtenheft
- `centers` — JSON field on user records and JWT claims (`{ sub, role, centers }`)
- `generate-center-bundle.ts`, `_migrateRemovedCenters`, `extractCenters` —
  TypeScript identifiers predating the prose convention
- `data/users.json` — the `centers` field on user records

These are external contracts. Do NOT rename (D-05).

Phase-archive titles such as "Site Roster Correction" are proper nouns and
remain as written regardless of which term appears in their body.

## patients

Clinical subjects (individuals receiving IVOM treatment). NOT a synonym of
"cases". A patient may have zero, one, or many cases over time.

## cases

App-level records of patient encounters / episodes / visits. A patient has one
or more cases. Do NOT normalize "cases" to "patients" in prose — the distinction
is load-bearing in cohort math and CSV exports.

## cohort

Domain term for a filtered set of patients / cases used in analysis. Single
canonical usage across prose and UI. "Groups" is reserved for test contexts
(e.g., `test-group`) and is NOT a domain synonym for cohort.
