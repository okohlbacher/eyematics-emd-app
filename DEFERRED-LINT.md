# Deferred Lint Rules

Lint rules whose full remediation was deferred from Phase 23 per D-17.
Revisit triggers documented per rule. Sibling to `DEFERRED-UPGRADES.md`.

## @typescript-eslint/no-explicit-any

- **Current violations count (disable moment):** 526
- **Rule:** `@typescript-eslint/no-explicit-any` (inherited from `tseslint.configs.recommended`)
- **Why deferred:** D-07 prohibits adding aggressive rules; the rule is transitively active via `tseslint.configs.recommended` but D-07's "do not add" directive cannot literally apply to an already-inherited rule. Fixing 526 `any` occurrences is a separate large refactor (scope explosion vs D-07 spirit). Per D-17 decision: disable project-wide in `eslint.config.js` with a single `'off'` override, document here.
- **Revisit trigger:** A future "typescript-strict" phase that also picks up `noImplicitAny` / `strictNullChecks` at the tsconfig level, OR a milestone dedicating capacity to `any` → concrete-type narrowing (estimate: ~1 full phase on its own).
- **How to find:** `grep -rnE ': any\b' src/ server/ shared/ --include="*.ts" --include="*.tsx" | wc -l`

## Additive rules considered and NOT enabled

Per Phase 23 RESEARCH §Additive rules beyond D-07. These were considered during planning and NOT enabled; recorded here so future phases can re-evaluate without re-deriving.

### no-console

- **Not-enabled-because:** Scope creep. Likely 10–30 violations requiring per-site review (some `console.error` calls are legitimate production logging).
- **Revisit trigger:** A phase that introduces a structured logger (e.g., pino / winston) and wants to forbid direct `console.*` in favor of the logger.

### @typescript-eslint/consistent-type-imports

- **Not-enabled-because:** Out of D-07 baseline; potentially 50+ violations. Autofix is cheap but the diff would be noisy on top of the Phase 23 import-sort autofix.
- **Revisit trigger:** A TypeScript tree-shaking / bundle-size optimization phase.

### no-param-reassign

- **Not-enabled-because:** Out of D-07 baseline. Likely has legitimate violations (e.g., Express middleware `req` augmentation patterns).
- **Revisit trigger:** A code-style hardening phase that also reviews mutability conventions.
