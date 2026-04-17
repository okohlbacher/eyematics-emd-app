<!-- generated-by: gsd-doc-writer -->
# Getting Started

<!-- GSD:GENERATED 2026-04-17 -->

This guide walks through everything needed to run the EyeMatics EMD application locally for the first time.

---

## 1. Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | >= 20 | Tested with LTS; `node --version` to check |
| npm | >= 10 | Bundled with Node.js >= 18 |
| Docker | any | Optional — only required for the Blaze FHIR server |

No other global tools are needed. The Express server, Vite dev server, and TypeScript compiler are all installed locally via `npm install`.

---

## 2. Installation

```bash
git clone <repository-url>
cd emd-app
npm install
```

`npm install` installs both production and development dependencies. No separate build step is required to run in development mode.

---

## 3. Configuration

All configuration lives in `config/settings.yaml`. The file is present in the repository with safe development defaults. No changes are required to run locally with the bundled test data.

**Settings you should review before first run:**

| Key | Default | When to change |
|-----|---------|----------------|
| `dataSource.type` | `blaze` | Change to `local` to use the bundled FHIR JSON files instead of a Blaze server |
| `dataSource.blazeUrl` | `http://localhost:8080/fhir` | Only relevant when `type: blaze` |
| `otpCode` | `123456` | OTP used when 2FA is enabled; change in production |
| `audit.cohortHashSecret` | `dev-cohort-hash-secret-please-replace-in-prod-xxxxxxxxxxxxxx` | Replace with a strong random string in production |

For local development with the bundled test data, set `dataSource.type` to `local`:

```yaml
dataSource:
  type: local
  blazeUrl: http://localhost:8080/fhir
```

> Full configuration reference: [docs/CONFIGURATION.md](CONFIGURATION.md)

---

## 4. Starting the Development Server

```bash
npm run dev
```

This starts the Vite development server. Open `http://localhost:5173` in your browser. The Vite dev server proxies all `/api/*` requests to the Express backend.

The Express backend is **not** started by `npm run dev`. For full API functionality in development you either:

- run `npm start` in a second terminal (starts the Express server on port 3000), or
- rely on the Vite proxy, which requires the Express server to be running on port 3000.

To start the Express server separately:

```bash
npm start
```

On first startup the server:
1. Reads `config/settings.yaml` (exits immediately if the file is missing or unparseable).
2. Creates the `data/` directory if it does not exist.
3. Seeds `data/users.json` with the 7 default demo users if the file does not exist.
4. Generates `data/jwt-secret.txt` (64 hex characters) if it does not exist.
5. Opens or creates the SQLite audit database in `data/`.
6. Listens on `http://0.0.0.0:3000`.

---

## 5. Demo Login

Seven demo users are seeded automatically on first start. All share the default password `changeme2025!`.

| Username | Role | Centre Access |
|----------|------|---------------|
| `admin` | `admin` | All 7 centres |
| `forscher1` | `researcher` | UKA |
| `forscher2` | `researcher` | UKC |
| `epidemiologe` | `epidemiologist` | UKA, UKC, UKD |
| `kliniker` | `clinician` | UKT |
| `diz_manager` | `data_manager` | UKMZ |
| `klinikleitung` | `clinic_lead` | All 7 centres |

**Two-factor authentication** is disabled by default (`twoFactorEnabled: false` in `config/settings.yaml`). When enabled, the login flow will prompt for a one-time code — use the value set in `otpCode` (default `123456`).

---

## 6. Loading FHIR Data

The application ships with pre-generated FHIR R4 test bundles in `public/data/`:

```
public/data/
  center-aachen.json
  center-chemnitz.json
  center-dresden.json
  center-greifswald.json
  center-leipzig.json
  center-mainz.json
  center-tuebingen.json
```

These files are loaded automatically when `dataSource.type: local`. No additional setup is required.

**Regenerating bundles** (five synthetically generated centres):

```bash
npm run generate-bundles
```

This runs `scripts/generate-all-bundles.ts` and overwrites the generated centre bundles with deterministic seeded output. The Aachen and Tübingen bundles are hand-curated and are not overwritten.

**Optional: Blaze FHIR server**

To use a live Blaze FHIR server instead of the bundled files:

```bash
# Requires Docker
./scripts/load-blaze.sh
```

Then set `dataSource.type: blaze` and `dataSource.blazeUrl: http://localhost:8080/fhir` in `config/settings.yaml`.

---

## 7. Running Tests

```bash
npm test
```

This runs the full test suite with Vitest. The suite currently contains 430 passing tests across 46 test files, covering server API routes, auth logic, FHIR data handling, React components, and shared computation modules. Tests complete in approximately 2 seconds.

---

## 8. Next Steps

| Document | Description |
|----------|-------------|
| [docs/CONFIGURATION.md](CONFIGURATION.md) | All `config/settings.yaml` keys and their defaults |
| [docs/architecture.md](architecture.md) | System architecture, data flow, and module boundaries |
| [docs/Benutzerhandbuch.md](Benutzerhandbuch.md) | Full user guide (German) |
| [docs/keycloak-setup.md](keycloak-setup.md) | External OIDC authentication via Keycloak |
