# Benutzerhandbuch — EyeMatics Klinischer Demonstrator (EMD)

**Version 1.0 — Stand: 09.04.2026**

---

## 1. Einführung

Der EyeMatics Klinische Demonstrator (EMD) ist ein webbasiertes Dashboard zur Analyse ophthalmologischer Forschungsdaten aus IVOM-Behandlungen. Er ermöglicht Forschenden die Bildung von Kohorten, die Durchführung von Analysen und die Überprüfung der Datenqualität.

> **Wichtig:** Der Demonstrator ist ausschließlich für Forschungszwecke konzipiert und nicht für den Einsatz in der direkten Patientenversorgung vorgesehen.

### 1.1 Systemvoraussetzungen

- Aktueller Webbrowser (Chrome, Firefox, Edge oder Safari)
- Netzwerkzugang zum EMD-Server
- Gültige Zugangsdaten (Benutzername, Passwort, ggf. OTP-Code)

---

## 2. Anmeldung und Abmeldung

### 2.1 Anmeldung

1. Öffnen Sie die EMD-URL in Ihrem Browser.
2. Geben Sie Ihren **Benutzernamen** und Ihr **Passwort** ein.
3. Klicken Sie auf **Weiter**.
4. Falls die Zwei-Faktor-Authentisierung aktiviert ist: Geben Sie den **OTP-Code** ein und klicken Sie auf **Anmelden**.
5. Sie gelangen zur Startseite (Landing Page).

**Fehlgeschlagene Anmeldung:**
- Bei falschem Passwort oder unbekanntem Benutzernamen wird eine Fehlermeldung angezeigt.
- Bei falschem OTP-Code werden Sie zum Passwort-Schritt zurückgeleitet.
- Nach 5 aufeinanderfolgenden Fehlversuchen wird die Anmeldung vorübergehend gesperrt.

### 2.2 Abmeldung

- Klicken Sie in der Seitenleiste auf **Abmelden**.
- Nach 10 Minuten Inaktivität erfolgt eine automatische Abmeldung mit Vorwarnung (1 Minute vor Ablauf).

---

## 3. Startseite (Landing Page)

Nach der Anmeldung sehen Sie die Startseite mit einer Übersicht der Datengrundlage:

- **Begrüßung** mit Ihrem Anzeigenamen (Vorname Nachname)
- **Zentrenübersicht**: Karten für jedes angeschlossene Zentrum mit:
  - Name und Standort
  - Anzahl der verfügbaren Fälle
  - Letzte Aktualisierung

---

## 4. Kohortenbildung (Cohort Builder)

Navigieren Sie über die Seitenleiste zu **Kohortenbildung**.

### 4.1 Filter definieren

Sie können Patienten nach folgenden Kriterien filtern:

| Filter | Beschreibung |
|--------|--------------|
| **Diagnose** | AMD, Diabetische Retinopathie (Checkboxen) |
| **Geschlecht** | Männlich, Weiblich (Checkboxen) |
| **Zentrum** | UKA, UKB, LMU, UKT, UKM (Checkboxen) |
| **Alter** | Min–Max Bereich (Jahre) |
| **Visus** | Min–Max Bereich (0.0–1.0) |
| **CRT** | Min–Max Bereich (µm) |

Alle Filter können beliebig kombiniert werden. Ohne Filter werden alle Fälle angezeigt.

### 4.2 Ergebnisliste

Die gefilterte Fallliste zeigt:
- Pseudonym des Patienten
- Alter, Geschlecht, Zentrum
- Diagnose
- Anzahl der Kontakte

Klicken Sie auf einen Fall, um zur **Einzelfallansicht** zu gelangen.

### 4.3 Suche speichern und laden

- **Speichern**: Geben Sie einen Namen ein und klicken Sie auf **Suche speichern**. Es wird die Suchdefinition (Filterkriterien) gespeichert, nicht die Ergebnisdaten.
- **Laden**: Wählen Sie eine gespeicherte Suche aus der Liste. Die Filter werden angewendet und die Suche auf dem aktuellen Datenbestand neu ausgeführt.
- **Sortieren**: Gespeicherte Suchen können nach Name oder Datum sortiert werden.

### 4.4 Kohorte analysieren

Klicken Sie auf **Analysieren**, um die gefilterte Kohorte in der Analyse-Ansicht zu öffnen.

---

## 5. Kohortenanalyse

Navigieren Sie über die Seitenleiste zu **Analyse** oder über den Button in der Kohortenbildung.

### 5.1 Verfügbare Diagramme

| Diagramm | Beschreibung |
|----------|--------------|
| **Zentrumsverteilung** | Balkendiagramm: Anzahl Fälle pro Zentrum |
| **Diagnoseverteilung** | Kuchendiagramm mit Diagnoseanteilen. Fahren Sie mit der Maus über die Kuchenstücke, um die vollständige Diagnosebezeichnung (inkl. SNOMED-Code) zu sehen. |
| **Visus-Trend** | Liniendiagramm: Mittlerer Visus im Zeitverlauf (Quartale) |
| **CRT-Verteilung** | Histogramm: Verteilung der CRT-Werte in Bereiche |
| **Alter vs. Visus** | Streudiagramm: Zusammenhang zwischen Patientenalter und letztem Visuswert |

### 5.2 Kritische Werte

Unterhalb des Titels wird die Anzahl der Fälle mit kritischen Werten (CRT > 400 µm) angezeigt.

---

## 6. Einzelfallansicht (Case Detail)

Klicken Sie in der Kohortenbildung oder Datenqualität auf einen Fall, um die detaillierte Ansicht zu öffnen.

### 6.1 Patientenkopf

- Pseudonym, Alter, Geschlecht, Zentrum
- Augenlateralität (OD = rechtes Auge, OS = linkes Auge)
- Diagnosen mit ICD-10 Codes (Tooltip mit ausgeschriebener Diagnose)
- Behandlungsindikation
- Badge: Anzahl der unerwünschten Ereignisse
- Badge: **Kritische Überschreitungen** mit exakter Zählung (z.B. „3× CRT > 400 µm, 1× Visus < 0.1, 2× IOD > 21 mmHg")

### 6.2 Behandlungs-Timeline

Horizontale Zeitleiste aller Kontakte mit Icons:
- 👁 Visus-Messung
- 📊 CRT-Messung
- 💉 Injektion
- 📷 OCT-Aufnahme

Klicken Sie auf ein Icon, um das Datum im Verlaufsdiagramm hervorzuheben.

### 6.3 Visus/CRT-Verlaufsdiagramm

- **Dual-Axis-Diagramm**: Visus (linke Y-Achse, grün) und CRT (rechte Y-Achse, violett) im Zeitverlauf
- **Kohortenmittelwerte** als gestrichelte Referenzlinien (Ø Visus, Ø CRT)
- **Kritische Schwelle**: CRT > 400 µm als rote Linie
- **Interpolationskennzeichnung**: Gefüllte Kreise (●) = tatsächliche Messwerte, leere Kreise (○) = interpolierte Punkte (kein Messwert an diesem Datum)

### 6.4 Veränderung zum Ausgangswert

Liniendiagramm zeigt die prozentuale Veränderung von Visus und CRT gegenüber dem ersten Messwert (Baseline).

### 6.5 Werteverteilung (Histogramme)

- **Visus-Verteilung**: Histogramm mit 5 Bereichen (0–0.2 bis 0.8–1.0)
- **CRT-Verteilung**: Histogramm mit 6 Bereichen (<200 bis >400), kritischer Bereich (>400) rot eingefärbt

### 6.6 Parameterkorrelation (Scatter Plot)

Streudiagramm **Visus vs. CRT**: Zeigt den Zusammenhang zwischen Visus und CRT für alle Messzeitpunkte des Patienten. Tooltip zeigt Datum, Visus und CRT.

### 6.7 Weitere klinische Parameter

| Abschnitt | Inhalt |
|-----------|--------|
| **Augeninnendruck (IOP)** | Balkendiagramm mit Messmethode, kritische Schwelle 21 mmHg |
| **Refraktion** | Sphäre, Zylinder, Achse pro Untersuchungsdatum |
| **HbA1c** | Diabetesspezifische Werte, farbkodiert (>7.0% = rot) |
| **Anamnese** | Ophthalmologische und nicht-ophthalmologische Vorgeschichte |
| **Befunde** | Vorderer und hinterer Augenabschnitt |
| **Unerwünschte Ereignisse** | Adverse Events mit Datum und Status (aktiv/aufgelöst) |
| **Medikation** | Medikationshistorie mit Handelsname, Zeitraum, Status; Präparat-Wechsel markiert |

### 6.8 OCT-Bildbetrachter

- Retina-Bildansicht mit Zoom-Funktion
- Vergleichsmodus: Zwei Aufnahmen nebeneinander vergleichen
- Auswahl über Timeline oder Dropdown

---

## 7. Datenqualität (Quality Review)

Navigieren Sie über die Seitenleiste zu **Datenqualität**.

### 7.1 Übersicht

Die Datenqualitätsansicht zeigt eine Liste aller Fälle mit:

- **Anomalien**: Automatisch erkannte auffällige Werte (z.B. Visus > 1.0, CRT < 100 µm, IOP > 30 mmHg)
- **Prüfstatus**: Ungeprüft / Geprüft / Markiert
- **Therapieunterbrechung**: Kennzeichnung als Unterbrecher (gelb) oder Abbrecher (rot)

### 7.2 Fehler kennzeichnen (Flaggen)

1. Klicken Sie auf das Flag-Symbol neben einem Parameter.
2. Wählen Sie die **Fehlerart** aus dem Dropdown.
3. Geben Sie optional einen Kommentar ein.
4. Klicken Sie auf **Speichern**.

### 7.3 Fall als geprüft markieren

Klicken Sie auf den **Reviewed**-Button, um einen Fall als geprüft zu kennzeichnen.

### 7.4 Fall ausschließen

Klicken Sie auf **Ausschließen**, um einen Fall von weiteren Analysen auszuschließen. Ausgeschlossene Fälle werden in der Kohortenbildung nicht berücksichtigt.

### 7.5 CSV-Export

Klicken Sie auf **CSV exportieren**, um die Qualitätsbewertung als CSV-Datei herunterzuladen. Die Datei enthält alle Fälle mit ihren Anomalien, Flags und Status.

### 7.6 Filteroptionen

Filtern Sie die Ansicht nach:
- Anomalieart (fehlende Werte, unwahrscheinliche Werte)
- Prüfstatus (ungeprüft, geprüft, markiert)
- Therapieabbruch/-unterbrechung

---

## 8. Dokumentationsqualität

Navigieren Sie über die Seitenleiste zu **Dokumentationsqualität**.

### 8.1 Zentrumsvergleich

- Vergleichsbalkendiagramm aller Zentren
- Qualitätskennzahlen: Vollzähligkeit, Vollständigkeit, Plausibilität, Gesamt

### 8.2 Zeitraumfilter

Wählen Sie den Auswertungszeitraum:
- 6 Monate
- 1 Jahr
- Gesamt

### 8.3 Zentrumsdetails

Klicken Sie auf ein Zentrum, um detaillierte Kennzahlen einzusehen.

---

## 9. Einstellungen

Navigieren Sie über die Seitenleiste zu **Einstellungen**. Alle Einstellungen werden serverseitig in `settings.yaml` gespeichert.

### 9.1 Zwei-Faktor-Authentisierung

- **Ein/Aus-Schalter**: Aktiviert/deaktiviert den OTP-Schritt beim Login
- Änderungen werden im Audit-Log protokolliert
- ⚠️ Warnung bei Deaktivierung

### 9.2 Therapieschwellenwerte

| Parameter | Default | Beschreibung |
|-----------|---------|--------------|
| Therapie-Unterbrecher (t) | 120 Tage | Zeitraum ohne Injektion → Unterbrecher |
| Therapie-Abbrecher (t') | 365 Tage | Zeitraum ohne Injektion → Abbrecher |

### 9.3 Datenquelle

- **Lokale Dateien**: JSON-Dateien aus `public/data/` (Standard)
- **FHIR Server**: Blaze FHIR Server via REST API
  - Server-URL eingeben (z.B. `http://localhost:8080/fhir`)
  - Verbindung testen mit dem **Test**-Button

### 9.4 Export/Import

- **Einstellungen exportieren**: Aktuelle Konfiguration als YAML-Datei herunterladen
- **Zurücksetzen**: Alle Einstellungen auf Standardwerte zurücksetzen

### 9.5 Issue-Export

- Anzahl der gemeldeten Probleme wird angezeigt
- **Issues exportieren**: Alle gemeldeten Probleme als JSON-Bundle herunterladen

---

## 10. Problem melden (Issue Reporting)

Auf jeder Seite befindet sich am rechten Bildschirmrand ein orangefarbener Button **„Problem melden"**.

### 10.1 Problem melden

1. Klicken Sie auf den Button **Problem melden**.
2. Ein Screenshot der aktuellen Seite wird automatisch erfasst.
3. Beschreiben Sie das Problem im Textfeld.
4. Klicken Sie auf **Absenden**.

Das Problem wird mit Screenshot, Seitenname, Benutzername und Zeitstempel serverseitig gespeichert. Alle gemeldeten Probleme können über die Einstellungsseite exportiert werden.

---

## 11. Audit-Log

Navigieren Sie über die Seitenleiste zu **Audit-Log** (nur für Administratoren sichtbar).

### 11.1 Protokollierte Aktionen

Das Audit-Log protokolliert alle Benutzeraktionen:
- Seitenaufrufe (Landing Page, Analyse, Datenqualität, etc.)
- Einzelfallansichten (mit Pseudonym)
- Einstellungsänderungen (2FA, Datenquelle)
- An-/Abmeldungen

### 11.2 Filterung

Filtern Sie die Einträge nach:
- Zeitraum
- Benutzer
- Aktionstyp

### 11.3 CSV-Export

Klicken Sie auf **CSV exportieren**, um das Audit-Log als CSV-Datei herunterzuladen.

---

## 12. Benutzerverwaltung (Administration)

Navigieren Sie über die Seitenleiste zu **Administration** (nur für Administratoren).

### 12.1 Neuen Benutzer anlegen

1. Klicken Sie auf **Nutzer hinzufügen**.
2. Füllen Sie die Felder aus:
   - Benutzername (eindeutig)
   - Vorname, Nachname
   - Passwort
   - Rolle (IT-Administrator, Forscher/in, Epidemiolog/in, Kliniker/in, DIZ Data Manager, Klinikleitung)
   - Zugeordnete Zentren (Mehrfachauswahl)
3. Klicken Sie auf **Speichern**.

### 12.2 Benutzer löschen

Klicken Sie auf das Löschen-Symbol neben dem Benutzereintrag.

---

## 13. Sprachumschaltung

Der EMD unterstützt Deutsch und Englisch. Die Sprache kann über das Sprachmenü in der Seitenleiste umgeschaltet werden.

---

## 14. Tastenkombinationen und Tipps

| Aktion | Tipp |
|--------|------|
| Diagnose-Details | Fahren Sie mit der Maus über ICD-10 Codes oder Kuchenstücke im Diagnosediagramm |
| OCT-Navigation | Klicken Sie auf das Kamera-Icon in der Timeline, um zur OCT-Aufnahme zu springen |
| Datum hervorheben | Klicken Sie auf ein Visus-/CRT-Icon in der Timeline, um das Datum im Diagramm zu markieren |
| Daten filtern | Nutzen Sie mehrere Filter gleichzeitig für präzisere Kohorten |

---

## 15. Fehlerbehebung

| Problem | Lösung |
|---------|--------|
| Login schlägt fehl | Prüfen Sie Benutzername und Passwort. OTP-Code ist `123456` (Demomodus). |
| Keine Daten sichtbar | Prüfen Sie die Datenquelle in den Einstellungen. Bei Blaze: Ist der Server erreichbar? |
| CSV-Export funktioniert nicht | Warten Sie kurz nach dem Klick — der Download startet automatisch. |
| Screenshot fehlt im Issue | Der Screenshot wird vor dem Öffnen des Dialogs erfasst. Popups oder Overlays können die Erfassung stören. |
| Einstellungen gehen verloren | Einstellungen werden in `settings.yaml` auf dem Server gespeichert. Prüfen Sie die Schreibrechte. |

---

## 16. Glossar

| Begriff | Beschreibung |
|---------|--------------|
| **IVOM** | Intravitreale operative Medikamentenapplikation |
| **AMD** | Altersbedingte Makuladegeneration |
| **DR** | Diabetische Retinopathie |
| **CRT** | Zentrale Netzhautdicke (Central Retinal Thickness) in µm |
| **Visus** | Sehschärfe (0.0–1.0) |
| **IOP / IOD** | Intraokularer Druck (Augeninnendruck) in mmHg |
| **HbA1c** | Glykiertes Hämoglobin (Langzeitblutzucker) in % |
| **OD** | Oculus dexter (rechtes Auge) |
| **OS** | Oculus sinister (linkes Auge) |
| **OCT** | Optische Kohärenztomographie |
| **OTP** | One-Time Password (Einmalpasswort für 2FA) |
| **FHIR** | Fast Healthcare Interoperability Resources (HL7-Standard) |
| **SNOMED** | Systematized Nomenclature of Medicine |
| **Kohorte** | Gruppe von Patienten, die bestimmte Filterkriterien erfüllen |
| **Baseline** | Ausgangswert (erster Messwert eines Patienten) |
| **Therapie-Unterbrecher** | Patient ohne Injektion seit > t Tagen (Standard: 120 Tage) |
| **Therapie-Abbrecher** | Patient ohne Injektion seit > t' Tagen (Standard: 365 Tage) |
| **Flag** | Markierung eines auffälligen oder fehlerhaften Datenpunkts |
| **SDV** | Source Data Verification (Quelldatenverifikation) |

---

*Dieses Benutzerhandbuch bezieht sich auf den EyeMatics Klinischen Demonstrator v1.0.0. Für technische Informationen siehe README.md und Konfiguration.md.*
