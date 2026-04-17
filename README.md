# EyeMatics Clinical Demonstrator (EMD)

A web-based dashboard for analysing ophthalmological research data from IVOM treatments across multiple university hospital centres. Built as a prototype demonstrator for the EyeMatics research consortium.

## Quick Start

**Prerequisites:** Node.js ≥ 20, npm ≥ 10

```bash
npm install
npm run dev
```

Open **http://localhost:5173** — log in with `admin` / `changeme2025!` (2FA is off by default; OTP `123456` when enabled).

> See the full credential table and login flow in [docs/Benutzerhandbuch.md](docs/Benutzerhandbuch.md) §2.

## Available Scripts

| Command           | Description                          |
|-------------------|--------------------------------------|
| `npm run dev`     | Start the Vite development server    |
| `npm run build`   | Type-check with TypeScript and build |
| `npm run preview` | Serve the production build locally   |
| `npm run lint`    | Run ESLint                           |
| `npm start`       | Start production Express server      |
| `npm test`        | Run test suite (221 tests)           |

## Project Structure

```
emd-app/
  docs/                       # Project documentation
    Benutzerhandbuch.md        #   German user guide
    Konfiguration.md           #   Configuration reference (settings.yaml)
    Lastenheft.md              #   Requirements specification
    Pflichtenheft.md           #   Functional specification
  server/                      # Express production server (REST APIs, auth, audit)
  public/data/                 # FHIR test data bundles (JSON) + OCT images
  src/
    components/                # Reusable UI components
    components/case-detail/    # CaseDetailPage sub-components
    context/                   # React context providers (Auth, Data, Language)
    config/                    # Clinical thresholds and constants
    hooks/                     # Custom hooks (useCaseData)
    i18n/                      # Translations (de/en)
    pages/                     # Page components
    services/                  # Data loading, audit, settings, issues
    utils/                     # Shared utilities (download, dateFormat, safeJson, etc.)
    types/                     # TypeScript FHIR type definitions
```

## Data Model

The application works with HL7 FHIR R4 bundles containing Patient, Condition, Observation, Procedure, MedicationStatement, ImagingStudy, and Organization resources. All patient data is **synthetic test data**.

## Key Features

- **Cohort Builder** — filter by diagnosis, gender, age, visus, CRT, centre; save/reload searches
- **Cohort Analysis** — distribution charts, temporal trends, scatter plots
- **Case Detail View** — visus/CRT dual-axis chart, baseline change, IOP, refraction, injections, medications, OCT viewer, anamnesis, findings, adverse events
- **Data Quality Review** — anomaly detection, error flagging, therapy discontinuation tracking, CSV export
- **Documentation Quality** — centre-level benchmarking (completeness, plausibility, overall score)
- **Audit Trail** — timestamped log of all user actions with filtering and CSV export
- **Issue Reporting** — per-page feedback with automatic screenshot capture and server-side storage
- **i18n** — full German/English bilingual support
- **Role-based Access** — 6 user roles with admin route guards
- **Settings** — 2FA toggle, therapy thresholds, data source config (local files or Blaze FHIR server)

> For detailed feature descriptions see [docs/Benutzerhandbuch.md](docs/Benutzerhandbuch.md).

## Configuration

Settings are stored in `config/settings.yaml` (outside the webroot) and editable via the Settings page (persisted server-side via `PUT /api/settings`).

```yaml
provider: local
twoFactorEnabled: false
maxLoginAttempts: 5
otpCode: '123456'
therapyInterrupterDays: 120
therapyBreakerDays: 365
dataSource:
  type: local                   # "local" or "blaze"
  blazeUrl: http://localhost:8080/fhir
```

> Full configuration reference: [docs/Konfiguration.md](docs/Konfiguration.md).

## Blaze FHIR Server (Optional)

```bash
# One-command setup (requires Docker)
./scripts/load-blaze.sh

# Then: Settings > Data Source > FHIR Server → http://localhost:8080/fhir
```

> See [docs/Konfiguration.md](docs/Konfiguration.md) for manual setup and custom port options.

## Technology Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Framework | React 19 + TypeScript 6           |
| Build     | Vite 8                            |
| Styling   | Tailwind CSS 4                    |
| Charts    | Recharts 3                        |
| Icons     | Lucide React                      |
| Routing   | React Router 7                    |
| Server    | Express 5 + SQLite (better-sqlite3) |
| Auth      | JWT (bcrypt, HS256/RS256, optional Keycloak) |
| Data      | HL7 FHIR R4 (local JSON or Blaze FHIR server) |

> Full dependency list and vulnerability scan: [BOM.md](BOM.md).

## Centres (Test Data)

| Shorthand | Full Name                         | Patients (approx.) | Source   |
|-----------|-----------------------------------|--------------------|----------|
| UKA       | Universitätsklinikum Aachen       | 35                 | curated  |
| UKC       | Universitätsklinikum Chemnitz     | 45                 | generated|
| UKD       | Universitätsklinikum Dresden      | 45                 | generated|
| UKG       | Universitätsklinikum Greifswald   | 45                 | generated|
| UKL       | Universitätsklinikum Leipzig      | 45                 | generated|
| UKMZ      | Universitätsmedizin Mainz         | 45                 | generated|
| UKT       | Universitätsklinikum Tübingen     | 30                 | curated  |

> Synthetic bundles for the five generated sites are produced by `npm run generate-bundles` (deterministic seeded output; see `scripts/generate-center-bundle.ts`).

## Documentation

| Document | Description |
|----------|-------------|
| [docs/Benutzerhandbuch.md](docs/Benutzerhandbuch.md) | User guide (German) |
| [docs/Konfiguration.md](docs/Konfiguration.md) | Configuration reference |
| [docs/Lastenheft.md](docs/Lastenheft.md) | Requirements specification |
| [docs/Pflichtenheft.md](docs/Pflichtenheft.md) | Functional specification |
| [docs/Anforderungsabgleich.md](docs/Anforderungsabgleich.md) | Requirements traceability matrix |
| [docs/architecture.md](docs/architecture.md) | Architecture documentation |
| [BOM.md](BOM.md) | Bill of materials & vulnerability scan |
| [ISSUES.md](ISSUES.md) | Security, code quality & duplication review |

## OCT Image Attribution

OCT images from the OCTID — Optical Coherence Tomography Image Retinal Database, University of Waterloo (doi:10.5683/SP/YEM3RA, doi:10.5683/SP/FLGZZE). Licensed under CC BY 4.0.

## Co-Development

This project was co-developed with [Claude](https://claude.ai) (Anthropic), an AI assistant used for code generation, architecture design, and documentation.

## License

MIT License — see [LICENSE](LICENSE) for details.

## Authentication

The application uses JWT-based authentication (HS256, bcrypt password hashing, 12 rounds). Seven demo users are seeded in `data/users.json` with the default password `changeme2025!`.

| Username       | Role           | Centre Access         | Description                        |
|----------------|----------------|-----------------------|------------------------------------|
| `admin`        | `admin`        | All 7 centres         | Full access — user management, audit trail, settings |
| `forscher1`    | `researcher`   | UKA                   | Single-centre researcher           |
| `forscher2`    | `researcher`   | UKC                   | Single-centre researcher           |
| `epidemiologe` | `epidemiologist` | UKA, UKC, UKD       | Multi-centre data access           |
| `kliniker`     | `clinician`    | UKT                   | Clinical view of case data         |
| `diz_manager`  | `data_manager` | UKMZ                  | Data quality and documentation     |
| `klinikleitung`| `clinic_lead`  | All 7 centres         | Management-level cross-site view   |

**Role groups (enforced server-side):**
- `ADMIN_ROLES` — `admin`: user management, audit access, settings
- `CLINICAL_ROLES` — `researcher`, `epidemiologist`, `clinician`, `data_manager`, `clinic_lead`: cohort and case data
- `QUALITY_ROLES` — `admin`, `clinic_lead`, `data_manager`: documentation quality benchmarking

**2FA:** Disabled by default. When enabled (`twoFactorEnabled: true` in `config/settings.yaml`), the login flow issues a challenge token and requires the OTP code configured as `otpCode` (default `123456`).

**Keycloak:** Set `provider: keycloak` and `keycloak.issuer` in `config/settings.yaml` to use external OIDC instead of local JWT.

## Production Deployment

```bash
# 1. Install dependencies and build the frontend
npm install
npm run build        # runs tsc -b && vite build → output in dist/

# 2. Start the Express server (serves static dist/ + REST APIs)
npm start            # node --import tsx server/index.ts
```

The server listens on port `3000` by default (configurable via `server.port` in `config/settings.yaml`). The production URL is `http://<host>:3000`.

**Environment checklist before first start:**
- `config/settings.yaml` — copy from the template and set `provider`, `dataSource`, and `audit.cohortHashSecret`
- `data/jwt-secret.txt` — generated automatically on first start (do not commit to version control)
- `data/users.json` — seeded automatically from defaults on first start

> The `dist/` directory is served as static files by Express — no separate web server (nginx, etc.) is required for a single-host deployment.

## Shared Module

`shared/` is a runtime-neutral TypeScript module imported by both the Express server and the React frontend. It contains logic that must stay consistent across the boundary:

| File | Purpose |
|------|---------|
| `shared/cohortTrajectory.ts` | Cohort trajectory computation shared between client charts and server aggregation |
| `shared/fhirCodes.ts` | FHIR coding system constants (SNOMED, LOINC, custom codes) |
| `shared/fhirQueries.ts` | FHIR resource query helpers used in both Blaze proxy and local loader |
| `shared/intervalMetric.ts` | Injection-interval metric definitions |
| `shared/outcomesProjection.ts` | Outcomes projection calculation (server pre-aggregation + client rendering) |
| `shared/patientCases.ts` | Patient case extraction from FHIR bundles |
| `shared/responderMetric.ts` | Responder classification logic |
| `shared/types/fhir.ts` | TypeScript FHIR R4 type definitions |

> Code in `shared/` must not import from `server/` or `src/` — it is a dependency leaf with no side-effects.
