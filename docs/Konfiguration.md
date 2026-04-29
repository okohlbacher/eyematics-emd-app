# Konfiguration — settings.yaml

Der EyeMatics Klinische Demonstrator (EMD) wird über eine zentrale YAML-Konfigurationsdatei konfiguriert. Diese Datei liegt im Verzeichnis `config/settings.yaml` (außerhalb des Webroot) und wird beim Start der Anwendung geladen.

## Speicherort

```
emd-app/
  config/
    settings.yaml    ← Hauptkonfigurationsdatei (außerhalb von public/)
  data/
    centers.json     ← Zentrenkonfiguration
    users.json       ← Benutzerdaten (bcrypt-Hashes)
    audit.db         ← Audit-Log (SQLite, immutable)
    data.db          ← Persistenzdaten (Quality Flags, Searches, etc.)
    jwt-secret.txt   ← JWT-Signaturschlüssel (automatisch generiert)
```

Alle Änderungen, die über die Settings-Seite im UI vorgenommen werden, werden **serverseitig** in diese Datei zurückgeschrieben. Die Konfiguration ist damit persistent und unabhängig vom Browser-Cache oder localStorage.

## Konfigurationsparameter

> **Hinweis — Minimalkonfiguration vs. Vollbeispiel.** Die ausgelieferte `config/settings.yaml` enthält nur die Schlüssel, die vom UI gesetzt werden (z. B. `twoFactorEnabled`, `therapyInterrupterDays`, `therapyBreakerDays`, `dataSource`, `outcomes`, `auth`). Alle anderen unten aufgeführten Schlüssel (`server.*`, `audit.*`, `provider`, `maxLoginAttempts`, `otpCode`, `keycloak.*`, `terminology.*`) werden vom Server mit sicheren Defaults gefüllt, wenn sie in der Datei fehlen. Das folgende Beispiel zeigt **alle** verfügbaren Schlüssel — nicht alle müssen explizit gesetzt werden.

### Vollständiges Beispiel

```yaml
# ──────────────────────────────────────────────────────────────
# EyeMatics Clinical Demonstrator — Application Settings
# ──────────────────────────────────────────────────────────────

server:
  port: 3000                 # HTTP-Port des Servers
  host: '127.0.0.1'         # Bind-Adresse (127.0.0.1 = nur localhost; 0.0.0.0 = LAN)
  dataDir: './data'          # Verzeichnis fuer Datendateien
  serveFrontend: true        # Liefert das gebaute UI aus dist/ (Produktion: true)

audit:
  retentionDays: 90          # Aufbewahrungsdauer fuer Audit-Log in Tagen

provider: local              # 'local' oder 'keycloak'
twoFactorEnabled: false
maxLoginAttempts: 5
otpCode: '123456'            # Nur serverseitig gelesen — nicht im Client sichtbar
# keycloak:
#   issuer: https://auth.example.com/realms/emd
#   clientId: emd-app

therapyInterrupterDays: 120  # Therapie-Unterbrecher (t)
therapyBreakerDays: 365      # Therapie-Abbrecher (t')

dataSource:
  type: local                # 'local' oder 'blaze'
  blazeUrl: http://localhost:8080/fhir

terminology:
  enabled: false                                          # Standard OFF — bewahrt Offline-Verhalten
  serverUrl: 'https://r4.ontoserver.csiro.au/fhir'        # Platzhalter — pro Deployment ersetzen
  cacheTtlMs: 86400000                                    # 24 h
```

### Parameter im Detail

| Parameter | Typ | Default | Beschreibung |
|-----------|-----|---------|--------------|
| `server.port` | `number` | `3000` | HTTP-Port des Servers |
| `server.host` | `string` | `"127.0.0.1"` | Bind-Adresse. `"127.0.0.1"` = nur localhost (Standard, sicher). Für LAN-Zugriff in Produktion auf `"0.0.0.0"` setzen. |
| `server.dataDir` | `string` | `"./data"` | Verzeichnis fuer Datendateien (users.json, audit.db, etc.) |
| `server.serveFrontend` | `boolean` | `false` | Liefert das gebaute Frontend aus `dist/` aus. **Produktion: `true`** (Express bedient UI + API auf einem Port). **Entwicklung: `false`** (Vite-Dev-Server auf Port 5173 liefert die UI mit HMR; Express ist nur API). |
| `audit.retentionDays` | `number` | `90` | Aufbewahrungsdauer fuer Audit-Log-Eintraege in Tagen |
| `provider` | `"local"` \| `"keycloak"` | `"local"` | Authentifizierungsmethode. `local`: bcrypt + JWT (HS256). `keycloak`: RS256 via JWKS. |
| `twoFactorEnabled` | `boolean` | `false` | Aktiviert/deaktiviert den OTP-Schritt beim Login. Standardmäßig deaktiviert. |
| `maxLoginAttempts` | `number` | `5` | Max. Fehlversuche vor Kontosperrung (exponentielles Backoff). |
| `otpCode` | `string` | `"123456"` | Fester OTP-Code (Demonstrator). Nur serverseitig gelesen. |
| `therapyInterrupterDays` | `number` | `120` | Zeitkriterium t in Tagen für Therapie-Unterbrecher. |
| `therapyBreakerDays` | `number` | `365` | Zeitkriterium t' in Tagen für Therapie-Abbrecher. |
| `dataSource.type` | `"local"` \| `"blaze"` | `"local"` | Art der Datenquelle. `local`: JSON-Dateien aus `public/data/`. `blaze`: Blaze FHIR Server. |
| `dataSource.blazeUrl` | `string` | `http://localhost:8080/fhir` | URL des Blaze FHIR Servers. Zugriff über Server-Proxy (`/api/fhir-proxy`). |
| `terminology.enabled` | `boolean` | `false` | Aktiviert den Terminologie-Resolver-Server-Proxy. Standard `false` (Offline-Betrieb mit eingebauter Seed-Map). |
| `terminology.serverUrl` | `string` | `https://r4.ontoserver.csiro.au/fhir` | FHIR-Endpunkt mit `$lookup`-Unterstützung. Produktiv durch nationalen oder institutionellen Server ersetzen. |
| `terminology.cacheTtlMs` | `number` | `86400000` | Server-seitige LRU-Cache-Lebensdauer in Millisekunden (24 h). Max. 10 000 Einträge, prozesslokal. |

## Terminologie-Server (`terminology`)

Der Terminologie-Resolver löst Diagnose-Anzeigetexte (z. B. SNOMED-CT, ICD-10-GM) in einer dreistufigen Strategie auf: lokaler In-Memory-Cache (L1) → Server-Proxy `POST /api/terminology/lookup` (L2) → eingebaute Seed-Map (L3). Standardmäßig ist der Resolver **deaktiviert** (`terminology.enabled: false`); der Client fällt dann auf die Seed-Map zurück und erhält für unbekannte Codes den Roh-Code als Anzeigewert. Das bewahrt das vollständige Offline-Verhalten — bestehende Deployments verhalten sich nach dem Upgrade unverändert, bis sie sich aktiv für einen externen Server entscheiden.

> **Minimal vs. voll.** Wenn der `terminology:`-Block in `settings.yaml` fehlt, gelten die Code-Defaults (`enabled: false`, `cacheTtlMs: 86400000`, `serverUrl` leer): der Endpoint antwortet mit `503` und der Client nutzt nur Cache und Seed. Wer einen eigenen Terminologie-Server anbinden möchte, setzt `enabled: true` und einen passenden `serverUrl`.

### `terminology.enabled`

Standard `false`. Wenn `true`, leitet `POST /api/terminology/lookup` Anfragen an `terminology.serverUrl` weiter. Wenn `false` (oder wenn `serverUrl` nicht gesetzt ist), antwortet der Endpoint mit `503 Service Unavailable` (`{"error":"terminology lookup disabled"}`); der Client interpretiert `503` als Signal, auf die eingebaute Seed-Map zurückzufallen.

### `terminology.serverUrl`

FHIR-Endpunkt mit `$lookup`-Unterstützung (z. B. `…/CodeSystem/$lookup`). Standardplatzhalter ist `https://r4.ontoserver.csiro.au/fhir` — der öffentliche Ontoserver des CSIRO mit anonymem SNOMED-CT-Lookup. Produktive Deployments ersetzen diesen Wert durch einen nationalen oder institutionellen Terminologie-Server. Der Server-Proxy enthält eine SSRF-Sperre (Ablehnung privater/loopback/link-local IP-Adressen, D-10) und akzeptiert ausschließlich Antworten vom Origin der konfigurierten `serverUrl`.

### `terminology.cacheTtlMs`

Server-seitiger LRU-Cache (`Map`-basiert, einfügereihenfolge-evicting), maximal 10 000 Einträge, prozesslokal (kein Redis). Standard `86400000` (24 h). Der Cache wird beim Server-Neustart geleert; einzelne Lookups werden **nicht** im Audit-Log protokolliert (D-15: hohes Volumen, geringer Signalwert).

## Zentrenkonfiguration (data/centers.json)

Die Liste der verfügbaren Zentren ist in `data/centers.json` konfigurierbar:

```json
[
  { "id": "org-uka", "shorthand": "UKA", "name": "Universitätsklinikum Aachen",     "file": "center-aachen.json" },
  { "id": "org-ukc", "shorthand": "UKC", "name": "Universitätsklinikum Chemnitz",   "file": "center-chemnitz.json" },
  { "id": "org-ukg", "shorthand": "UKG", "name": "Universitätsklinikum Greifswald", "file": "center-greifswald.json" },
  { "id": "org-ukl", "shorthand": "UKL", "name": "Universitätsklinikum Leipzig",    "file": "center-leipzig.json" },
  { "id": "org-ukm", "shorthand": "UKM", "name": "Universitätsklinikum Münster",    "file": "center-muenster.json" },
  { "id": "org-ukt", "shorthand": "UKT", "name": "Universitätsklinikum Tübingen",   "file": "center-tuebingen.json" }
]
```

| Feld | Beschreibung |
|------|--------------|
| `id` | Interner Identifier (org-* Präfix, muss mit FHIR Organization.id übereinstimmen) |
| `shorthand` | Kurzbezeichnung für UI-Anzeige |
| `name` | Vollständiger Name des Zentrums |
| `file` | Dateiname der lokalen FHIR-Bundle-Datei (in public/data/) |

## Änderung der Konfiguration

### Über die UI (empfohlen)

1. Im EMD einloggen (als Administrator).
2. In der Sidebar auf **Einstellungen** klicken.
3. Gewünschte Werte anpassen.
4. **Speichern** klicken.

Die Änderungen werden sofort in `config/settings.yaml` zurückgeschrieben.

### Manuell (Datei bearbeiten)

```bash
nano config/settings.yaml
# Anwendung neu starten
npm start
```

> **Hinweis:** Bei manueller Bearbeitung muss die YAML-Syntax korrekt sein. Ungültige YAML-Dateien führen zu einem Startabbruch.

## Produktionsbetrieb

Im Produktionsbetrieb wird der Express-Server mit `npm start` gestartet:

```bash
npm run build    # Vite-Build erstellen
npm start        # Express-Server starten (Port 3000)
```

Der Server:
- Liest `config/settings.yaml` beim Start (fail-fast bei Fehler)
- Lädt Zentren aus `data/centers.json`
- Initialisiert JWT-Secret, Benutzer, Audit-DB, Daten-DB
- Dient statische Dateien aus `dist/`
- Blockiert direkten Zugriff auf `/data/*` (nur über `/api/fhir/bundles`)
- Alle API-Endpunkte unter `/api/*` sind JWT-geschützt

## Standardbenutzer

Beim ersten Start werden 7 Standardbenutzer angelegt (in `data/users.json`). Alle erhalten das Passwort `changeme2025!` (bcrypt-gehasht). Es wird empfohlen, Passwörter nach dem ersten Login zu ändern.

| Benutzername    | Rolle               | Zentren                                   |
|-----------------|---------------------|-------------------------------------------|
| `admin`         | IT-Administrator    | Alle (UKA, UKC, UKG, UKL, UKM, UKT)       |
| `forscher1`     | Forscher/in         | UKA                                       |
| `forscher2`     | Forscher/in         | UKC                                       |
| `epidemiologe`  | Epidemiolog/in      | UKA, UKC, UKG                             |
| `kliniker`      | Kliniker/in         | UKT                                       |
| `diz_manager`   | DIZ Data Manager    | UKM                                       |
| `klinikleitung` | Klinikleitung       | Alle                                      |

> **Hinweis:** Die Standardanmeldedaten sind öffentlich dokumentiert und identisch in jedem frischen Deployment. Ändern Sie alle sieben Passwörter vor dem produktiven Einsatz (Administration → Benutzer → Passwort setzen). Das Repository enthält **keine** `data/users.json`; diese Datei wird beim ersten Serverstart aus `server/index.ts` erzeugt und anschließend durch `initAuth._migrateUsersJson` mit bcrypt-Hashes für `changeme2025!` versehen.

## Zurücksetzen auf Werkseinstellungen

Ein sauberer Reset auf den Zustand eines frischen Deployments (alle Benutzerkonten, Audit-Log, Daten-DB und Secrets werden neu erzeugt):

```bash
# Server stoppen
kill $(lsof -ti:3000)

# Laufzeit-State entfernen (alle Dateien sind gitignored)
rm -f data/users.json \
      data/audit.db data/audit.db-shm data/audit.db-wal \
      data/data.db  data/data.db-shm  data/data.db-wal \
      data/jwt-secret.txt \
      data/cohort-hash-secret.txt

# Server neu starten — Seed + Migration + Secret-Erzeugung laufen automatisch
npm start
```

Nach dem Neustart:

- `data/users.json` enthält 7 Standardbenutzer mit bcrypt-Hashes für `changeme2025!`
- Neues JWT-Secret (0600, 32 Byte zufällig) in `data/jwt-secret.txt`
- Neues Cohort-Hash-Secret in `data/cohort-hash-secret.txt`
- Leere Audit- und Daten-SQLite-Datenbanken
- 2FA standardmäßig deaktiviert (siehe `config/settings.yaml: twoFactorEnabled: false`)

`data/centers.json` (im Repo eingecheckt) bleibt unberührt — der Site-Roster wird nicht zurückgesetzt.

## Architektur

```
Browser (UI)
    ↓ POST /api/auth/login (JSON Body)
Express Server (authApi)
    ↓ bcrypt-Prüfung → JWT Token (HS256, 10 Min.)
Browser → Bearer Token → /api/settings, /api/data/*, /api/fhir/bundles
    ↓ Alle API-Anfragen automatisch im Audit-Log protokolliert
Express Server
    ↓ fs.writeFileSync()
config/settings.yaml
```

> Siehe [architecture.svg](architecture.svg) und [architecture.md](architecture.md) für das vollständige Architekturdiagramm.
