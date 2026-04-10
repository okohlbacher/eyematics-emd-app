# Bill of Materials (BOM) — EyeMatics Clinical Demonstrator

Generated: 2026-04-09

## Direct Dependencies (Production)

| Package | Version | License | Description |
|---------|---------|---------|-------------|
| `@tailwindcss/vite` | 4.2.2 | MIT | Tailwind CSS Vite plugin |
| `html-to-image` | 1.11.13 | MIT | DOM-to-image screenshot capture |
| `js-yaml` | 4.1.1 | MIT | YAML parser/serializer |
| `lucide-react` | 1.8.0 | ISC | Icon library (React bindings) |
| `react` | 19.2.5 | MIT | UI framework |
| `react-dom` | 19.2.5 | MIT | React DOM renderer |
| `react-router-dom` | 7.14.0 | MIT | Client-side routing |
| `recharts` | 3.8.1 | MIT | Charting library (built on D3) |
| `tailwindcss` | 4.2.2 | MIT | Utility-first CSS framework |

## Direct Dependencies (Development)

| Package | Version | License | Description |
|---------|---------|---------|-------------|
| `@eslint/js` | 9.39.4 | MIT | ESLint core JavaScript rules |
| `@types/js-yaml` | 4.0.9 | MIT | TypeScript types for js-yaml |
| `@types/node` | 24.12.2 | MIT | TypeScript types for Node.js |
| `@types/react` | 19.2.14 | MIT | TypeScript types for React |
| `@types/react-dom` | 19.2.3 | MIT | TypeScript types for ReactDOM |
| `@vitejs/plugin-react` | 6.0.1 | MIT | Vite React plugin (Babel/SWC) |
| `eslint` | 9.39.4 | MIT | JavaScript/TypeScript linter |
| `eslint-plugin-react-hooks` | 7.0.1 | MIT | ESLint rules for React Hooks |
| `eslint-plugin-react-refresh` | 0.5.2 | MIT | ESLint rules for React Refresh |
| `globals` | 17.4.0 | MIT | Global identifier definitions |
| `typescript` | 6.0.2 | Apache-2.0 | TypeScript compiler |
| `typescript-eslint` | 8.58.1 | MIT | TypeScript ESLint integration |
| `vite` | 8.0.8 | MIT | Build tool and dev server |

## Transitive Dependency Summary

| Category | Count |
|----------|-------|
| Direct (production) | 9 |
| Direct (development) | 13 |
| Transitive (all) | ~265 |
| **Total unique packages** | **287** |

## Notable Transitive Dependencies

| Package | Version | Pulled by | Notes |
|---------|---------|-----------|-------|
| `d3-*` (10 packages) | 3.x–4.x | recharts | Data visualization primitives |
| `@babel/core` + plugins | 7.29.x | @vitejs/plugin-react | JSX compilation (dev only) |
| `lightningcss` | 1.32.0 | tailwindcss | CSS minification (native binary) |
| `rolldown` | 1.0.0-rc.15 | vite | Bundler (Rust-based) |
| `postcss` | 8.5.9 | tailwindcss | CSS processing |
| `immer` | 10.2.0 / 11.1.4 | recharts → @reduxjs/toolkit | Immutable state (two versions present) |
| `@reduxjs/toolkit` | 2.11.2 | recharts | State management (recharts internal) |

## Vulnerability Scan

```
$ npm audit
found 0 vulnerabilities
```

**Scan date:** 2026-04-09
**Registry:** https://registry.npmjs.org

### Known Issues

- No CVEs reported for any direct or transitive dependency at time of scan.
- `html-to-image` (1.11.13) replaced the previously used `html2canvas` for lighter bundle size and active maintenance.
- Two versions of `immer` are installed (10.2.0 and 11.1.4) due to recharts pulling `@reduxjs/toolkit`. This is a minor bloat issue, not a security concern.

## Extraneous Packages

The following packages are installed but not in the dependency tree (likely leftover from previous installs):

| Package | Version |
|---------|---------|
| `@emnapi/core` | 1.9.2 |
| `@emnapi/runtime` | 1.9.2 |
| `@emnapi/wasi-threads` | 1.2.1 |
| `@napi-rs/wasm-runtime` | 1.1.3 |
| `@tybys/wasm-util` | 0.10.1 |
| `tslib` | 2.8.1 |

These can be cleaned up with `npm prune`.

## License Summary

| License | Count |
|---------|-------|
| MIT | ~280 |
| ISC | 2 |
| Apache-2.0 | 1 (TypeScript) |
| BSD-2-Clause | 1 |
| CC0-1.0 | 1 |

All licenses are permissive and compatible with MIT-licensed projects. No copyleft (GPL/LGPL/AGPL) dependencies.
