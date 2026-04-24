# EyeMatics Clinical Demonstrator (EMD)

A web-based dashboard for analysing ophthalmological research data from IVOM treatments across multiple university hospital sites. Built as a prototype demonstrator for the EyeMatics research consortium.

> ⚠️ **Research & development use only.** EMD is a research prototype and is **not** a medical device. It must not be used for clinical decision-making, diagnosis, treatment, or any patient-care purpose. All data shipped with the project is synthetic.

## Quick Start

Clone the repo, install dependencies, then run the API and the UI in **two separate shells**.

**Prerequisites:** Node.js ≥ 20, npm ≥ 10

**Shell 1 — clone & start the API:**
```bash
mkdir -p ~/eyematics && cd ~/eyematics
git clone https://github.com/okohlbacher/eyematics-emd-app.git emd-app
cd emd-app
npm install
npm start
```

**Shell 2 — start the UI:**
```bash
cd ~/eyematics/emd-app
npm run dev
```

Open **http://localhost:5173** and log in. All seeded users share the default password `changeme2025!`:

| Username     | Role       | Password        |
|--------------|------------|-----------------|
| `admin`      | admin      | `changeme2025!` |
| `forscher1`  | researcher | `changeme2025!` |

---

## Development & Production

**Prerequisites:** Node.js ≥ 20, npm ≥ 10

### Development (two ports)

```bash
npm install
npm start &
npm run dev
```

API on `:3000` (localhost only), Vite dev server on `:5173` with HMR proxying `/api` → `:3000`. Log in with `admin` / `changeme2025!` (2FA off by default; OTP `123456` when enabled).

### Production (single port)

```bash
npm run build      # produces dist/
# add `server: { serveFrontend: true }` to config/settings.yaml
npm start          # Express serves UI + API on http://localhost:3000
```

For LAN access in production, set `server.host: '0.0.0.0'` in `config/settings.yaml`. By default the server binds to `127.0.0.1` (localhost only) for safety.

> See the full credential table and login flow in [docs/Benutzerhandbuch.md](docs/Benutzerhandbuch.md) §2.

## Available Scripts

| Command                    | Description                                              |
|----------------------------|----------------------------------------------------------|
| `npm run dev`              | Start the Vite development server                        |
| `npm run build`            | Type-check with TypeScript and build                     |
| `npm run preview`          | Serve the production build locally                       |
| `npm run lint`             | Run ESLint                                               |
| `npm start`                | Start production Express server                          |
| `npm test`                 | Run full Vitest suite                                    |
| `npm run test:ci`          | CI gate: skipped-test guard + full suite (608/608)       |
| `npm run test:check-skips` | Fail if any test is skipped without an allow-list entry  |
| `npm run knip`             | Dead-code / unused-export scan (config: `knip.json`)     |
| `npm run generate-bundles` | Regenerate synthetic FHIR bundles for configured sites   |

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

- **Cohort Builder** — filter by diagnosis, gender, age, visus, CRT, site; save/reload searches
- **Cohort Analysis** — distribution charts, temporal trends, scatter plots
- **Case Detail View** — visus/CRT dual-axis chart, baseline change, IOP, refraction, injections, medications, OCT viewer, anamnesis, findings, adverse events
- **Data Quality Review** — anomaly detection, error flagging, therapy discontinuation tracking, CSV export
- **Documentation Quality** — site-level benchmarking (completeness, plausibility, overall score)
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

## Sites (Test Data)

| Shorthand | Full Name                         | Patients (approx.) | Source   |
|-----------|-----------------------------------|--------------------|----------|
| UKA       | Universitätsklinikum Aachen       | 35                 | curated  |
| UKC       | Universitätsklinikum Chemnitz     | 45                 | generated|
| UKD       | Universitätsklinikum Dresden      | 45                 | generated|
| UKG       | Universitätsklinikum Greifswald   | 45                 | generated|
| UKL       | Universitätsklinikum Leipzig      | 45                 | generated|
| UKM       | Universitätsklinikum Münster      | 45                 | generated|
| UKMZ      | Universitätsmedizin Mainz         | 45                 | generated|
| UKT       | Universitätsklinikum Tübingen     | 30                 | curated  |

> Synthetic bundles for the six generated sites are produced by `npm run generate-bundles` (deterministic seeded output; see `scripts/generate-center-bundle.ts`).

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
