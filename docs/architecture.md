# Architektur — EyeMatics Klinischer Demonstrator (EMD)

**Version 1.1 — Stand: 11.04.2026**

> Siehe auch: [architecture.svg](architecture.svg) fuer das visuelle Architekturdiagramm.

---

## Vier-Zonen-Modell

Jeder Standort betreibt den EMD-Stack eigenstaendig. Die Architektur folgt einem Vier-Zonen-Modell:

**Zone 1 — Klinische Quellzone:** Klinische Informationssysteme (KIS/KAS/EPA), ETL-Prozesse und Pseudonymisierung. Die Daten werden in den EyeMatics-Kerndatensatz transformiert (FHIR R4) und in ein lokales FHIR-Repository (Blaze) geschrieben.

**Zone 2 — DSF-Standortknoten:** Der DSF (Data Sharing Framework) orchestriert den standortuebergreifenden Datenaustausch ueber FHIR R4 und BPMN 2.0. Jeder Standort betreibt einen eigenen DSF FHIR Server und eine BPE (Business Process Engine). Die Kommunikation zwischen Standorten erfolgt verschluesselt ueber mTLS mit Standort-Zertifikaten.

**Zone 3 — EMD Backend:** Ein Express 5 Server, der ausschliesslich aus dem lokalen FHIR-Repository liest. Der Server stellt alle API-Endpunkte bereit, validiert JWT-Tokens, erzwingt zentrenbasierte Datenbeschraenkung und fuehrt ein manipulationssicheres Audit-Log in SQLite.

**Zone 4 — Browser:** Die React SPA kommuniziert ausschliesslich mit dem eigenen lokalen Backend. Alle Daten werden serverseitig gefiltert, bevor sie den Client erreichen.

## Architekturprinzip

EMD kommuniziert niemals direkt mit anderen Kliniken. Der Express-Server liest nur aus dem lokalen FHIR-Speicher (Blaze oder lokale JSON-Dateien). DSF befuellt den lokalen Speicher ueber standortuebergreifende Workflows. Diese Trennung stellt sicher, dass die Verantwortung fuer Transport-Sicherheit (DSF) und Nutzer-Authentifizierung (EMD) klar getrennt ist.

## Middleware-Kette

Alle API-Anfragen durchlaufen drei Middleware-Schichten in fester Reihenfolge:

1. **express.json()** — Body-Parsing fuer `/api/auth` und `/api/data` Routen
2. **auditMiddleware** — Automatische Protokollierung jeder API-Anfrage in SQLite (inkl. Schwaerzung sensibler Felder wie Passwoerter und OTP-Codes)
3. **authMiddleware** — JWT-Validierung (HS256 fuer lokale Auth, RS256 via JWKS fuer Keycloak). Oeffentliche Pfade (`/api/auth/login`, `/verify`, `/config`) sind ausgenommen.

## Authentifizierung

Der Login-Fluss ist zweistufig: `POST /api/auth/login` validiert Credentials serverseitig (bcrypt) und gibt bei aktivierter 2FA einen kurzlebigen Challenge-Token zurueck. `POST /api/auth/verify` prueft den OTP-Code und liefert den vollstaendigen Sitzungs-JWT. Der Client speichert den JWT in `sessionStorage` und sendet ihn als Bearer-Token mit jeder API-Anfrage.

JWT-Payload: `{ sub, preferred_username, role, centers, iat, exp }` — identisches Format fuer lokale und Keycloak-Authentifizierung.

## Zentrenbasierte Datenbeschraenkung

Jeder Benutzer ist einem oder mehreren Zentren zugeordnet (im JWT-Payload als `centers` Array). Der Server filtert FHIR-Bundles vor der Auslieferung: Lokale Bundles werden nach Organization-ID gefiltert, Blaze-Bundles nach `Patient.meta.source`. Die `/api/data/*` Endpunkte validieren bei Schreiboperationen, dass alle referenzierten Faelle zu den Zentren des Benutzers gehoeren.

## Datenhaltung

| Speicher | Pfad | Inhalt |
|----------|------|--------|
| Konfiguration | `config/settings.yaml` | Auth-Provider, 2FA, Schwellenwerte, Datenquelle (ausserhalb Webroot) |
| Zentren | `data/centers.json` | Konfigurierbare Zentrenliste (ID, Kuerzel, Name, FHIR-Datei) |
| Benutzer | `data/users.json` | Benutzername, bcrypt-Hash, Rolle, Zentren |
| JWT-Schluessel | `data/jwt-secret.txt` | HS256-Signaturschluessel (automatisch generiert) |
| Audit-Log | `data/audit.db` | SQLite, append-only, WAL-Modus, konfigurierbare Aufbewahrung |
| Persistenz | `data/data.db` | SQLite: Quality Flags, Saved Searches, Excluded/Reviewed Cases (per-user) |
| FHIR-Bundles | `public/data/center-*.json` | Lokale FHIR-Bundles (Zugriff in Production auf `/data/*` blockiert) |
| Feedback | `feedback/*.json` | Gemeldete Probleme mit Screenshots |

## Sicherheitsmodell

- **Kein Client-Vertrauen:** Server validiert JWT, filtert Daten, prueft Zentrenzugehoerigkeit
- **Audit-Immutabilitaet:** SQLite audit_log ohne DELETE/UPDATE-Endpunkte, kein UI-Clear
- **Credentials nie im Client:** Passwoerter nur serverseitig (bcrypt), OTP nur in `config/settings.yaml`
- **Statischer Zugriff blockiert:** `/data/*` gibt 403 in Production, `settings.yaml` nicht im Webroot

## API-Endpunkte

| Pfad | Methode | Auth | Beschreibung |
|------|---------|------|--------------|
| `/api/auth/login` | POST | — | Credentials validieren |
| `/api/auth/verify` | POST | — | OTP pruefen, JWT ausstellen |
| `/api/auth/config` | GET | — | 2FA-Status, Provider |
| `/api/auth/users` | GET/POST | Admin | Benutzerliste / Benutzer anlegen |
| `/api/auth/users/:name` | DELETE | Admin | Benutzer loeschen |
| `/api/auth/users/:name/password` | PUT | Admin | Passwort aendern |
| `/api/auth/users/me` | GET | JWT | Eigene Benutzerinfo |
| `/api/fhir/bundles` | GET | JWT | FHIR-Bundles (zentrenfiltriert) |
| `/api/fhir-proxy/*` | * | JWT | Proxy zum Blaze FHIR Server |
| `/api/data/quality-flags` | GET/PUT | JWT | Quality Flags (per-user) |
| `/api/data/saved-searches` | GET/POST/DEL | JWT | Gespeicherte Suchen |
| `/api/data/excluded-cases` | GET/PUT | JWT | Ausgeschlossene Faelle |
| `/api/data/reviewed-cases` | GET/PUT | JWT | Gepruefte Faelle |
| `/api/audit` | GET | JWT | Audit-Log (read-only) |
| `/api/audit/export` | GET | Admin | Vollstaendiger Audit-Export |
| `/api/issues` | GET/POST | JWT | Issue-Reporting |
| `/api/settings` | GET/PUT | JWT/Admin | Konfiguration |

---

*Dieses Dokument beschreibt die Architektur des EMD v1.1 (Frontend-Backend Integration). Fuer das visuelle Diagramm siehe [architecture.svg](architecture.svg).*
