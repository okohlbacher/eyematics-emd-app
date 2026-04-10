# Konfiguration — settings.yaml

Der EyeMatics Klinische Demonstrator (EMD) wird über eine zentrale YAML-Konfigurationsdatei konfiguriert. Diese Datei liegt im Verzeichnis `public/settings.yaml` und wird beim Start der Anwendung geladen.

## Speicherort

```
emd-app/
  public/
    settings.yaml    ← Hauptkonfigurationsdatei
```

Alle Änderungen, die über die Settings-Seite im UI vorgenommen werden, werden **serverseitig** in diese Datei zurückgeschrieben. Die Konfiguration ist damit persistent und unabhängig vom Browser-Cache oder localStorage.

## Konfigurationsparameter

### Vollständiges Beispiel

```yaml
# ──────────────────────────────────────────────────────────────
# EyeMatics Clinical Demonstrator — Application Settings
# ──────────────────────────────────────────────────────────────

# Therapieabbruch-Schwellenwerte (Tage)
therapyInterrupterDays: 120   # Therapie-Unterbrecher (t)
therapyBreakerDays: 365       # Therapie-Abbrecher (t')

# Datenquelle: "local" (gebündelte JSON-Dateien) oder "blaze" (FHIR Server)
dataSource:
  type: local
  blazeUrl: http://localhost:8080/fhir

# Express-Server-Konfiguration
server:
  port: 3000
  host: "0.0.0.0"
  dataDir: "./data"

# Authentisierung
auth:
  twoFactorEnabled: true
  maxLoginAttempts: 5
  otpCode: "123456"

# Audit-Log
audit:
  retentionDays: 90
```

### Parameter im Detail

| Parameter | Typ | Default | Beschreibung |
|-----------|-----|---------|--------------|
| `therapyInterrupterDays` | `number` | `120` | Zeitkriterium t in Tagen für die Kennzeichnung als Therapie-Unterbrecher. Patienten ohne Injektion innerhalb von t Tagen werden als Unterbrecher markiert. |
| `therapyBreakerDays` | `number` | `365` | Zeitkriterium t' in Tagen für die Kennzeichnung als Therapie-Abbrecher. Patienten ohne Injektion innerhalb von t' Tagen werden als Abbrecher markiert. |
| `dataSource.type` | `"local"` \| `"blaze"` | `"local"` | Art der Datenquelle. `local`: JSON-Dateien aus `public/data/`. `blaze`: Blaze FHIR Server via REST API. |
| `dataSource.blazeUrl` | `string` | `http://localhost:8080/fhir` | URL des Blaze FHIR Servers. Nur relevant bei `dataSource.type: blaze`. Der Zugriff erfolgt über einen Proxy (Vite im Dev-Modus, Express in Produktion), um CORS-Probleme zu vermeiden. |

### Server-Parameter (`server.*`)

| Parameter | Typ | Default | Beschreibung |
|-----------|-----|---------|--------------|
| `server.port` | `number` | `3000` | Server-Port |
| `server.host` | `string` | `"0.0.0.0"` | Server-Host (Bindungsadresse) |
| `server.dataDir` | `string` | `"./data"` | Verzeichnis für persistente Daten (`users.json`, `audit.db`, `jwt-secret.txt`) |

### Authentisierungs-Parameter (`auth.*`)

| Parameter | Typ | Default | Beschreibung |
|-----------|-----|---------|--------------|
| `auth.twoFactorEnabled` | `boolean` | `true` | Aktiviert OTP-Schritt beim Login. Bei `false` entfällt die 2FA-Eingabe. Änderungen werden im Audit-Log protokolliert. |
| `auth.maxLoginAttempts` | `number` | `5` | Maximale Fehlversuche vor Sperrung |
| `auth.otpCode` | `string` | `"123456"` | Fester OTP-Code für Demonstrator-Modus |

### Audit-Parameter (`audit.*`)

| Parameter | Typ | Default | Beschreibung |
|-----------|-----|---------|--------------|
| `audit.retentionDays` | `number` | `90` | Aufbewahrungsfrist für Audit-Einträge in Tagen. Ältere Einträge werden automatisch beim Serverstart und täglich gelöscht. |

### Wertebereichsprüfung

Die Settings-Seite validiert die Eingaben:
- `therapyInterrupterDays` muss kleiner als `therapyBreakerDays` sein.
- `therapyInterrupterDays` muss ≥ 1 sein.
- `therapyBreakerDays` muss ≥ 1 sein.
- `blazeUrl` muss eine gültige URL sein (wird bei Wechsel auf Blaze-Datenquelle geprüft).

## Änderung der Konfiguration

### Über die UI (empfohlen)

1. Im EMD einloggen (als beliebiger Nutzer).
2. In der Sidebar auf **Einstellungen** klicken.
3. Gewünschte Werte anpassen.
4. **Speichern** klicken.

Die Änderungen werden sofort in `settings.yaml` zurückgeschrieben und sind beim nächsten Laden der Seite wirksam.

### Manuell (Datei bearbeiten)

```bash
# Datei direkt bearbeiten
nano public/settings.yaml

# Anwendung neu starten, damit die Änderungen geladen werden
npm run dev       # Entwicklungsmodus
npm start         # Produktionsmodus
```

> **Hinweis:** Bei manueller Bearbeitung muss die YAML-Syntax korrekt sein. Ungültige YAML-Dateien führen dazu, dass die Standardwerte verwendet werden (Dev-Modus) bzw. der Server den Start verweigert (Produktionsmodus).

## Export und Import

### Export
Die aktuelle Konfiguration kann als YAML-Datei heruntergeladen werden:
- Settings-Seite → **Einstellungen exportieren (YAML)**

### Zurücksetzen
Über die Settings-Seite kann die Konfiguration auf die Standardwerte zurückgesetzt werden:
- Settings-Seite → **Zurücksetzen**

## Architektur

```
Browser (UI)
    ↓ PUT /api/settings (YAML Body)
Express Server (server/index.ts) bzw. Vite Dev Server (settingsApi Plugin)
    ↓ fs.writeFileSync()
public/settings.yaml
    ↑ GET /api/settings
Browser (UI)
```

Die Settings-API wird in beiden Betriebsmodi bereitgestellt:
- **Entwicklung:** Vite Server Plugin (`server/settingsApi.ts`)
- **Produktion:** Express Server (`server/index.ts`), gestartet via `npm start`

Alle API-Endpunkte (`/api/settings`, `/api/auth/*`, `/api/audit`, `/api/issues`) stehen sowohl im Entwicklungs- als auch im Produktionsbetrieb zur Verfügung.

## Produktionsbetrieb

Der Produktionsbetrieb wird über den integrierten Express-Server bereitgestellt:

```bash
# Build erstellen und Produktionsserver starten
npm run build && npm start
```

Der Express-Server (`server/index.ts`) stellt alle APIs bereit:
- `/api/settings` — Konfiguration lesen und schreiben
- `/api/auth/*` — Authentisierung (Login, OTP-Verifizierung)
- `/api/audit` — Audit-Log abfragen und exportieren
- `/api/issues` — Issue-Verwaltung
- `/fhir` — FHIR-Proxy zum Blaze Server

Persistente Daten werden im Verzeichnis `data/` gespeichert (konfigurierbar über `server.dataDir`):
- `users.json` — Benutzerdaten mit bcrypt-Passwort-Hashes
- `audit.db` — SQLite-Datenbank für Audit-Einträge
- `jwt-secret.txt` — Automatisch generierter JWT-Signaturschlüssel
