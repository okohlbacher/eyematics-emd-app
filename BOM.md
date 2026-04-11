# Bill of Materials (BOM) — EyeMatics Clinical Demonstrator

Generated: 2026-04-11 (v1.3, after full-review fixes)

## Direct Dependencies (Production)

| Package | Version | License | Description |
|---------|---------|---------|-------------|
| `@tailwindcss/vite` | 4.2.2 | MIT | Tailwind CSS Vite plugin |
| `bcryptjs` | 3.0.3 | MIT | Password hashing (bcrypt, pure JS) |
| `better-sqlite3` | 12.8.0 | MIT | SQLite3 bindings (audit + data persistence) |
| `express` | 5.2.1 | MIT | HTTP server framework |
| `helmet` | 8.1.0 | MIT | HTTP security headers (CSP, HSTS, X-Frame-Options) |
| `html-to-image` | 1.11.13 | MIT | DOM-to-image screenshot capture |
| `http-proxy-middleware` | 3.0.5 | MIT | FHIR proxy middleware |
| `js-yaml` | 4.1.1 | MIT | YAML parser/serializer (settings.yaml) |
| `jsonwebtoken` | 9.0.3 | MIT | JWT signing and verification (HS256) |
| `jwks-rsa` | 3.2.2 | MIT | JWKS client for Keycloak RS256 validation |
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
| `@types/bcryptjs` | 2.4.6 | MIT | TypeScript types for bcryptjs |
| `@types/better-sqlite3` | 7.6.13 | MIT | TypeScript types for better-sqlite3 |
| `@types/express` | 5.0.6 | MIT | TypeScript types for Express |
| `@types/js-yaml` | 4.0.9 | MIT | TypeScript types for js-yaml |
| `@types/jsonwebtoken` | 9.0.10 | MIT | TypeScript types for jsonwebtoken |
| `@types/node` | 24.12.2 | MIT | TypeScript types for Node.js |
| `@types/react` | 19.2.14 | MIT | TypeScript types for React |
| `@types/react-dom` | 19.2.3 | MIT | TypeScript types for ReactDOM |
| `@types/supertest` | 7.2.0 | MIT | TypeScript types for supertest |
| `@vitejs/plugin-react` | 6.0.1 | MIT | Vite React plugin (Babel/SWC) |
| `eslint` | 9.39.4 | MIT | JavaScript/TypeScript linter |
| `eslint-plugin-react-hooks` | 7.0.1 | MIT | ESLint rules for React Hooks |
| `eslint-plugin-react-refresh` | 0.5.2 | MIT | ESLint rules for React Refresh |
| `eslint-plugin-simple-import-sort` | 13.0.0 | MIT | ESLint plugin for import/export sorting |
| `globals` | 17.4.0 | MIT | Global identifier definitions |
| `supertest` | 7.2.2 | MIT | HTTP assertions for testing |
| `tsx` | 4.21.0 | MIT | TypeScript execution (for npm start) |
| `typescript` | 6.0.2 | Apache-2.0 | TypeScript compiler |
| `typescript-eslint` | 8.58.1 | MIT | TypeScript ESLint integration |
| `vite` | 8.0.8 | MIT | Build tool and dev server |
| `vitest` | 4.1.4 | MIT | Test runner (Vite-native) |

## Dependency Summary

| Category | Count |
|----------|-------|
| Direct (production) | 16 |
| Direct (development) | 22 |
| Total direct | 38 |

## Vulnerability Scan

```
$ npm audit
found 0 vulnerabilities
```

**Scan date:** 2026-04-11
**Registry:** https://registry.npmjs.org

## License Summary

| License | Count |
|---------|-------|
| MIT | ~35 |
| ISC | 1 (lucide-react) |
| Apache-2.0 | 1 (TypeScript) |

All licenses are permissive and compatible with MIT-licensed projects. No copyleft (GPL/LGPL/AGPL) dependencies.

## Security-Relevant Dependencies

| Package | Role | Notes |
|---------|------|-------|
| `bcryptjs` | Password hashing | 12 rounds, async compare/hash, pure JS |
| `jsonwebtoken` | JWT sign/verify | HS256 for local auth |
| `jwks-rsa` | JWKS validation | RS256 for Keycloak auth |
| `better-sqlite3` | Audit + data storage | WAL mode, native addon |
| `express` | HTTP server | v5 with path-to-regexp v8 |
| `helmet` | Security headers | CSP, HSTS, X-Frame-Options, X-Content-Type-Options |

## Test Coverage

```
$ npx vitest run
Test Files  9 passed (9)
     Tests  106 passed (106)
```

Deployment smoke tests: 16/16 passed (auth, API, security, center filtering, audit scoping, helmet headers).
