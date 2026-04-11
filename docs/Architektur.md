# Architektur — EyeMatics Klinischer Demonstrator (EMD)

**Version 1.1 — Stand: 11.04.2026**

---

## Systemübersicht

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (React SPA)                         │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │LoginPage │ │ Cohort   │ │ Quality  │ │  Admin   │ │  Audit   │ │
│  │          │ │ Builder  │ │  Review  │ │  Page    │ │  Page    │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ │
│       │             │            │             │            │       │
│  ┌────┴─────────────┴────────────┴─────────────┴────────────┴────┐ │
│  │                    AuthContext (JWT)                           │ │
│  │         sessionStorage['emd-token'] → Bearer Header           │ │
│  └───────────────────────┬───────────────────────────────────────┘ │
│                          │                                         │
│  ┌───────────────────────┴───────────────────────────────────────┐ │
│  │  DataContext          │  fhirLoader / dataSource              │ │
│  │  (server-backed)      │  GET /api/fhir/bundles                │ │
│  │  GET/PUT /api/data/*  │  (center-filtered server-side)        │ │
│  └───────────────────────┴───────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS (all requests carry JWT)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Express Server (Node.js)                        │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Middleware Stack                            │ │
│  │                                                                │ │
│  │  1. express.json()      — body parsing (/api/auth, /api/data) │ │
│  │  2. auditMiddleware     — logs ALL /api/* to SQLite           │ │
│  │  3. authMiddleware      — validates JWT (HS256 or RS256/JWKS) │ │
│  │     ├─ Public: /api/auth/login, /verify, /config              │ │
│  │     └─ Protected: everything else under /api/*                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  authApi      │  │  dataApi      │  │  fhirApi                │ │
│  │ /api/auth/*   │  │ /api/data/*   │  │ /api/fhir/bundles       │ │
│  │               │  │               │  │                          │ │
│  │ POST /login   │  │ quality-flags │  │ Loads bundles from:      │ │
│  │ POST /verify  │  │ saved-searches│  │  - public/data/*.json   │ │
│  │ GET  /config  │  │ excluded-cases│  │  - OR Blaze FHIR server │ │
│  │ GET  /users   │  │ reviewed-cases│  │                          │ │
│  │ POST /users   │  │               │  │ Center filtering:        │ │
│  │ DELETE /users │  │ Per-user,     │  │  JWT.centers → filter   │ │
│  │ PUT  /password│  │ JWT-scoped    │  │  before response        │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────────┘ │
│         │                  │                      │                 │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────────┴───────────────┐ │
│  │ data/        │  │ data/        │  │ public/data/             │ │
│  │ users.json   │  │ data.db      │  │ center-*.json            │ │
│  │ jwt-secret   │  │ (SQLite)     │  │ (blocked from static)    │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘ │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  auditApi     │  │  issueApi     │  │  settingsApi            │ │
│  │ /api/audit    │  │ /api/issues   │  │ /api/settings           │ │
│  │ (read-only)   │  │ (feedback)    │  │ (YAML read/write)       │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────────┘ │
│         │                  │                      │                 │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────────┴───────────────┐ │
│  │ data/        │  │ feedback/    │  │ config/                  │ │
│  │ audit.db     │  │ issue-*.json │  │ settings.yaml            │ │
│  │ (SQLite)     │  │              │  │ (outside webroot)        │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  /api/fhir-proxy → Blaze FHIR Server (auth required)       │   │
│  │  /data/*         → 403 Forbidden (blocked)                  │   │
│  │  express.static  → dist/ (Vite build output)                │   │
│  │  GET /*          → dist/index.html (SPA fallback)           │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Authentifizierungsfluss

```
  Browser                          Express Server
    │                                    │
    │  POST /api/auth/login              │
    │  { username, password }            │
    ├───────────────────────────────────►│
    │                                    │ bcrypt.compareSync()
    │                                    │ Rate limiting check
    │                                    │
    │  ┌─ 2FA disabled ─────────────────┐│
    │  │ { token: <session-jwt> }       ││ signSessionToken()
    │  └────────────────────────────────┘│
    │  ┌─ 2FA enabled ──────────────────┐│
    │  │ { challengeToken: <jwt> }      ││ signChallengeToken()
    │◄─┴────────────────────────────────┘│
    │                                    │
    │  POST /api/auth/verify             │
    │  { challengeToken, otp }           │
    ├───────────────────────────────────►│
    │                                    │ jwt.verify(challenge)
    │                                    │ otp === config.otpCode
    │  { token: <session-jwt> }          │
    │◄──────────────────────────────────┤│ signSessionToken()
    │                                    │
    │  sessionStorage['emd-token'] = jwt │
    │                                    │
    │  GET /api/fhir/bundles             │
    │  Authorization: Bearer <jwt>       │
    ├───────────────────────────────────►│
    │                                    │ authMiddleware:
    │                                    │   jwt.verify(token, secret)
    │                                    │   req.auth = payload
    │                                    │
    │  { bundles: [...] }                │ fhirApi:
    │  (center-filtered)                 │   filter by req.auth.centers
    │◄──────────────────────────────────┤│
```

### JWT-Payload

```json
{
  "sub": "admin",
  "preferred_username": "admin",
  "role": "admin",
  "centers": ["org-uka", "org-ukb", "org-lmu", "org-ukt", "org-ukm"],
  "iat": 1712880000,
  "exp": 1712880600
}
```

### Auth-Provider

| Modus | Signatur | Validierung | Konfiguration |
|-------|----------|-------------|---------------|
| `local` | HS256 (server secret) | `jwt.verify(token, jwtSecret)` | `auth.provider: local` |
| `keycloak` | RS256 (Keycloak JWKS) | `jwks-rsa` client | `auth.provider: keycloak` |

---

## Datenhaltung

```
data/
├── centers.json     ← Zentrenkonfiguration (id, shorthand, name, file)
├── users.json       ← Benutzer (username, passwordHash, role, centers[])
├── jwt-secret.txt   ← HS256 Schlüssel (auto-generiert, 64 Bytes hex)
├── audit.db         ← Audit-Log (SQLite, append-only, WAL mode)
└── data.db          ← Persistenz (SQLite: quality_flags, saved_searches,
                       excluded_cases, reviewed_cases — per-user scoped)

config/
└── settings.yaml    ← App-Konfiguration (auth, thresholds, dataSource)

public/data/
├── center-aachen.json    ← FHIR-Bundles (nur serverseitig gelesen)
├── center-bonn.json
├── center-muenchen.json
├── center-tuebingen.json
├── center-muenster.json
└── manifest.json         ← Optionale Dateiliste
```

### Sicherheitsprinzipien

| Prinzip | Umsetzung |
|---------|-----------|
| **Kein Client-Vertrauen** | Server validiert JWT, filtert Daten, prüft Center-Zugehörigkeit |
| **Audit-Immutabilität** | SQLite audit_log: kein DELETE/UPDATE, kein UI-Clear |
| **Credentials nie im Client** | Passwörter nur serverseitig (bcrypt), OTP nur in config/ |
| **Center-Filterung serverseitig** | FHIR-Bundles gefiltert vor Auslieferung, API prüft Schreibrechte |
| **Statischer Zugriff blockiert** | `/data/*` → 403, settings.yaml nicht im Webroot |

---

## Vite Dev Mode vs. Production

| Aspekt | `npm run dev` (Vite) | `npm start` (Express) |
|--------|---------------------|----------------------|
| Server | Vite Dev Server + Plugins | Express 5 |
| Auth-Validierung | `validateAuth()` (base64, KNOWN_USERS) | `authMiddleware` (JWT, HS256/RS256) |
| FHIR-Daten | `fhirApiPlugin` liest `public/data/` | `fhirApiRouter` liest `public/data/` oder Blaze |
| Audit | Nicht persistent (dev) | SQLite `data/audit.db` |
| Settings | `public/settings.yaml` (Vite static) | `config/settings.yaml` |
| FHIR Proxy | Vite proxy → `localhost:8080` | `/api/fhir-proxy` (auth-geschützt) |
| Static `/data/*` | Zugänglich (Vite serves public/) | Blockiert (403) |

---

## DSF-Integrationsarchitektur (Multi-Site)

```
┌─────────────────────────────────────────────────────────────┐
│                     Standort (Site)                          │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Klinisches   │    │ DSF Site     │    │ Lokales FHIR │  │
│  │ Quellsystem  │───►│ Node (BPE)   │───►│ Repository   │  │
│  │ (ETL, Pseudo)│    │              │    │ (Blaze)      │  │
│  └──────────────┘    └──────┬───────┘    └──────┬───────┘  │
│                             │                    │          │
│                     DSF orchestriert      EMD liest nur     │
│                     inter-site            lokale Daten       │
│                             │                    │          │
│                             │            ┌──────┴───────┐  │
│                             │            │ EMD Backend   │  │
│                             │            │ (Express)     │  │
│                             │            └──────┬───────┘  │
│                             │                    │          │
│                             │            ┌──────┴───────┐  │
│                             │            │ EMD Frontend  │  │
│                             │            │ (React SPA)   │  │
│                             │            └──────────────┘  │
└─────────────────────────────┴───────────────────────────────┘

Prinzip: EMD → lokales Repository → nur eigene Standortdaten
         DSF → inter-site Orchestrierung (Transport, Trust, Workflows)
```

---

## API-Endpunkte

| Pfad | Methode | Auth | Beschreibung |
|------|---------|------|--------------|
| `/api/auth/login` | POST | - | Credentials → JWT oder challengeToken |
| `/api/auth/verify` | POST | - | OTP + challengeToken → JWT |
| `/api/auth/config` | GET | - | 2FA-Status, Provider |
| `/api/auth/users` | GET | Admin | Alle Benutzer |
| `/api/auth/users` | POST | Admin | Benutzer anlegen (generiertes Passwort) |
| `/api/auth/users/:name` | DELETE | Admin | Benutzer löschen |
| `/api/auth/users/:name/password` | PUT | Admin | Passwort ändern |
| `/api/auth/users/me` | GET | JWT | Eigene Benutzerinfo |
| `/api/fhir/bundles` | GET | JWT | FHIR-Bundles (center-gefiltert) |
| `/api/fhir-proxy/*` | * | JWT | Proxy zum Blaze FHIR Server |
| `/api/data/quality-flags` | GET/PUT | JWT | Quality Flags (per-user) |
| `/api/data/saved-searches` | GET/POST/DELETE | JWT | Gespeicherte Suchen |
| `/api/data/excluded-cases` | GET/PUT | JWT | Ausgeschlossene Fälle |
| `/api/data/reviewed-cases` | GET/PUT | JWT | Geprüfte Fälle |
| `/api/audit` | GET | JWT | Audit-Log (read-only, gefiltert) |
| `/api/audit/export` | GET | Admin | Vollständiger Audit-Export |
| `/api/issues` | GET/POST | JWT | Issue-Reporting |
| `/api/issues/export` | GET | Admin | Issue-Export mit Screenshots |
| `/api/settings` | GET/PUT | JWT/Admin | Konfiguration lesen/schreiben |

---

*Dieses Dokument beschreibt die Architektur des EMD v1.1 (Frontend-Backend Integration).*
