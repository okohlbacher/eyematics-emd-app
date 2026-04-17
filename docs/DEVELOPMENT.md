<!-- generated-by: gsd-doc-writer -->
# Development Guide

<!-- GSD:GENERATED 2026-04-17 -->

This guide covers everything a developer needs to work on the EyeMatics EMD application day-to-day: project structure, the dev workflow, code conventions, and how to extend the system.

---

## Project structure

```
emd-app/
  src/          Frontend — React 18 + TypeScript, Vite-bundled
  server/       Backend — Express 5, SQLite (better-sqlite3), JWT auth
  shared/       Pure TypeScript utilities shared between frontend and backend
  tests/        All test files (Vitest); co-located with the root, not with source
```

**The `shared/` constraint.** Modules in `shared/` must not import from `src/` or `server/`. They are included in both the `tsconfig.app.json` (`src` + `shared`) and the server TypeScript compilation. Violating this constraint breaks one of the two compilation paths.

---

## Dev workflow

The frontend and backend are started as separate processes during development.

**Start the Vite dev server (frontend):**

```bash
npm run dev
```

Vite listens on `http://localhost:5173` by default. Requests to `/api/*` are proxied to `http://localhost:3000` (the Express backend), and requests to `/fhir/*` are proxied to `http://localhost:8080` (the FHIR server). The proxy is configured in `vite.config.ts`.

**Start the Express backend (backend):**

```bash
npm start
```

The server reads `settings.yaml` at startup and exits immediately if the file is missing or invalid. It listens on the host and port specified in that file. In development, run both processes concurrently in separate terminals.

---

## Code conventions

**TypeScript.** Both `tsconfig.app.json` and `tsconfig.node.json` enforce strict compilation: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, and `erasableSyntaxOnly` are all enabled. There are no path aliases — use relative imports.

**ESLint.** Configuration is in `eslint.config.js` and covers all `.ts` and `.tsx` files. Active rules:

- `typescript-eslint` recommended ruleset
- `eslint-plugin-react-hooks` recommended ruleset
- `eslint-plugin-react-refresh` (Vite mode)
- `eslint-plugin-simple-import-sort` — imports and exports must be ordered (reported as warnings)
- `@typescript-eslint/no-unused-vars` — underscore-prefixed names (`_foo`) are exempt

Context files under `src/context/` have `react-refresh/only-export-components` disabled because they legitimately export hooks and providers together.

**Linting:**

```bash
npm run lint
```

**File naming.** React components use PascalCase (e.g., `OutcomesPage.tsx`). Utility modules use camelCase (e.g., `hashCohortId.ts`). Test files mirror the name of what they test with a `.test.ts` or `.test.tsx` suffix and live in `tests/` at the project root.

---

## Adding a new API endpoint

1. Create a router file in `server/` (e.g., `server/myFeatureApi.ts`) exporting an Express `Router`.
2. Import and mount it in `server/index.ts` after `authMiddleware` — all routes mounted after that middleware are automatically protected by JWT validation.
3. Audit logging is automatic. `auditMiddleware` is mounted before `authMiddleware` and hooks into the response `finish` event, so every `/api/*` request is logged to the SQLite audit database regardless of which router handles it. There is nothing to call in the route handler itself.

Example minimal router:

```typescript
import { Router } from 'express';

export const myFeatureRouter = Router();

myFeatureRouter.get('/my-feature', (_req, res) => {
  res.json({ ok: true });
});
```

Then in `server/index.ts`:

```typescript
import { myFeatureRouter } from './myFeatureApi.js';
// ...
app.use('/api', myFeatureRouter);
```

---

## Adding a new i18n key

All translations live in `src/i18n/translations.ts` as a single flat object where each key maps to `{ de: string; en: string }`.

1. Add the key to the `translations` object with both `de` and `en` strings.
2. If the value contains interpolation placeholders (e.g., `{count}`), the placeholder must appear in both locale strings — the automated test enforces this.

The test file `tests/outcomesI18n.test.ts` runs three checks for `outcomes*` and `metrics*` namespaces:
- every key has a non-empty `de` and `en` value
- placeholder tokens match between `de` and `en`
- every `t('outcomes*')` or `t('metrics*')` call found in `src/` resolves to a defined key

Run the suite with `npm test` to verify completeness before committing.

---

## Testing

**Test framework.** Vitest 4. The default environment is `node`. UI component tests that need a DOM declare `// @vitest-environment jsdom` as the very first line of the test file.

**Run all tests:**

```bash
npm test
```

**Run a single test file:**

```bash
npx vitest run tests/outcomesI18n.test.ts
```

**Writing a new test.** Place the file in `tests/` with a `.test.ts` or `.test.tsx` suffix. For component tests using `@testing-library/react`, add the jsdom docblock at the top:

```typescript
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
```

**The Recharts mock pattern.** Recharts components (`ResponsiveContainer`, `ComposedChart`, etc.) fail in jsdom because they depend on `ResizeObserver` and SVG layout APIs. Mock the module using `vi.mock` before other imports so Vite's hoisting applies:

```typescript
// Declared before other imports so vi.mock hoisting works correctly.
vi.mock('recharts', async (importOriginal) => {
  const real = await importOriginal<typeof import('recharts')>();
  return {
    ...real,
    ResponsiveContainer: ({ children }: { children: any }) => (
      <div data-testid="recharts-responsive-container"><svg>{children}</svg></div>
    ),
    ComposedChart: ({ children }: { children: any }) => (
      <g data-testid="recharts-composed-chart">{children}</g>
    ),
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
  };
});
```

Spread `...real` first so non-mocked Recharts exports (types, utilities) remain available.

---

## Building for production

```bash
npm run build
```

This runs `tsc -b` (type-check all project references) followed by `vite build`. Output goes to `dist/`. The Express server in `server/index.ts` serves `dist/` as static files and handles SPA fallback for all unmatched GET routes.

To start the production build locally:

```bash
npm start
```

---

## Linting

```bash
npm run lint
```

ESLint checks all `.ts` and `.tsx` files (the `dist/` directory is excluded). Fix import ordering warnings with:

```bash
npx eslint . --fix
```
