# Architektur — EyeMatics Klinischer Demonstrator (EMD)

**Version 1.4 — Stand: 11.04.2026**

> Siehe auch: [architecture.svg](architecture.svg) fuer das visuelle Architekturdiagramm.

---

## Vier-Zonen-Modell

Jeder Standort betreibt den EMD-Stack eigenstaendig. Die Architektur folgt einem Vier-Zonen-Modell:

**Zone 1 — Klinische Quellzone:** Klinische Informationssysteme (KIS/KAS/EPA), ETL-Prozesse und Pseudonymisierung. Die Daten werden in den EyeMatics-Kerndatensatz transformiert (FHIR R4) und in ein lokales FHIR-Repository (Blaze) geschrieben.

**Zone 2 — DSF-Standortknoten:** Der DSF (Data Sharing Framework) orchestriert den standortuebergreifenden Datenaustausch ueber FHIR R4 und BPMN 2.0. Jeder Standort betreibt einen eigenen DSF FHIR Server und eine BPE (Business Process Engine). Die Kommunikation zwischen Standorten erfolgt verschluesselt ueber mTLS mit Standort-Zertifikaten.

**Zone 3 — EMD Backend:** Ein Express 5 Server, der ausschliesslich aus dem lokalen FHIR-Repository liest. Der Server stellt alle API-Endpunkte bereit, validiert JWT-Tokens, erzwingt zentrenbasierte Datenbeschraenkung und fuehrt ein manipulationssicheres Audit-Log in SQLite.

**Zone 4 — Browser:** Die React SPA kommuniziert ausschliesslich mit dem eigenen lokalen Backend ueber `authFetch()`, einen zentralen Fetch-Wrapper mit JWT-Bearer-Authentifizierung und automatischer 401-Weiterleitung zur Login-Seite bei abgelaufenem Token.

## Architekturprinzip

EMD kommuniziert niemals direkt mit anderen Kliniken. Der Express-Server liest nur aus dem lokalen FHIR-Speicher (Blaze oder lokale JSON-Dateien). DSF befuellt den lokalen Speicher ueber standortuebergreifende Workflows. Diese Trennung stellt sicher, dass die Verantwortung fuer Transport-Sicherheit (DSF) und Nutzer-Authentifizierung (EMD) klar getrennt ist.

## Middleware-Kette

Alle API-Anfragen durchlaufen vier Middleware-Schichten in fester Reihenfolge:

1. **helmet** — HTTP-Sicherheitsheader (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
2. **express.json()** — Body-Parsing fuer `/api/auth`, `/api/data`, `/api/issues`, `/api/fhir` Routen
3. **auditMiddleware** — Automatische Protokollierung jeder API-Anfrage in SQLite (inkl. Schwaerzung sensibler Felder wie Passwoerter und OTP-Codes, inkl. Request-Body-Erfassung fuer Mutationen)
4. **authMiddleware** — JWT-Validierung (HS256 fuer lokale Auth, RS256 via JWKS fuer Keycloak). Oeffentliche Pfade (`/api/auth/login`, `/verify`, `/config`) sind ausgenommen.

## API-Architektur

Alle API-Module verwenden Express Router (einheitliches Muster):

| Router | Pfad | Beschreibung |
|--------|------|--------------|
| `authApiRouter` | `/api/auth` | Login, 2FA, Benutzerverwaltung |
| `fhirApiRouter` | `/api/fhir` | FHIR-Bundles (zentrenfiltriert), Zentrenliste |
| `dataApiRouter` | `/api/data` | Per-user Persistenz (Flags, Suchen, Faelle) |
| `auditApiRouter` | `/api/audit` | Audit-Log (read-only, auto-scoped nach Rolle) |
| `issueApiRouter` | `/api/issues` | Issue-Reporting |
| `settingsApiRouter` | `/api/settings` | Konfiguration (YAML) |

Fuer den Vite-Entwicklungsmodus existieren schlanke Plugin-Wrapper, die dieselben Kernfunktionen aufrufen. Es gibt keine Code-Duplizierung zwischen Produktions- und Entwicklungsmodus.

## Authentifizierung

Der Login-Fluss ist ein- oder zweistufig (2FA standardmaessig deaktiviert): `POST /api/auth/login` validiert Credentials serverseitig (async `bcrypt.compare()`, nicht-blockierend) und gibt bei deaktivierter 2FA direkt einen Sitzungs-JWT zurueck. Bei aktivierter 2FA wird ein kurzlebiger Challenge-Token zurueckgegeben, und `POST /api/auth/verify` prueft den OTP-Code.

Der Client speichert den JWT in `sessionStorage` und verwendet `authFetch()` — einen zentralen Fetch-Wrapper, der automatisch den Bearer-Header setzt und bei 401-Antworten zur Login-Seite weiterleitet.

JWT-Payload: `{ sub, preferred_username, role, centers, iat, exp }` — identisches Format fuer lokale und Keycloak-Authentifizierung.

**Kontosperrung:** Nach 5 Fehlversuchen (konfigurierbar) wird das Konto mit exponentiellem Backoff gesperrt.

## Zentrenbasierte Datenbeschraenkung

Jeder Benutzer ist einem oder mehreren Zentren zugeordnet (im JWT-Payload als `centers` Array). Die Zentrenliste wird aus `data/centers.json` geladen und ist ueber `GET /api/fhir/centers` auch fuer den Client verfuegbar.

Der Server filtert FHIR-Bundles vor der Auslieferung: Lokale Bundles werden nach Organization-ID gefiltert, Blaze-Bundles nach `Patient.meta.source`. Die `/api/data/*` Endpunkte validieren bei Schreiboperationen strikt, dass alle referenzierten Faelle zu den Zentren des Benutzers gehoeren — unbekannte Case-IDs werden abgelehnt.

Der FHIR-Proxy (`/api/fhir-proxy`) ist auf Administratoren beschraenkt, um eine Umgehung der Zentrenfilterung ueber direkte Blaze-Anfragen zu verhindern.

**Audit-Scoping:** Nicht-Administratoren sehen im Audit-Log nur ihre eigenen Eintraege. Administratoren sehen alle.

## Datenhaltung

| Speicher | Pfad | Inhalt |
|----------|------|--------|
| Konfiguration | `config/settings.yaml` | provider, twoFactorEnabled, maxLoginAttempts, otpCode, therapyInterrupterDays, therapyBreakerDays, dataSource (ausserhalb Webroot) |
| Zentren | `data/centers.json` | Konfigurierbare Zentrenliste (`id`, `shorthand`, `name`, `file`) |
| Benutzer | `data/users.json` | Benutzername, bcrypt-Hash, Rolle, Zentren |
| JWT-Schluessel | `data/jwt-secret.txt` | HS256-Signaturschluessel (automatisch generiert) |
| Audit-Log | `data/audit.db` | SQLite, append-only, WAL-Modus, konfigurierbare Aufbewahrung |
| Persistenz | `data/data.db` | SQLite: Quality Flags, Saved Searches, Excluded/Reviewed Cases (per-user) |
| FHIR-Bundles | `public/data/center-*.json` | Lokale FHIR-Bundles (Zugriff in Production auf `/data/*` blockiert) |
| Feedback | `feedback/*.json` | Gemeldete Probleme mit Screenshots |

## Sicherheitsmodell

| Prinzip | Umsetzung |
|---------|-----------|
| **HTTP-Sicherheitsheader** | helmet: CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| **Kein Client-Vertrauen** | Server validiert JWT, filtert Daten, prueft Zentrenzugehoerigkeit |
| **Audit-Immutabilitaet** | SQLite audit_log ohne DELETE/UPDATE-Endpunkte, kein UI-Clear, Body-Erfassung fuer Mutationen |
| **Audit-Scoping** | Nicht-Admins sehen nur eigene Eintraege |
| **Credentials nie im Client** | Passwoerter nur serverseitig (async bcrypt), OTP nur in `config/settings.yaml` |
| **Statischer Zugriff blockiert** | `/data/*` gibt 403, `settings.yaml` nicht im Webroot |
| **Strikte Case-Validierung** | Unbekannte Case-IDs bei Schreiboperationen abgelehnt |
| **FHIR-Proxy admin-only** | Verhindert Zentren-Bypass ueber direkte Blaze-Anfragen |
| **401-Interceptor** | `authFetch()` leitet automatisch zur Login-Seite bei abgelaufenem JWT |

## API-Endpunkte

| Pfad | Methode | Auth | Beschreibung |
|------|---------|------|--------------|
| `/api/auth/login` | POST | — | Credentials validieren (async bcrypt) |
| `/api/auth/verify` | POST | — | OTP pruefen, JWT ausstellen |
| `/api/auth/config` | GET | — | 2FA-Status, Provider |
| `/api/auth/users` | GET/POST | Admin | Benutzerliste / Benutzer anlegen |
| `/api/auth/users/:username` | DELETE | Admin | Benutzer loeschen |
| `/api/auth/users/:username/password` | PUT | Admin | Passwort aendern |
| `/api/auth/users/me` | GET | JWT | Eigene Benutzerinfo |
| `/api/fhir/bundles` | GET | JWT | FHIR-Bundles (zentrenfiltriert) |
| `/api/fhir/centers` | GET | JWT | Zentrenliste (ID, Kuerzel, Name) |
| `/api/fhir-proxy/*` | * | Admin | Proxy zum Blaze FHIR Server |
| `/api/data/quality-flags` | GET/PUT | JWT | Quality Flags (per-user, zentrenvalidiert) |
| `/api/data/saved-searches` | GET/POST/DEL | JWT | Gespeicherte Suchen |
| `/api/data/excluded-cases` | GET/PUT | JWT | Ausgeschlossene Faelle (zentrenvalidiert) |
| `/api/data/reviewed-cases` | GET/PUT | JWT | Gepruefte Faelle (zentrenvalidiert) |
| `/api/audit` | GET | JWT | Audit-Log (auto-scoped nach Rolle) |
| `/api/audit/export` | GET | Admin | Vollstaendiger Audit-Export |
| `/api/issues` | GET/POST | JWT | Issue-Reporting |
| `/api/issues/export` | GET | Admin | Issue-Export mit Screenshots |
| `/api/settings` | GET/PUT | JWT/Admin | Konfiguration lesen/schreiben |

---

*Dieses Dokument beschreibt die Architektur des EMD v1.4. Fuer das visuelle Diagramm siehe [architecture.svg](architecture.svg).*

---

## Architecture Updates (v1.6)

*This section documents additions introduced in v1.6 (Phases 12–13) that post-date the German v1.4 content above. All new code is in English; this section is written in English to match.*

### shared/ Module (Phase 12)

A `shared/` directory was extracted at the project root to hold pure TypeScript modules consumed by both the browser (`src/`) and the Express server (`server/`). These modules contain no browser globals and no server-only Node.js APIs, making them importable from either runtime.

| File | Purpose |
|------|---------|
| `shared/cohortTrajectory.ts` | Core computation: `computeCohortTrajectory()` (Visus/logMAR) and `computeCrtTrajectory()` (CRT/µm). Exports types `YMetric`, `AxisMode`, `Eye`, `SpreadMode`. |
| `shared/outcomesProjection.ts` | Response shaping: `shapeOutcomesResponse()` produces the `AggregateResponse` envelope shared between the client path and the server endpoint. |
| `shared/patientCases.ts` | FHIR bundle traversal: `extractPatientCases()` and `applyFilters()`. Used by both client-side cohort building and server-side aggregation. |
| `shared/intervalMetric.ts` | Treatment-interval histogram computation. |
| `shared/responderMetric.ts` | Responder classification logic (threshold-based, session-configurable). |
| `shared/fhirQueries.ts` | Query helpers: `getObservationsByCode()`, `getLatestObservation()` — filter FHIR Observation arrays by LOINC code. |
| `shared/fhirCodes.ts` | LOINC and SNOMED code constants (leaf module, no imports). Key codes: `LOINC_VISUS = '79880-1'`, `LOINC_CRT = 'LP267955-5'`. |
| `shared/types/fhir.ts` | Shared TypeScript types: `PatientCase`, `CohortFilter`, and related FHIR-derived interfaces. |

### Outcomes Metrics (v1.6)

The Outcomes view exposes four metrics, each rendered as a separate tab in `OutcomesView`:

| Metric | Tab key | Unit | LOINC code |
|--------|---------|------|------------|
| Visus (visual acuity) | `visus` | logMAR | `79880-1` |
| Central retinal thickness | `crt` | µm | `LP267955-5` |
| Treatment-interval distribution | `interval` | days | — |
| Responder classification | `responder` | % patients | — |

### Server-Side Pre-Aggregation (Phase 12)

`POST /api/outcomes/aggregate` performs server-side cohort trajectory computation when a cohort exceeds the configurable patient threshold (default: 1000 patients, read from `settings.yaml` as `outcomes.serverAggregationThresholdPatients`).

**Handler behaviour:**

1. Centers are read exclusively from `req.auth` (JWT) — any center field in the request body is ignored.
2. The cohort is resolved by looking up the caller's saved-search store by `cohortId`.
3. A user-scoped cache key is computed. On hit, the response includes `meta.cacheHit: true`.
4. On cache miss, center-filtered FHIR bundles are loaded, `extractPatientCases` and `applyFilters` from `shared/patientCases.ts` are applied, and `computeCohortTrajectory` / `computeCrtTrajectory` from `shared/cohortTrajectory.ts` produce the trajectory. The result is shaped by `shapeOutcomesResponse` from `shared/outcomesProjection.ts`.
5. An `outcomes.aggregate` audit row is written containing `cohortHash` (never the raw cohort ID), `user`, `centers`, `payloadBytes`, and `cacheHit`.

**Cache:** In-memory, user-scoped, TTL defaults to 30 minutes. Configurable via `settings.yaml` key `outcomes.aggregateCacheTtlMs`. Implemented in `server/outcomesAggregateCache.ts`.

**Request body limits:** `express.json({ limit: '16kb' })` and `compression()` are applied to the route before the router (registered in `server/index.ts`).

The endpoint is added to the API table:

| Path | Method | Auth | Description |
|------|--------|------|-------------|
| `/api/outcomes/aggregate` | POST | JWT | Server-side cohort trajectory aggregation (center-filtered, cached) |

### Metric Selector Deep-Link

`OutcomesView` reads the `?metric=` URL search parameter on mount to set the active metric tab. Valid values are `visus`, `crt`, `interval`, and `responder`. Any unrecognised value falls back to `visus`. This enables bookmarkable and shareable links directly to a specific outcomes metric.

```
/outcomes?cohort=<id>&metric=crt
```

### Y-Axis Domains

Fixed Y-axis domains are enforced in `OutcomesPanel` (`src/components/outcomes/OutcomesPanel.tsx`) to ensure comparability across cohorts:

| Metric | Y-axis mode | Domain |
|--------|-------------|--------|
| Visus | `absolute` | `[0, 1]` logMAR |
| Visus | `delta` | `[-1, 1]` logMAR |
| CRT | `absolute` | `[0, 800]` µm |
| CRT | `delta` | dynamic (data-driven) |

### HMAC-SHA256 Cohort ID Hashing (CRREV-01)

Cohort identifiers are never written as raw strings in audit records. `server/hashCohortId.ts` provides the `hashCohortId(id)` function, which produces a 16-hex-character (64-bit) truncated HMAC-SHA256 digest. The HMAC secret is sourced from `settings.yaml` under `audit.cohortHashSecret` (minimum 32 characters; server refuses to start if absent or too short).

Properties:
- **Deterministic:** same `(secret, id)` pair always produces the same hash across restarts, enabling correlation without exposing the raw ID.
- **Reused across phases:** the utility was introduced in Phase 11 (audit beacon) and reused without modification in Phase 12 (`outcomes.aggregate` audit rows).
- **Audit beacon (CRREV-01):** the client-side audit beacon (`OutcomesView`, Phase 11) fires a `POST` with `keepalive: true` on mount. The POST body contains `cohortHash` (computed server-side by the handler), not the raw cohort ID.
