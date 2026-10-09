# Round folder — `handoff/rounds/<vX.Y>/`

| File | Written by | Read by |
|---|---|---|
| `items.yaml` | uat-triage (planned tests), uat-implement (final test mappings) | uat-verify, `requirements-check --round` |
| `verification.yaml` | uat-verify — local container pass | `requirements-check --round` |
| `verification-release.yaml` | uat-release — published-image pass (`--release`) | `requirements-check --round` (overrides same ids) |
| `browser-procedures.md` | `requirements-check --browser … > file` (never read it from a pipe) | uat-verify |
| `report-local.md`, `report-release.md` | `requirements-check --report` | uat-release (cited in the dev response) |

Hotfix rounds (mail-triggered, `vX.Y.Z`) use the same folder layout with item ids `H1`, `H2`, ….

Full baseline sweeps of the browser-only registry requirements live in `handoff/sweeps/<YYYY-MM-DD>/verification.yaml`
and are passed to later runs with `--sweep <file>` (`handoff/HANDOFF.md` §6).

The prose companions stay where they always were: `.planning/<vX.Y>-UAT-TRIAGE.md`, `.planning/<vX.Y>-ROADMAP.md`,
`.planning/<vX.Y>-DEV-RESPONSE-TO-UAT.md` and the root `EMD-<vX.Y>-UAT-Developer-Response_<date>.docx`.
