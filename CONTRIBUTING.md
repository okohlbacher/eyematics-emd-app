<!-- generated-by: gsd-doc-writer -->
# Contributing to EyeMatics EMD
<!-- GSD:GENERATED 2026-04-17 -->

Thank you for contributing to the EyeMatics EMD clinical research dashboard. This project processes real ophthalmological research data, so accuracy, correctness, and security are non-negotiable.

## Code of conduct

Treat every contributor with respect. Criticism must be directed at code and ideas, not at people. Contributions from clinicians, researchers, and engineers are all welcome; assume good intent and ask questions before escalating disagreements.

## Reporting a bug

Two paths are available:

- **In-app feedback button** — the preferred route for data or visualisation issues. Feedback is written to `feedback/*.json` and includes the current view state, which makes triage faster.
- **GitHub issue** — use this for installation problems, security concerns, or anything that cannot be reproduced inside the running app. Include your Node.js version, steps to reproduce, and the expected versus actual behaviour.

Do not include patient data or identifiable research data in any bug report.

## Development setup

Prerequisites: Node.js >= 20, npm >= 10.

```bash
git clone <repo-url>
cd emd-app
npm install
npm run dev      # starts the Vite dev server
npm test         # runs the full Vitest suite
```

The Express backend is started separately with `npm start` when you need server-side routes. See GETTING-STARTED.md for full environment configuration details once that document is available.

## Making changes

**Branch naming** — prefix every branch with one of:

| Prefix | Use for |
|--------|---------|
| `feat/` | new features |
| `fix/` | bug fixes |
| `docs/` | documentation only |
| `test/` | test additions or corrections |
| `refactor/` | code restructuring with no behaviour change |

**Commit style** — follow Conventional Commits. The subject line must start with one of `feat`, `fix`, `chore`, `docs`, `test`, or `refactor`, followed by a colon and a short imperative description. Example: `fix: correct cohort filter when center list is empty`. Keep each commit to one logical change so that bisection and rollback remain practical.

## Testing requirements

The test suite must remain green before any PR is merged:

```bash
npm test
```

All 430 tests must pass. New features require new tests covering the happy path and at least one error path. When adding or changing internationalisation strings, add the key to **both** the `de` and `en` namespaces in `src/i18n/translations.ts`. Missing translations cause runtime errors in the other locale.

## Linting

```bash
npm run lint
```

The project uses ESLint with `typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-simple-import-sort`. The lint step must pass with zero errors. Specific rules to be aware of:

- `@typescript-eslint/no-unused-vars` is an error — prefix intentionally unused destructured values with `_`.
- Import order is enforced as a warning by `simple-import-sort`; fix with your editor's organise-imports action or by hand.
- Avoid `any` casts. If a cast is genuinely necessary, add an inline comment explaining why.

## Pull request checklist

Before requesting review, confirm:

- [ ] `npm test` passes (all 430 tests green)
- [ ] `npm run lint` passes with zero errors
- [ ] No new `console.log` statements in production code paths (`src/`, `server/`, `shared/`)
- [ ] Changes to authentication, audit logging, or center-based access filtering are flagged in the PR description for extra security review
- [ ] The PR description explains the motivation, not just the diff

## Clinical correctness

Changes to `shared/cohortTrajectory.ts` or any file computing outcome trajectories or CRT intervals must include a clinical rationale in the PR description. State which published protocol or clinical rule the change implements, and link to the source where possible. These calculations directly affect how research results are presented to clinicians, so correctness cannot be assumed from passing tests alone.

## License

By contributing you agree that your changes will be released under the [MIT License](LICENSE) that covers this project.
