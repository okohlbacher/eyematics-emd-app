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

### Vollständiges Beispiel

```yaml
# ──────────────────────────────────────────────────────────────
# EyeMatics Clinical Demonstrator — Application Settings
# ──────────────────────────────────────────────────────────────

server:
  port: 3000                 # HTTP-Port des Servers
  host: '0.0.0.0'           # Bind-Adresse des Servers
  dataDir: './data'          # Verzeichnis fuer Datendateien

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
```

### Parameter im Detail

| Parameter | Typ | Default | Beschreibung |
|-----------|-----|---------|--------------|
| `server.port` | `number` | `3000` | HTTP-Port des Servers |
| `server.host` | `string` | `"0.0.0.0"` | Bind-Adresse des Servers |
| `server.dataDir` | `string` | `"./data"` | Verzeichnis fuer Datendateien (users.json, audit.db, etc.) |
| `audit.retentionDays` | `number` | `90` | Aufbewahrungsdauer fuer Audit-Log-Eintraege in Tagen |
| `provider` | `"local"` \| `"keycloak"` | `"local"` | Authentifizierungsmethode. `local`: bcrypt + JWT (HS256). `keycloak`: RS256 via JWKS. |
| `twoFactorEnabled` | `boolean` | `false` | Aktiviert/deaktiviert den OTP-Schritt beim Login. Standardmäßig deaktiviert. |
| `maxLoginAttempts` | `number` | `5` | Max. Fehlversuche vor Kontosperrung (exponentielles Backoff). |
| `otpCode` | `string` | `"123456"` | Fester OTP-Code (Demonstrator). Nur serverseitig gelesen. |
| `therapyInterrupterDays` | `number` | `120` | Zeitkriterium t in Tagen für Therapie-Unterbrecher. |
| `therapyBreakerDays` | `number` | `365` | Zeitkriterium t' in Tagen für Therapie-Abbrecher. |
| `dataSource.type` | `"local"` \| `"blaze"` | `"local"` | Art der Datenquelle. `local`: JSON-Dateien aus `public/data/`. `blaze`: Blaze FHIR Server. |
| `dataSource.blazeUrl` | `string` | `http://localhost:8080/fhir` | URL des Blaze FHIR Servers. Zugriff über Server-Proxy (`/api/fhir-proxy`). |

## Zentrenkonfiguration (data/centers.json)

Die Liste der verfügbaren Zentren ist in `data/centers.json` konfigurierbar:

```json
[
  { "id": "org-uka", "shorthand": "UKA", "name": "Universitätsklinikum Aachen", "file": "center-aachen.json" },
  { "id": "org-ukb", "shorthand": "UKB", "name": "Universitätsklinikum Bonn", "file": "center-bonn.json" }
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

| Benutzername | Rolle | Zentren |
|-------------|-------|---------|
| `admin` | IT-Administrator | Alle (UKA, UKB, LMU, UKT, UKM) |
| `forscher1` | Forscher/in | UKA |
| `forscher2` | Forscher/in | UKB |
| `epidemiologe` | Epidemiolog/in | UKA, UKB, LMU |
| `kliniker` | Kliniker/in | UKT |
| `diz_manager` | DIZ Data Manager | UKM |
| `klinikleitung` | Klinikleitung | Alle |

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
