# EyeMatics Clinical Demonstrator (EMD)

A web-based dashboard for analysing ophthalmological research data from IVOM treatments across multiple university hospital centres. Built as a prototype demonstrator for the EyeMatics research consortium.

## Quick Start

**Prerequisites:** Node.js ≥ 20, npm ≥ 10

```bash
npm install
npm run dev
```

Open **http://localhost:5173** — log in with `admin` / `admin2025!` / OTP `123456`.

> See the full credential table and login flow in [docs/Benutzerhandbuch.md](docs/Benutzerhandbuch.md) §2.

## Available Scripts

| Command           | Description                          |
|-------------------|--------------------------------------|
| `npm run dev`     | Start the Vite development server    |
| `npm run build`   | Type-check with TypeScript and build |
| `npm run preview` | Serve the production build locally   |
| `npm run lint`    | Run ESLint                           |

## Project Structure

```
emd-app/
  docs/                       # Project documentation
    Benutzerhandbuch.md        #   German user guide
    Konfiguration.md           #   Configuration reference (settings.yaml)
    Lastenheft.md              #   Requirements specification
    Pflichtenheft.md           #   Functional specification
  server/                      # Vite server plugins (REST APIs)
  public/data/                 # FHIR test data bundles (JSON) + OCT images
  src/
    components/                # Reusable UI components
    components/case-detail/    # CaseDetailPage sub-components
    context/                   # React context providers (Auth, Data, Language)
    config/                    # Clinical thresholds and constants
    hooks/                     # Custom hooks (usePageAudit, useLocalStorageState)
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

Settings are stored in `public/settings.yaml` and editable via the Settings page (persisted server-side via `PUT /api/settings`).

```yaml
twoFactorEnabled: true
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
| Data      | HL7 FHIR R4 (static JSON bundles) |

> Full dependency list and vulnerability scan: [BOM.md](BOM.md).

## Centres (Test Data)

| Shorthand | Full Name                       | Patients |
|-----------|---------------------------------|----------|
| UKA       | Universitätsklinikum Aachen     | 35       |
| UKB       | Universitätsklinikum Bonn       | 30       |
| LMU       | LMU Klinikum München            | 30       |
| UKM       | Universitätsklinikum Münster    | 25       |
| UKT       | Universitätsklinikum Tübingen   | 30       |

## Documentation

| Document | Description |
|----------|-------------|
| [docs/Benutzerhandbuch.md](docs/Benutzerhandbuch.md) | User guide (German) |
| [docs/Konfiguration.md](docs/Konfiguration.md) | Configuration reference |
| [docs/Lastenheft.md](docs/Lastenheft.md) | Requirements specification |
| [docs/Pflichtenheft.md](docs/Pflichtenheft.md) | Functional specification |
| [BOM.md](BOM.md) | Bill of materials & vulnerability scan |
| [ISSUES.md](ISSUES.md) | Security, code quality & duplication review |

## OCT Image Attribution

OCT images from the OCTID — Optical Coherence Tomography Image Retinal Database, University of Waterloo (doi:10.5683/SP/YEM3RA, doi:10.5683/SP/FLGZZE). Licensed under CC BY 4.0.

## Co-Development

This project was co-developed with [Claude](https://claude.ai) (Anthropic), an AI assistant used for code generation, architecture design, and documentation.

## License

MIT License — see [LICENSE](LICENSE) for details.
