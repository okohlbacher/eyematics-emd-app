# Deferred Upgrades

Major-version dep upgrades deferred from Phase 23 per D-05.
Revisit triggers documented per package.

## eslint

- **Current:** 9.39.4
- **Latest:** 10.2.1
- **Blocker:** v10 drops Node 18 support and changes flat-config resolution semantics; peer-dep impact on typescript-eslint and eslint-plugin-react-hooks unverified.
- **Revisit trigger:** When `typescript-eslint@9.x` ships with stable `eslint@10.x` peer range, or next milestone's test/lint phase.

## @eslint/js

- **Current:** 9.39.4
- **Latest:** 10.0.1
- **Blocker:** Must track `eslint` major. See above.
- **Revisit trigger:** Same as `eslint`.

## jwks-rsa

- **Current:** 3.2.0
- **Latest:** 4.0.1
- **Blocker:** v4 changes JWKS fetch cache semantics; Phase 20 Keycloak prep work relies on current cache behavior (KEYCLK-01 path).
- **Revisit trigger:** KEYCLK-01 (Keycloak OIDC redirect) planning phase — must verify jwks-rsa v4 compatibility pre-migration.

## otplib

- **Current:** 12.0.1
- **Latest:** 13.4.0
- **Blocker:** v13 refactors the hotp/totp entry-points; Phase 15 TOTP 2FA code directly imports from `otplib/hotp` / `otplib/totp` paths that changed in v13.
- **Revisit trigger:** A future phase that re-examines TOTP flow (e.g., recovery-code UX revamp).

## @types/node

- **Current:** 24.12.2
- **Latest:** 25.6.0
- **Blocker:** v25 tracks Node 24 runtime; repo currently runs/tests on Node 20+ per engines. Bumping types ahead of runtime can surface false positives.
- **Revisit trigger:** When CI pipeline adopts Node 24 LTS.
