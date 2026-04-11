# Architektur — EyeMatics Klinischer Demonstrator (EMD)

**Version 1.1 — Stand: 11.04.2026 (nach Security Review)**

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
2. **express.json()** — Body-Parsing fuer `/api/auth`, `/api/data`, `/api/issues` Routen
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
| Konfiguration | `config/settings.yaml` | Auth-Provider, 2FA, Schwellenwerte, Datenquelle (ausserhalb Webroot) |
| Zentren | `data/centers.json` | Konfigurierbare Zentrenliste (ID, Kuerzel, Name, FHIR-Datei) |
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
| `/api/auth/users/:name` | DELETE | Admin | Benutzer loeschen |
| `/api/auth/users/:name/password` | PUT | Admin | Passwort aendern |
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

*Dieses Dokument beschreibt die Architektur des EMD v1.1 (nach Security Review). Fuer das visuelle Diagramm siehe [architecture.svg](architecture.svg).*
