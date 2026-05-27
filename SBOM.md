# Software Bill of Materials (SBOM)

**Project:** EyeMatics Clinical Demonstrator (EMD) — `emd-app`
**Application version:** 1.4.0
**Project license:** MIT
**Generated:** 2026-05-26 (v1.12 build, pre-release)
**Format:** Human-readable Markdown SBOM derived from `package.json` + `package-lock.json` (lockfileVersion 3) and per-package `license` fields.
**Supersedes:** the point-in-time `BOM.md` (v1.9.3, 2026-04-28), which is retained for history only. `SBOM.md` is the canonical, maintained software bill of materials going forward.
**Runtime:** Node.js ≥ 20 · npm ≥ 10 · ECMAScript modules (`"type": "module"`)

> ⚠️ Research & development prototype — **not a medical device**. No PHI; all shipped data is synthetic.

## Maintenance policy

**This SBOM MUST be updated at the end of each phase and before every release.** Whenever
dependencies are added, removed, or version-bumped (any change to `package.json` /
`package-lock.json`), regenerate the tables below and bump the **Generated** date. The
end-of-phase verification and the pre-release checklist both include an "SBOM current?" gate.

## Summary

| Metric | Value |
|--------|-------|
| Direct production dependencies | 20 |
| Direct development dependencies | 27 |
| Total installed packages (incl. transitive) | 405 |
| License distribution (direct deps) | MIT ×43 · ISC ×2 · BSD-3-Clause ×1 · Apache-2.0 ×1 |
| Copyleft / restrictive licenses | none — all direct dependencies are permissive |

All direct dependency licenses are OSI-approved permissive licenses compatible with the
project's MIT license. No GPL/AGPL/LGPL or other copyleft obligations are present in the
direct dependency set.

## Production dependencies

| Package | Declared range | Resolved | License |
|---------|----------------|----------|---------|
| `@tailwindcss/vite` | ^4.2.4 | 4.2.4 | MIT |
| `bcryptjs` | ^3.0.3 | 3.0.3 | BSD-3-Clause |
| `better-sqlite3` | ^12.9.0 | 12.9.0 | MIT |
| `compression` | ^1.8.1 | 1.8.1 | MIT |
| `cookie-parser` | ^1.4.7 | 1.4.7 | MIT |
| `express` | ^5.2.1 | 5.2.1 | MIT |
| `helmet` | ^8.1.0 | 8.1.0 | MIT |
| `html-to-image` | ^1.11.13 | 1.11.13 | MIT |
| `http-proxy-middleware` | ^3.0.5 | 3.0.5 | MIT |
| `js-yaml` | ^4.1.1 | 4.1.1 | MIT |
| `jsonwebtoken` | ^9.0.3 | 9.0.3 | MIT |
| `jwks-rsa` | ^3.2.0 | 3.2.2 | MIT |
| `lucide-react` | ^1.9.0 | 1.9.0 | ISC |
| `otplib` | ^12.0.1 | 12.0.1 | MIT |
| `qrcode` | ^1.5.4 | 1.5.4 | MIT |
| `react` | ^19.2.4 | 19.2.5 | MIT |
| `react-dom` | ^19.2.4 | 19.2.5 | MIT |
| `react-router-dom` | ^7.14.2 | 7.14.2 | MIT |
| `recharts` | ^3.8.1 | 3.8.1 | MIT |
| `tailwindcss` | ^4.2.4 | 4.2.4 | MIT |

**Role notes (key components):** `express` + `helmet` + `compression` + `cookie-parser` +
`http-proxy-middleware` — backend HTTP/security/proxy; `better-sqlite3` — audit log +
`refresh_sessions` + saved-search storage; `jsonwebtoken` + `jwks-rsa` + `bcryptjs` +
`otplib` + `qrcode` — auth (JWT/HS256, Keycloak JWKS prep, password hashing, TOTP 2FA);
`js-yaml` — `config/settings.yaml` loading; `react` + `react-dom` + `react-router-dom` —
UI; `recharts` — trajectory/outcome charts; `tailwindcss` + `@tailwindcss/vite` — styling;
`lucide-react` — icons; `html-to-image` — chart export.

## Development dependencies

| Package | Declared range | Resolved | License |
|---------|----------------|----------|---------|
| `@eslint/js` | ^9.39.4 | 9.39.4 | MIT |
| `@testing-library/react` | ^16.3.2 | 16.3.2 | MIT |
| `@types/better-sqlite3` | ^7.6.13 | 7.6.13 | MIT |
| `@types/compression` | ^1.8.1 | 1.8.1 | MIT |
| `@types/cookie-parser` | ^1.4.10 | 1.4.10 | MIT |
| `@types/express` | ^5.0.6 | 5.0.6 | MIT |
| `@types/js-yaml` | ^4.0.9 | 4.0.9 | MIT |
| `@types/jsonwebtoken` | ^9.0.10 | 9.0.10 | MIT |
| `@types/node` | ^24.12.2 | 24.12.2 | MIT |
| `@types/qrcode` | ^1.5.6 | 1.5.6 | MIT |
| `@types/react` | ^19.2.14 | 19.2.14 | MIT |
| `@types/react-dom` | ^19.2.3 | 19.2.3 | MIT |
| `@types/supertest` | ^7.2.0 | 7.2.0 | MIT |
| `@vitejs/plugin-react` | ^6.0.1 | 6.0.1 | MIT |
| `eslint` | ^9.39.4 | 9.39.4 | MIT |
| `eslint-plugin-react-hooks` | ^7.1.1 | 7.1.1 | MIT |
| `eslint-plugin-react-refresh` | ^0.5.2 | 0.5.2 | MIT |
| `eslint-plugin-simple-import-sort` | ^13.0.0 | 13.0.0 | MIT |
| `globals` | ^17.5.0 | 17.5.0 | MIT |
| `jsdom` | ^29.0.2 | 29.0.2 | MIT |
| `knip` | ^6.6.2 | 6.6.2 | ISC |
| `supertest` | ^7.2.2 | 7.2.2 | MIT |
| `tsx` | ^4.21.0 | 4.21.0 | MIT |
| `typescript` | ~6.0.3 | 6.0.3 | Apache-2.0 |
| `typescript-eslint` | ^8.59.0 | 8.59.0 | MIT |
| `vite` | ^8.0.10 | 8.0.10 | MIT |
| `vitest` | ^4.1.5 | 4.1.5 | MIT |

## Transitive dependencies

405 packages are installed in total (direct + transitive); the authoritative, fully-resolved
set with integrity hashes is `package-lock.json` (lockfileVersion 3), which is committed to
the repository and is the canonical machine-readable manifest. The tables above enumerate the
**direct** dependencies; transitive packages are pinned transitively by the lockfile.

## Notable considerations

- **`better-sqlite3`** is a native addon (compiled bindings); it requires a build toolchain
  on install and is platform-specific. It backs the audit log, refresh-session store, and
  saved-search persistence.
- **No environment-variable configuration** — all runtime configuration is in
  `config/settings.yaml` (project decision); secrets are not sourced from env.
- **No telemetry / external network calls** in the default offline posture; Keycloak/JWKS
  (`jwks-rsa`) is prep-only and inactive without a configured OIDC provider.

## How to regenerate

```bash
# Direct deps, resolved versions, and licenses (used to build the tables above):
npm ls --omit=dev --depth=0          # production direct deps
npm ls --depth=0                     # all direct deps
# License audit across the tree (optional tooling):
npx license-checker --summary        # or: npx @cyclonedx/cyclonedx-npm --output-file sbom.cdx.json
```

For a standards-based machine-readable SBOM (CycloneDX/SPDX), generate alongside this file:

```bash
npx @cyclonedx/cyclonedx-npm --output-format JSON --output-file sbom.cdx.json
```

---

*Sources of truth: `package.json` (direct deps) · `package-lock.json` (resolved + transitive,
lockfileVersion 3). Update this file at the end of each phase and before release.*
