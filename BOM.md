# Bill of Materials (BOM) — EyeMatics Clinical Demonstrator

Generated: 2026-04-24 (v1.9.1)

## Direct Dependencies (Production)

| Package | Version | License | Description |
|---------|---------|---------|-------------|
| `@tailwindcss/vite` | ^4.2.4 | MIT | Tailwind CSS Vite plugin |
| `bcryptjs` | ^3.0.3 | MIT | Password hashing (bcrypt, pure JS) |
| `better-sqlite3` | ^12.9.0 | MIT | SQLite3 bindings (audit + data persistence) |
| `compression` | ^1.8.1 | MIT | HTTP response compression middleware |
| `cookie-parser` | ^1.4.7 | MIT | Cookie parsing middleware (refresh-token cookie) |
| `express` | ^5.2.1 | MIT | HTTP server framework |
| `helmet` | ^8.1.0 | MIT | HTTP security headers (CSP, HSTS, X-Frame-Options) |
| `html-to-image` | ^1.11.13 | MIT | DOM-to-image screenshot capture (feedback reporting) |
| `http-proxy-middleware` | ^3.0.5 | MIT | FHIR proxy middleware |
| `js-yaml` | ^4.1.1 | MIT | YAML parser/serializer (settings.yaml) |
| `jsonwebtoken` | ^9.0.3 | MIT | JWT signing and verification (HS256) |
| `jwks-rsa` | ^3.2.0 | MIT | JWKS client for Keycloak RS256 validation |
| `lucide-react` | ^1.9.0 | ISC | Icon library (React bindings) |
| `otplib` | ^12.0.1 | MIT | TOTP (2FA) code generation & verification |
| `qrcode` | ^1.5.4 | MIT | QR code generation (TOTP enrollment) |
| `react` | ^19.2.4 | MIT | UI framework |
| `react-dom` | ^19.2.4 | MIT | React DOM renderer |
| `react-router-dom` | ^7.14.2 | MIT | Client-side routing |
| `recharts` | ^3.8.1 | MIT | Charting library (built on D3) |
| `tailwindcss` | ^4.2.4 | MIT | Utility-first CSS framework |

## Direct Dependencies (Development)

| Package | Version | License | Description |
|---------|---------|---------|-------------|
| `@eslint/js` | ^9.39.4 | MIT | ESLint core JavaScript rules |
| `@testing-library/react` | ^16.3.2 | MIT | React component testing utilities |
| `@types/better-sqlite3` | ^7.6.13 | MIT | TypeScript types for better-sqlite3 |
| `@types/compression` | ^1.8.1 | MIT | TypeScript types for compression |
| `@types/cookie-parser` | ^1.4.10 | MIT | TypeScript types for cookie-parser |
| `@types/express` | ^5.0.6 | MIT | TypeScript types for Express |
| `@types/js-yaml` | ^4.0.9 | MIT | TypeScript types for js-yaml |
| `@types/jsonwebtoken` | ^9.0.10 | MIT | TypeScript types for jsonwebtoken |
| `@types/node` | ^24.12.2 | MIT | TypeScript types for Node.js |
| `@types/qrcode` | ^1.5.6 | MIT | TypeScript types for qrcode |
| `@types/react` | ^19.2.14 | MIT | TypeScript types for React |
| `@types/react-dom` | ^19.2.3 | MIT | TypeScript types for ReactDOM |
| `@types/supertest` | ^7.2.0 | MIT | TypeScript types for supertest |
| `@vitejs/plugin-react` | ^6.0.1 | MIT | Vite React plugin (Babel/SWC) |
| `eslint` | ^9.39.4 | MIT | JavaScript/TypeScript linter |
| `eslint-plugin-react-hooks` | ^7.1.1 | MIT | ESLint rules for React Hooks |
| `eslint-plugin-react-refresh` | ^0.5.2 | MIT | ESLint rules for React Refresh |
| `eslint-plugin-simple-import-sort` | ^13.0.0 | MIT | ESLint plugin for import/export sorting |
| `globals` | ^17.5.0 | MIT | Global identifier definitions |
| `jsdom` | ^29.0.2 | MIT | DOM implementation for component tests |
| `knip` | ^6.6.2 | ISC | Dead-code / unused-export scanner |
| `supertest` | ^7.2.2 | MIT | HTTP assertions for API testing |
| `tsx` | ^4.21.0 | MIT | TypeScript execution (for npm start) |
| `typescript` | ~6.0.3 | Apache-2.0 | TypeScript compiler |
| `typescript-eslint` | ^8.59.0 | MIT | TypeScript ESLint integration |
| `vite` | ^8.0.10 | MIT | Build tool and dev server |
| `vitest` | ^4.1.5 | MIT | Test runner (Vite-native) |

## Dependency Summary

| Category | Count |
|----------|-------|
| Direct (production) | 20 |
| Direct (development) | 27 |
| Total direct | 47 |
| Unused dependencies | 0 (verified via `npm run knip`) |

## Vulnerability Scan

```
$ npm audit --audit-level=moderate
found 0 vulnerabilities
```

**Scan date:** 2026-04-24
**Registry:** https://registry.npmjs.org
**Overrides:** `follow-redirects@^1.16.0` (GHSA-r4q5-vmmm-2653 — Phase 23)

## License Summary

| License | Count |
|---------|-------|
| MIT | ~44 |
| ISC | 2 (`lucide-react`, `knip`) |
| Apache-2.0 | 1 (`typescript`) |

All licenses are permissive and compatible with MIT-licensed projects. No copyleft (GPL/LGPL/AGPL) dependencies.

## Security-Relevant Dependencies

| Package | Role | Notes |
|---------|------|-------|
| `bcryptjs` | Password hashing | 12 rounds, async compare/hash, pure JS |
| `jsonwebtoken` | JWT sign/verify | HS256 for local auth; direct imports restricted via ESLint `no-restricted-imports` — all call sites go through `server/jwtUtil.ts` |
| `jwks-rsa` | JWKS validation | RS256 for Keycloak auth |
| `otplib` | TOTP 2FA | RFC 6238 time-based one-time passwords |
| `better-sqlite3` | Audit + data storage | WAL mode, native addon |
| `cookie-parser` | Refresh-token cookie | httpOnly · Secure · SameSite=Strict · scoped to `/api/auth/refresh` |
| `express` | HTTP server | v5 with path-to-regexp v8 |
| `helmet` | Security headers | CSP, HSTS, X-Frame-Options, X-Content-Type-Options |

## Test Coverage

```
$ npm run test:ci
 Test Files  57 passed (57)
      Tests  608 passed (608)
```

## Deferred Upgrades

5 major version bumps deferred to a future milestone with per-package blocker notes:

- `eslint` 9 → 10
- `@eslint/js` 9 → 10
- `jwks-rsa` 3 → 4
- `otplib` 12 → 13
- `@types/node` 24 → 25

See [DEFERRED-UPGRADES.md](DEFERRED-UPGRADES.md) for revisit triggers.

## Changes since v1.4

- **v1.9.1 (2026-04-24)** — Phase 23 dependency & lint cleanup:
  - `follow-redirects` pinned via `package.json#overrides` to resolve GHSA-r4q5-vmmm-2653 (0 audit vulnerabilities).
  - Minor/patch bumps: `@tailwindcss/vite`, `tailwindcss`, `typescript`, `vitest`, `vite`, `eslint-plugin-react-hooks`, `globals`, `lucide-react`, `react-router-dom`, `better-sqlite3`, `typescript-eslint`.
  - Added: `knip` (dead-code scan, Phase 22).
  - Removed: `@types/bcryptjs` (unused — flagged by knip, Phase 22).
