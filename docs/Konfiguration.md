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

# Zwei-Faktor-Authentisierung (OTP)
twoFactorEnabled: true

# Therapieabbruch-Schwellenwerte (Tage)
therapyInterrupterDays: 120   # Therapie-Unterbrecher (t)
therapyBreakerDays: 365       # Therapie-Abbrecher (t')

# Datenquelle: "local" (gebündelte JSON-Dateien) oder "blaze" (FHIR Server)
dataSource:
  type: local
  blazeUrl: http://localhost:8080/fhir
```

### Parameter im Detail

| Parameter | Typ | Default | Beschreibung |
|-----------|-----|---------|--------------|
| `twoFactorEnabled` | `boolean` | `true` | Aktiviert/deaktiviert den OTP-Schritt beim Login. Bei `false` entfällt die 2FA-Eingabe. Änderungen werden im Audit-Log protokolliert. |
| `therapyInterrupterDays` | `number` | `120` | Zeitkriterium t in Tagen für die Kennzeichnung als Therapie-Unterbrecher. Patienten ohne Injektion innerhalb von t Tagen werden als Unterbrecher markiert. |
| `therapyBreakerDays` | `number` | `365` | Zeitkriterium t' in Tagen für die Kennzeichnung als Therapie-Abbrecher. Patienten ohne Injektion innerhalb von t' Tagen werden als Abbrecher markiert. |
| `dataSource.type` | `"local"` \| `"blaze"` | `"local"` | Art der Datenquelle. `local`: JSON-Dateien aus `public/data/`. `blaze`: Blaze FHIR Server via REST API. |
| `dataSource.blazeUrl` | `string` | `http://localhost:8080/fhir` | URL des Blaze FHIR Servers. Nur relevant bei `dataSource.type: blaze`. Der Zugriff erfolgt über einen Vite-Server-Proxy, um CORS-Probleme zu vermeiden. |

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
npm run dev
```

> **Hinweis:** Bei manueller Bearbeitung muss die YAML-Syntax korrekt sein. Ungültige YAML-Dateien führen dazu, dass die Standardwerte verwendet werden.

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
Vite Dev Server (settingsApi Plugin)
    ↓ fs.writeFileSync()
public/settings.yaml
    ↑ GET /api/settings
Browser (UI)
```

Die Settings-API wird als Vite Server Plugin bereitgestellt (`server/settingsApi.ts`). In einer Produktionsumgebung muss ein entsprechender Endpunkt im Web-Server konfiguriert werden.

## Produktionsbetrieb

Im Produktionsbetrieb (statischer Build mit `npm run build`) steht die Settings-API nicht zur Verfügung. In diesem Fall:

1. Konfigurieren Sie `settings.yaml` vor dem Build.
2. Alternativ: Stellen Sie einen eigenen REST-Endpunkt bereit, der `GET /api/settings` und `PUT /api/settings` unterstützt.
3. Die Anwendung fällt automatisch auf das statische Lesen von `/settings.yaml` zurück, wenn die API nicht erreichbar ist (dann ohne Rückschreibung).
