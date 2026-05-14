# EMD Feedback Tracking — Formative Analyse (11.05.2026)

> **Dokument-Status:** Erster Entwurf (2026-05-14)  
> **Quelle:** `formative_analyse_110526.docx` + In-App Feedback `emd-issues-2026-05-14.json`  
> **Legende:** ✅ ACCEPT (wird umgesetzt) · ❌ REJECT (wird nicht umgesetzt, Begründung) · 💬 COMMENT (Anmerkung / zurückgestellt)

---

## Teil A — In-App Feedback (9 Tickets, v1.4.0, 11.05.2026)

| # | Seite | Beschreibung | Status | Maßnahme |
|---|-------|-------------|--------|---------|
| A-01 | Startseite | Kohortenbildung-Button ohne Funktion | ✅ | `onClick(() => navigate('/cohort'))` ergänzt |
| A-01 | Startseite | Zentren wirken klickbar, ohne Funktion | ✅ | `onClick(() => navigate('/doc-quality'))` + keyboard-handler ergänzt |
| A-02 | Startseite | Export-Button ohne Funktion | ✅ | Button auf `disabled` gesetzt + `title="Funktion noch nicht verfügbar"` — Export ist noch nicht implementiert und sollte keine stillen No-Ops auslösen |
| A-03 | Kohortenbildung | Negative Werte und String bei Alter/Visus/CRT möglich | ✅ | `min={0}` auf alle numerischen Eingaben; `Math.max(0, ...)` in onChange; Visus-Guard `v >= 0` ergänzt |
| A-04 | Analyse | Zeigt nicht an, welche Kohorte angezeigt wird | ✅ | `?cohort=<id>`-Parameter wird ausgewertet, gespeicherte Suche aufgelöst, Name unter Seitentitel angezeigt; Filter werden korrekt übernommen |
| A-05 | Analyse | Fall nicht auswählbar | 💬 | Betrifft den Aggregiert-Tab: dieser zeigt Verteilungscharts, keine Fall-Liste. Direkte Fall-Navigation ist im Trajektorien-Tab über Tooltip-Hover vorgesehen. Detailnavigation aus dem Analyse-Kontext heraus ist Phase-29-Scope. |
| A-06 | Fallansicht (pat-uka-003) | Einzelne Achsen-Ticks fehlen | 💬 | Recharts wählt Ticks automatisch bei dichten Zeitreihen. Für pat-uka-003 evtl. zu viele Datenpunkte → `interval="preserveStartEnd"` oder Tick-Formatierung prüfen. Screenshot für genaue Repro benötigt. |
| A-07 | Fallansicht (pat-uka-003) | CRT-Label-Fehler bei absoluter Kurve | ✅ | Rechte Y-Achsen-Beschriftung hatte `angle: 90` (falsche Drehrichtung) → auf `angle: -90` korrigiert |
| A-08 | Fallansicht (pat-uka-003) | Interpolierte Linie nicht gestrichelt, sondern Mean-Linie | ✅ | Hinweistext korrigiert: "Gestrichelte Linie = interpoliert" → **"Offener Kreis = interpoliert (kein Messwert)"** — die Linie selbst ist durchgehend, interpolierte Punkte werden als offene Kreise dargestellt |
| A-09 | Dokumentationsqualität | Wird die Grundgesamtheit auf die letzten 6 Monate angepasst? | 💬 | Ja — `filterCasesByTimeRange` filtert auch die Grundgesamtheit pro Zentrum. Muss in der UI explizit kenntlich gemacht werden (z. B. Zeitraum-Badge bei Gesamtzahl). Backlog. |

---

## Teil B — Formative Analyse (Anforderungs-basierte Findings)

### USM — Nutzerverwaltung

| ID | Finding | Status | Empfehlung |
|----|---------|--------|------------|
| USM-006 | Meldung „zu viele Fehlversuche, bitte warten" unklar | 💬 | Text ist technisch korrekt (Rate-Limiting implementiert). Meldung könnte präziser sein: „Zu viele Fehlversuche. Bitte X Minuten warten." Das verbleibende Timeout in die Meldung aufzunehmen erfordert Server-Feedback (fehlt aktuell). Backlog-Kandidat. |
| USM-008 | Kein kontinuierlicher Counter sichtbar | 💬 | Bewusste Designentscheidung: kein Counter, um Brute-Force-Angreifern keine Rückmeldung zu geben. Für interne Testszenarien wäre ein Hinweis hilfreich. Akzeptiert als-ist. |
| USM-001 | Kopier-Button unresponsive (Passwort-Generierung) | ✅ | **Zu prüfen und zu fixen.** Wahrscheinlich fehlender `onClick`-Handler auf dem Kopieren-Button in `AdminPage.tsx`. Aufnehmen als separates Ticket. |
| USM-001 | Nutzer ohne Standortzuweisung möglich | ✅ | **Accept.** Validierung beim Anlegen/Bearbeiten: mindestens ein Zentrum muss ausgewählt sein. Fehlermeldung ergänzen. |
| USM-001 | Fehlende Fehlermeldung bei Pflichtfeldern | ✅ | **Accept.** Pflichtfeld-Validierung und Inline-Fehlermeldungen im User-Formular nachrüsten. |
| USM-002 | Deaktivieren geht nicht, nur Löschen | ❌ | **Reject (by design).** Kontoabschalten vs. Löschen ist in den aktuellen Anforderungen nicht spezifiziert. Gelöschte Konten werden im Protokoll korrekt anonymisiert (PROT-001 beachten). Rückmeldung: Anforderung ggf. für nächste Milestone formulieren. |
| USM-002 | Bearbeiten gibt keine Fehlermeldung und behält alten Wert | ✅ | **Accept.** Fehlerfall bei `modifyUsers` sollte dem User als Toast/Inline-Error angezeigt werden. |
| USM-008 | Wo konfigurierbar? | 💬 | Aktuell in `config/settings.yaml → auth.maxLoginAttempts`. Phase 28 sieht eine Admin-UI für Session-Einstellungen vor. `maxLoginAttempts` dort mit ergänzen. |

---

### DAT — Dashboard / Datensatz

| ID | Finding | Status | Empfehlung |
|----|---------|--------|------------|
| DAT-003 | Gesamtzahl wird nicht angezeigt (Patienten-Gesamtzahl im simulierten Datensatz) | ✅ | **Accept.** Gesamtfall-Zahl kann auf der Startseite in den KPI-Kacheln ergänzt werden (derzeit zeigt die „Fälle"-Kachel `cases.length` — evtl. bereits korrekt, ggf. Unterschied aktiv/gesamt prüfen). |
| —  | „Aufmerksamkeit Erforderlich" und „Weitermachen" nicht in Anforderungen | 💬 | **Bewusste UX-Erweiterung** über EMDREQ hinaus. Die Panels zeigen aus verfügbaren Daten abgeleitete Hinweise. Die Review-Buttons navigieren zu Kohortenbildung bzw. Dokumentationsqualität. Phase 29 verkabelt diese Panels vollständig. Kein Handlungsbedarf jetzt. |

---

### KOH — Kohortenbildung

| ID | Finding | Status | Empfehlung |
|----|---------|--------|------------|
| KOH-001 | Kerndatensatz (noch) nicht vollständig abgebildet | 💬 | Bekannte Limitation. Welche Felder konkret fehlen? Bitte spezifizieren → als Backlog-Items erfassen. |
| KOH-001/002 | Inhaltlicher Unterschied zwischen KOH-001 und KOH-002 unklar | 💬 | KOH-001 = Datenanzeige pro Patient (Kerndatensatz), KOH-002 = Filter-/Selektionsmechanismen. Anforderungsdokument präzisieren, kein Code-Handlungsbedarf. |
| KOH-002 | Filter konfigurierbar? | 💬 | Aktuell hardcoded (Alter, Visus, CRT, Zentrum, Diagnose, Geschlecht). Konfigurierbarkeit = Backlog; vorerst kein Aufwand. |
| KOH-002 | Negativer Wert bei Alter, Visus, CRT möglich | ✅ | **Behoben in A-03** (s. o.) |
| KOH-002 | Visus-Eingabe akzeptiert String | ✅ | **Behoben in A-03** — `v >= 0`-Guard verhindert ungültige Werte |
| KOH-002 | Cursor bleibt links bei Kohortenname | ✅ | **Accept.** CSS `text-align` oder `dir`-Attribut prüfen. Separates kleines Fix-Ticket. |
| KOH-003 | Subkohorten nur sehr implizit möglich | 💬 | **Design-Entscheidung:** EMD hat keine expliziten Subkohorten; Kohorten werden über gespeicherte Suchen abgebildet. Für Subkohorten wäre eine verschachtelte Filter-Hierarchie nötig — Backlog. |
| KOH-005 | „Analyse"-Tab zeigt nicht an, in welcher Kohorte ich arbeite | ✅ | **Behoben in A-04** — Kohortenname wird bei gespeicherten Suchen unter dem Seitentitel angezeigt |
| KOH-003 | Auswahl wird gelöscht, wenn auf „Analysieren" geklickt und dann zurück | 💬 | **Accept als Backlog.** Filter-State sollte beim Rücknavigieren erhalten bleiben (History-State oder Persistenz im Context). Nicht trivial — aufwandsmäßig einordnen. |
| KOH-006 | Kohorte eher umständlich anzuzeigen | 💬 | Gemeint ist wahrscheinlich, dass der Weg zur Kohortenübersicht nicht direkt ist. UX-Verbesserung, Backlog. |

---

### ANL — Analyse

| ID | Finding | Status | Empfehlung |
|----|---------|--------|------------|
| ANL-002 | Subkohorte gibt es nicht; man kann Kohorten vergleichen | 💬 | Korrekte Beobachtung — entspricht dem Design (CohortCompareDrawer). Keine Änderung nötig; Anforderungstext präzisieren. |
| ANL-002 | Behandlungsintervall nicht vergleichend dargestellt | ✅ | **Accept.** Der Intervall-Histogramm-View fehlt im Kohorten-Vergleichsmodus. Backlog-Ticket erstellen. |
| ANL-002 | Was ist „Responder"? | ✅ | **Accept.** Tooltip oder Info-Box beim Responder-Tab ergänzen (klinische Definition: Visus-Verbesserung ≥ 5 Buchstaben oder CRT-Reduktion ≥ 10%). |
| ANL-002 | Vergleich anderer Parameter (Aggregiert-Tab) relevant | 💬 | **Backlog.** Kohorten-Vergleich auf Aggregiert-Tab ausweiten ist Erweiterungsfeature. |
| ANL-003 | Vergleich gibt es nicht | 💬 | Kohorten-Vergleich ist im Trajektorien-Tab über CohortCompareDrawer möglich. Im Aggregiert-Tab fehlt er. Backlog. |
| ANL-003 | Alter vs. Visus: X-Achse nicht monoton steigend | ✅ | **Accept / Bug.** Scatter-Plot sortiert Punkte nach Reihenfolge im Array, nicht nach X-Wert. Daten vor Übergabe ans Chart sortieren. |
| ANL-002 | Visusverlaufskurve 2× unterschiedlich dargestellt | ✅ | **Accept / Bug.** Prüfen, ob im Trajektorien-Tab und im Aggregiert-Tab dieselben Berechnungsgrundlagen verwendet werden. Screenshot für Repro benötigt. |
| ANL-003/002 | Zwischen Aggregiert und Verläufe sind unterschiedliche Kohorten ausgewählt | ✅ | **Accept / Bug.** Behoben teilweise durch A-04 (gespeicherte Suche wird korrekt aufgelöst). Beim direkten Filter-Pfad (`?filters=`) wird die Kohorte jedoch im Trajektorien-Tab über `DataContext.filters` bezogen — diese Synchronisation prüfen. |
| ANL-004 | Woher kommen kritische Werte? Einstellbar? | 💬 | Definiert in `src/config/clinicalThresholds.ts` (CRT > 400 µm, Visus < 0,1). Aktuell nicht über UI konfigurierbar. Für Phase 28 vorgesehen (Admin-UI für Schwellenwerte). Doku ergänzen. |
| ANL-004 | In Datenqualitätsprüfung: Fall nicht markiert, nur Felder | 💬 | Bewusste Trennung: Datenqualitäts-Markierung (QualityFlag pro Parameter) vs. kritische Werte (klinische Schwellenwerte in der Analyse). Anforderungstext klären. |

---

### FALL — Fallansicht

| ID | Finding | Status | Empfehlung |
|----|---------|--------|------------|
| FALL-001 | Falldetailnavigation funktioniert prinzipiell, aber Weg noch umständlich | 💬 | Bekannte UX-Limitation. Direkte Navigation vom Analyse-Chart → Falldetail ist Phase-29-Scope. |
| FALL-006 | Vergleich Fall–Kohorte nicht möglich (K05) | 💬 | **Backlog.** Kohorten-Referenzwerte in der Fallansicht (bereits teilweise: Kohortenø-Linien im VisusCrt-Chart) zu erweitern. |
| FALL-003 | Achsbeschriftungen: einzelne fehlen / unregelmäßig | 💬 | Recharts reduziert Ticks automatisch bei beengten Layouts. `interval="preserveStartEnd"` oder explizite `ticks`-Prop für bekannte Zeitpunkte erwägen. Separates Fix-Ticket. |
| FALL-003 | Events in Behandlungsverlauf klickbar → nur absoluter Verlauf, nicht relativer | ✅ | **Accept.** Klick auf Event navigiert zum absoluten Chart (via `highlightDate`). Relativer Chart sollte ebenfalls auf das Datum fokussieren. Fix: `highlightDate` auch in der relativen Verlaufsansicht als ReferenceLine nutzen. |
| FALL-003 | Zwei Buttons für eine Funktion | ✅ | **Accept.** Doppelten Trigger identifizieren und zusammenführen. |
| FALL-003 | CRT-Bezeichnung in Legende | ✅ | **Behoben in A-07** — Y-Achsen-Label-Winkel korrigiert (von 90° auf −90°) |
| FALL-003 | Einheit Visus fehlt | ✅ | **Accept.** Visus-Einheit (logMAR oder dezimal) fehlt an der Y-Achse und/oder im Tooltip. In VisusCrtChart ergänzen. |
| FALL-003 | Legende sagt Interpolation sei gestrichelt — ist sie nicht | ✅ | **Behoben in A-08** — Hinweistext auf „Offener Kreis = interpoliert" korrigiert |
| FALL-005 | Qualität der Umsetzung diskutabel | 💬 | Ohne Screenshot / konkrete Beschreibung nicht beurteilbar. Um welche Ansicht handelt es sich genau? |
| FALL-004 | Wirkstoff pro Injektion darstellen (unterrepräsentiert) | ✅ | **Accept.** Wirkstoff (z. B. Aflibercept vs. Ranibizumab vs. Faricimab) pro Behandlung ist im Datensatz vorhanden. In der Injektionstabelle der Fallansicht als Badge ergänzen. |

---

### QUAL — Datenqualität

| ID | Finding | Status | Empfehlung |
|----|---------|--------|------------|
| QUAL-001 | Prüfung nicht auf Kohorten möglich (nur eigener Filter) | 💬 | **Backlog / Scope.** Kohorten-basierte Qualitätsprüfung ist sinnvoll, aber erheblicher Aufwand. Phase 28+. |
| QUAL-001 | Zu prüfende Parameter nicht konfigurierbar | ❌ | **Reject (Scope).** Konfigurierbare Prüfparameter sind nicht in EMDREQ spezifiziert. Anforderung für zukünftige Milestone aufnehmen. |
| QUAL-006 | Qualität der Umsetzung diskutabel | 💬 | Ohne Konkretisierung nicht beurteilbar. Was genau ist unbefriedigend? |
| QUAL-006 | Fehlerkennung: Anzeige nur weit unten, nicht am Datum | ✅ | **Accept.** Fehlerkennzeichnung soll näher am entsprechenden Datumseintrag platziert werden. UX-Fix im QualityCaseDetail. |
| QUAL-006 | Mehrere Fehlerkennzeichnungen pro Parameter — Bestätigung gilt für alle | ✅ | **Accept / Bug.** Beim Bestätigen einer Kennzeichnung sollte nur die bestätigte Kennzeichnung den Status ändern, nicht alle gleichartigen. |
| QUAL-004 | Fehlende Werte werden nicht vorgeschlagen | 💬 | **Backlog.** Auto-Suggest für fehlende Werte (Imputation) ist nicht in EMDREQ. Anforderung für künftige Milestone. |
| QUAL-009 | Kohorten nicht prüfbar | 💬 | Wie QUAL-001. |
| QUAL-011 | Grundgesamtheit wird nicht nach Zeitraum gefiltert | 💬 | **Technisch korrekt — visuell nicht klar kommuniziert.** `filterCasesByTimeRange` filtert die Basis. Ein Badge/Hinweis beim Gesamtzahl-Wert wäre hilfreich. Backlog. |
| QUAL-011 | Zentren-Filter hinter Zeitraum-Filter versteckt | ✅ | **Accept.** UI-Reihenfolge anpassen: Zentrum-Filter prominenter platzieren. |
| QUAL-011 | Zentrum-Filter öffnet nur Detailansicht; kein Multi-Select | ❌ | **Reject vorerst.** Multi-Select mehrerer Zentren gleichzeitig ist erheblicher Mehraufwand und nicht in EMDREQ spezifiziert. Anforderung für nächste Milestone. |
| QUAL-011 | Nicht für Kohorten möglich | 💬 | Wie QUAL-001. |
| QUAL-011 | Absolute Kennzahlen fehlen | ✅ | **Accept.** Neben Prozentsätzen sollten absolute Zählwerte (Anzahl Fälle mit Flag, Anzahl lückenlos dokumentierter Fälle) angezeigt werden. |
| QUAL-011 | Ergebnisse der Prüfung fehlen | ✅ | **Accept.** Nach einer Qualitätsprüfung sollte eine Zusammenfassung sichtbar sein (X Fälle geprüft, Y mit Auffälligkeiten). |
| QUAL-011 | Plausibilitätsbereiche nur über Zentrum-Details | ✅ | **Accept.** Plausibilitätsschwellen sollten auch im Haupt-DocQuality-Tab sichtbar sein, nicht nur im Drill-Down. |

---

### PROT — Protokoll / Audit Log

| ID | Finding | Status | Empfehlung |
|----|---------|--------|------------|
| PROT-001 | Gelöschter Account erscheint im Protokoll als „anonymous" | ✅ | **Accept / Security.** Das Pseudonymisieren von gelöschten Konten im Audit-Log ist datenschutzrechtlich kritisch — das Protokoll verliert seinen Rückverfolgbarkeits-Wert. **Empfehlung:** Statt „anonymous" einen gespeicherten Snapshot-Username verwenden (z. B. beim Löschen des Accounts den letzten Username als `deleted:<username>` im Audit-Log persistieren). Alternativ: Konten nur deaktivieren, nicht löschen (→ USM-002). Sicherheits-Ticket mit hoher Prio anlegen. |

---

## Zusammenfassung

| Status | Anzahl |
|--------|--------|
| ✅ ACCEPT (wird umgesetzt) | 26 |
| ❌ REJECT (nicht im Scope) | 3 |
| 💬 COMMENT (Anmerkung / Backlog) | 22 |

### Priorisierte Fixes (kurzfristig)

1. **PROT-001** — Audit-Log Pseudonymisierung (Sicherheit/DSGVO)
2. **USM-001** — Kopier-Button, Nutzer ohne Standort, fehlende Pflichtfeld-Validierung
3. **QUAL-006** — Flag-Bestätigung gilt fälschlicherweise für alle
4. **ANL-003** — Alter-vs-Visus X-Achse nicht sortiert
5. **FALL-003** — Einheit Visus fehlt, Events-Highlight im relativen Chart

### Backlog (mittelfristig)

- KOH-003: Filter-State beim Rücknavigieren erhalten
- ANL-002: Responder-Definition als Tooltip
- FALL-004: Wirkstoff pro Injektion als Badge
- QUAL-011: Absolute Kennzahlen + Prüfzusammenfassung + Schwellen-Sichtbarkeit
- USM-008: `maxLoginAttempts` in Phase-28-Admin-UI
