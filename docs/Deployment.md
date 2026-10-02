# Deployment — Container (Podman / Docker)

Ab v1.20 wird der EyeMatics Klinische Demonstrator (EMD) als fertiges Container-Image ausgeliefert:

| | |
|---|---|
| Image | `ghcr.io/okohlbacher/eyematics-emd-app` — `:latest` = aktuelles Release, zusätzlich versioniert (`:1.20`, …) |
| Architekturen | `linux/amd64`, `linux/arm64` |
| Gebaut von | GitHub Actions bei jedem `v*`-Tag (`.github/workflows/container.yml`, `Containerfile`) |
| Prozess | Node 24, läuft als **uid 1000** (`node`), Port **3000** im Container, UI + API aus einem Prozess |
| Zustand | ausschließlich im Volume **`/data`** (Konfiguration, Benutzer, Secrets, SQLite-Datenbanken, Feedback) |

Das Image ist öffentlich — kein `podman login` nötig.

## Voraussetzungen (Podman, rootless)

- Podman ≥ 4.6 (Quadlet mit `AutoUpdate=`; für `Notify=healthy` ≥ 5.0, ältere Versionen ignorieren den Schlüssel)
- Der User-Service soll auch ohne Login laufen: `loginctl enable-linger $USER`
- Automatische Updates: `systemctl --user enable --now podman-auto-update.timer`

## Installation (Quadlet)

```bash
mkdir -p ~/EMD ~/.config/containers/systemd
curl -fsSL https://raw.githubusercontent.com/okohlbacher/eyematics-emd-app/main/deploy/EMD.container \
     -o ~/.config/containers/systemd/EMD.container
systemctl --user daemon-reload
systemctl --user start EMD
systemctl --user status EMD          # "active (running)" sobald /healthz antwortet
```

Danach ist die Anwendung unter `http://<host>:3000` erreichbar. Die Unit-Datei ist in [`deploy/EMD.container`](../deploy/EMD.container) kommentiert; die wesentlichen Zeilen:

```ini
Volume=%h/EMD:/data:Z                  # gesamter Zustand in ~/EMD (:Z = SELinux-Label, sonst wirkungslos)
UserNS=keep-id:uid=1000,gid=1000       # eigener User ↔ uid 1000 im Container → ~/EMD bleibt lesbar/schreibbar
AutoUpdate=registry                    # podman-auto-update.timer zieht neue :latest-Images
HealthCmd=node /app/deploy/healthcheck.mjs
Notify=healthy                         # Unit gilt erst als gestartet, wenn /healthz antwortet → Rollback bei kaputtem Image
TimeoutStartSec=900                    # erster Start lädt das Image (~400 MB entpackt)
```

Es gibt **keine `EnvironmentFile=`-Zeile und keine Umgebungsvariablen** — die Anwendung wird ausschließlich über `~/EMD/settings.yaml` konfiguriert (siehe unten).

## Erster Start

Beim ersten Start mit leerem `~/EMD` legt der Container an:

| Datei | Inhalt |
|---|---|
| `settings.yaml` | Konfiguration, aus dem Image kopiert (nur wenn nicht vorhanden) |
| `users.json` | 7 Standardbenutzer (`admin`, `forscher1`, …), alle mit Passwort **`changeme2025!`** |
| `jwt-secret.txt`, `cohort-hash-secret.txt` | zufällige Secrets, Modus 0600 |
| `centers.json` | Zentrenliste (6 Standorte) |
| `audit.db`, `data.db`, `sessions.db` (+ `-wal`/`-shm`) | SQLite: Audit-Log, Persistenz, Sitzungen |
| `feedback/` | Feedback-Meldungen aus dem UI |

> **Wichtig:** Port 3000 ist im Netz erreichbar und die Standardpasswörter sind öffentlich dokumentiert.
> Alle sieben Passwörter direkt nach dem ersten Login ändern (Administration → Benutzer). Die Tabelle
> der Standardbenutzer steht in [Konfiguration.md](Konfiguration.md#standardbenutzer).

## Konfiguration

`~/EMD/settings.yaml` entspricht `config/settings.yaml` (alle Schlüssel: [Konfiguration.md](Konfiguration.md)). Änderungen über das UI (Administration → Einstellungen) werden in diese Datei zurückgeschrieben; manuelle Änderungen brauchen `systemctl --user restart EMD`. Container-spezifische Werte:

| Schlüssel | Wert | Anmerkung |
|---|---|---|
| `server.host` | `0.0.0.0` | Muss so bleiben, sonst ist der Port außerhalb des Containers nicht erreichbar |
| `server.port` | `3000` | Nicht ändern — der Healthcheck prüft 3000. Anderer Port außen: `PublishPort=8080:3000` |
| `server.dataDir` | `/data` | Das Volume |
| `auth.refreshCookieSecure` | `false` | Voreinstellung für **HTTP**. Hinter einem TLS-Reverse-Proxy auf `true` setzen (siehe TLS) |

Neue Schlüssel späterer Versionen sind im Server mit Defaults belegt; die Datei muss nicht nachgezogen werden. Zurück auf die Image-Defaults: Datei löschen und Container neu starten.

## Updates

`AutoUpdate=registry` + `podman-auto-update.timer` (täglich um Mitternacht): Podman vergleicht den Digest von `:latest` mit der Registry, zieht ein neues Image und startet die Unit neu. Wird der neue Container nicht „healthy", rollt Podman (≥ 5.0) auf das vorherige Image zurück.

```bash
podman auto-update --dry-run      # gibt es ein neues Image?
podman auto-update                # jetzt aktualisieren
podman image inspect ghcr.io/okohlbacher/eyematics-emd-app:latest \
  --format '{{index .Labels "org.opencontainers.image.version"}}'   # installierte Version
```

Eine feste Version statt `:latest`: `Image=ghcr.io/okohlbacher/eyematics-emd-app:1.20` (dann keine automatischen Updates).

## Backup und Zurücksetzen

- **Backup:** `systemctl --user stop EMD && cp -a ~/EMD ~/EMD.bak && systemctl --user start EMD` (für konsistente SQLite-Kopien den Container stoppen).
- **Werkseinstellungen:** `systemctl --user stop EMD && rm -rf ~/EMD/* && systemctl --user start EMD` — erzeugt Benutzer, Secrets und Datenbanken neu (Passwort wieder `changeme2025!`).

## TLS

Der Container spricht nur HTTP. Für den Betrieb außerhalb eines vertrauenswürdigen Netzes einen TLS-Reverse-Proxy davorschalten und anschließend `auth.refreshCookieSecure: true` setzen. Beispiel Caddy (`Caddyfile`):

```
emd.example.org {
    reverse_proxy 127.0.0.1:3000
}
```

Der Proxy muss dieselbe Origin für UI und API liefern (der Container tut das bereits — nichts weiter nötig).

## Docker statt Podman

```bash
mkdir -p ~/EMD
docker run -d --name EMD --restart unless-stopped -p 3000:3000 \
  -v ~/EMD:/data --user "$(id -u):$(id -g)" \
  ghcr.io/okohlbacher/eyematics-emd-app:latest
```

`--user` sorgt dafür, dass die Dateien in `~/EMD` dem aufrufenden Benutzer gehören. Docker wertet den im Image hinterlegten `HEALTHCHECK` aus (`docker ps` zeigt `healthy`).

## Fehlerbehebung

| Symptom | Ursache / Abhilfe |
|---|---|
| Logs ansehen | `journalctl --user -u EMD -f` oder `podman logs EMD` |
| `EMD: /data is not writable by uid 1000` | `UserNS=keep-id:uid=1000,gid=1000` fehlt in der Unit (oder Podman < 4.5) |
| `Permission denied` auf `/data` bei Fedora/RHEL | SELinux — `:Z` am Volume fehlt |
| Unit läuft nach Reboot/Logout nicht | `loginctl enable-linger $USER` |
| Login klappt, nach ~10 Minuten ausgeloggt | Seite läuft über HTTP, aber `auth.refreshCookieSecure: true` — auf `false` setzen oder TLS davor |
| Port 3000 belegt | `PublishPort=8080:3000` (Port im Container bleibt 3000) |
| Unit-Datei prüfen | `/usr/lib/systemd/system-generators/podman-system-generator --user --dryrun` |
| Keine automatischen Updates | `systemctl --user status podman-auto-update.timer` |
| Verläufe: „WebGL is not supported“ trotz WebGL-fähigem Browser | Image älter als 1.20.1 (Plotly-Build war mit der CSP inkompatibel) → `podman auto-update` |
| Leere Seite über `http://<host>:3000` (ohne TLS) | Image älter als 1.20.1 (CSP `upgrade-insecure-requests`) → `podman auto-update` |

## Lokal bauen und testen

```bash
docker build -f Containerfile -t emd .          # oder: podman build -t emd .
bash scripts/container-smoke.sh                 # Build + Start + Login + API + Neustart-Persistenz
IMAGE=ghcr.io/okohlbacher/eyematics-emd-app:latest bash scripts/container-smoke.sh   # veröffentlichtes Image prüfen
```

Der Smoke-Test läuft mit Docker (Standard) oder `CONTAINER_CLI=podman` und meldet jeden Schritt als PASS/FAIL.
