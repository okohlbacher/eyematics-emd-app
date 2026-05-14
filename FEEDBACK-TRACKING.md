# EMD Feedback Tracking — Formative Analyse (11.05.2026)

> **Dokument-Status:** Aktualisiert (2026-05-14) — alle 26 ACCEPTs committed · v1.10 Phases 27+28 shipped  
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
| USM-001 | Kopier-Button unresponsive (Passwort-Generierung) | ✅ | **Behoben.** `navigator.clipboard.writeText()` mit `.then()` für "Kopiert!"-Feedback (2 s). |
| USM-001 | Nutzer ohne Standortzuweisung möglich | ✅ | **Behoben.** Validierung: mindestens ein Zentrum Pflicht; Inline-Fehlermeldung + rotes Pflichtfeld-Label. |
| USM-001 | Fehlende Fehlermeldung bei Pflichtfeldern | ✅ | **Behoben.** Username-Feld mit Pflichtvalidierung und Inline-Fehlertext. |
| USM-002 | Deaktivieren geht nicht, nur Löschen | ❌ | **Reject (by design).** Kontoabschalten vs. Löschen ist in den aktuellen Anforderungen nicht spezifiziert. Gelöschte Konten werden im Protokoll korrekt anonymisiert (PROT-001 beachten). Rückmeldung: Anforderung ggf. für nächste Milestone formulieren. |
| USM-002 | Bearbeiten gibt keine Fehlermeldung und behält alten Wert | ✅ | **Bereits implementiert.** `handleEditSave` setzt `actionError` sowohl auf HTTP-Fehler als auch auf Exceptions; dismissible Banner oben auf der Seite. |
| USM-008 | Wo konfigurierbar? | 💬 | Aktuell in `config/settings.yaml → auth.maxLoginAttempts`. Phase 28 hat Session-TTL-Konfiguration (refreshTokenTtlMs / refreshAbsoluteCapMs) in die Admin-UI aufgenommen. `maxLoginAttempts` wurde bewusst ausgelassen (Security-Kontrolle, kein Operator-Parameter). Backlog. |

---

### DAT — Dashboard / Datensatz

| ID | Finding | Status | Empfehlung |
|----|---------|--------|------------|
| DAT-003 | Gesamtzahl wird nicht angezeigt (Patienten-Gesamtzahl im simulierten Datensatz) | ✅ | **Bereits korrekt.** „Fälle"-KPI-Kachel zeigt `cases.length` (alle geladenen Fälle, ungefiltert). |
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
| KOH-002 | Cursor bleibt links bei Kohortenname | ✅ | **Behoben.** `text-left text-gray-900` zum Kohortennamen-Input ergänzt. |
| KOH-003 | Subkohorten nur sehr implizit möglich | 💬 | **Design-Entscheidung:** EMD hat keine expliziten Subkohorten; Kohorten werden über gespeicherte Suchen abgebildet. Für Subkohorten wäre eine verschachtelte Filter-Hierarchie nötig — Backlog. |
| KOH-005 | „Analyse"-Tab zeigt nicht an, in welcher Kohorte ich arbeite | ✅ | **Behoben in A-04** — Kohortenname wird bei gespeicherten Suchen unter dem Seitentitel angezeigt |
| KOH-003 | Auswahl wird gelöscht, wenn auf „Analysieren" geklickt und dann zurück | 💬 | **Accept als Backlog.** Filter-State sollte beim Rücknavigieren erhalten bleiben (History-State oder Persistenz im Context). Nicht trivial — aufwandsmäßig einordnen. |
| KOH-006 | Kohorte eher umständlich anzuzeigen | 💬 | Gemeint ist wahrscheinlich, dass der Weg zur Kohortenübersicht nicht direkt ist. UX-Verbesserung, Backlog. |

---

### ANL — Analyse

| ID | Finding | Status | Empfehlung |
|----|---------|--------|------------|
| ANL-002 | Subkohorte gibt es nicht; man kann Kohorten vergleichen | 💬 | Korrekte Beobachtung — entspricht dem Design (CohortCompareDrawer). Keine Änderung nötig; Anforderungstext präzisieren. |
| ANL-002 | Behandlungsintervall nicht vergleichend dargestellt | 💬 | Intervall-Histogramm existiert als eigenständiger Metrik-Tab, aber `IntervalHistogram` nimmt nur eine Kohorte. Vergleichs-Modus erfordert Erweiterung der Komponente. Backlog. |
| ANL-002 | Was ist „Responder"? | ✅ | **Behoben.** ℹ-Tooltip am Responder-Tab: „Visus-Verbesserung ≥ 5 Buchstaben ETDRS oder CRT-Reduktion ≥ 10 % gegenüber Baseline". |
| ANL-002 | Vergleich anderer Parameter (Aggregiert-Tab) relevant | 💬 | **Backlog.** Kohorten-Vergleich auf Aggregiert-Tab ausweiten ist Erweiterungsfeature. |
| ANL-003 | Vergleich gibt es nicht | 💬 | Kohorten-Vergleich ist im Trajektorien-Tab über CohortCompareDrawer möglich. Im Aggregiert-Tab fehlt er. Backlog. |
| ANL-003 | Alter vs. Visus: X-Achse nicht monoton steigend | ✅ | **Behoben.** `ageVisusScatter` wird jetzt nach `age` aufsteigend sortiert. |
| ANL-002 | Visusverlaufskurve 2× unterschiedlich dargestellt | 💬 | **By design:** Aggregiert-Tab = Quartalsmittelwert (einfache Gruppierung), Trajektorien-Tab = spline-geglättete Per-Patient-Trajektorie. Unterschied ist beabsichtigt, sollte aber in der UI kenntlich gemacht werden. Backlog. |
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
| FALL-003 | Events in Behandlungsverlauf klickbar → nur absoluter Verlauf, nicht relativer | ✅ | **Behoben.** `highlightDate`-ReferenceLine jetzt auch in relativem Verlaufschart. |
| FALL-003 | Zwei Buttons für eine Funktion | ✅ | **Behoben.** Visus- und CRT-Icons im Behandlungs-Timeline sind jetzt nur dekorativ; das gesamte Encounter-Tile ist ein einziger klickbarer Hotspot für `highlightDate`. |
| FALL-003 | CRT-Bezeichnung in Legende | ✅ | **Behoben in A-07** — Y-Achsen-Label-Winkel korrigiert (von 90° auf −90°) |
| FALL-003 | Einheit Visus fehlt | ✅ | **Behoben.** Visus-Y-Achse zeigt jetzt "Visus (dezimal)". |
| FALL-003 | Legende sagt Interpolation sei gestrichelt — ist sie nicht | ✅ | **Behoben in A-08** — Hinweistext auf „Offener Kreis = interpoliert" korrigiert |
| FALL-005 | Qualität der Umsetzung diskutabel | 💬 | Ohne Screenshot / konkrete Beschreibung nicht beurteilbar. Um welche Ansicht handelt es sich genau? |
| FALL-004 | Wirkstoff pro Injektion darstellen (unterrepräsentiert) | ✅ | **Behoben.** Violettes Wirkstoff-Badge aus `patientCase.medications[0].medicationCodeableConcept` in jeder Injektionszeile. |

---

### QUAL — Datenqualität

| ID | Finding | Status | Empfehlung |
|----|---------|--------|------------|
| QUAL-001 | Prüfung nicht auf Kohorten möglich (nur eigener Filter) | 💬 | **Backlog / Scope.** Kohorten-basierte Qualitätsprüfung ist sinnvoll, aber erheblicher Aufwand. Kein Bestandteil von Phase 28 (Session-UI) oder Phase 29 (Home-Panel). Mittelfristiges Backlog. |
| QUAL-001 | Zu prüfende Parameter nicht konfigurierbar | ❌ | **Reject (Scope).** Konfigurierbare Prüfparameter sind nicht in EMDREQ spezifiziert. Anforderung für zukünftige Milestone aufnehmen. |
| QUAL-006 | Qualität der Umsetzung diskutabel | 💬 | Ohne Konkretisierung nicht beurteilbar. Was genau ist unbefriedigend? |
| QUAL-006 | Fehlerkennung: Anzeige nur weit unten, nicht am Datum | ✅ | **Behoben.** Anomalie-Banner zeigt jetzt einen Status-Chip statt „Fehler melden"-Button, wenn der Parameter bereits geflaggt wurde. Flags sind sowohl in der Wertetabelle als auch im Anomalie-Banner direkt sichtbar. |
| QUAL-006 | Mehrere Fehlerkennzeichnungen pro Parameter — Bestätigung gilt für alle | ✅ | **Behoben.** `updateQualityFlag` matcht jetzt auf `flaggedAt` (eindeutig pro Flag) statt auf `parameter`. |
| QUAL-004 | Fehlende Werte werden nicht vorgeschlagen | 💬 | **Backlog.** Auto-Suggest für fehlende Werte (Imputation) ist nicht in EMDREQ. Anforderung für künftige Milestone. |
| QUAL-009 | Kohorten nicht prüfbar | 💬 | Wie QUAL-001. |
| QUAL-011 | Grundgesamtheit wird nicht nach Zeitraum gefiltert | ✅ | **Behoben.** Bei aktivem Zeitraum-Filter (nicht „Alle") erscheint ein blauer Pill-Badge im DocQualityPage-Untertitel. |
| QUAL-011 | Zentren-Filter hinter Zeitraum-Filter versteckt | ✅ | **Behoben.** Zentrum-Dropdown aus dem einklappbaren Filter-Panel herausgelöst und immer sichtbar in der DocQualityPage-Kopfzeile. |
| QUAL-011 | Zentrum-Filter öffnet nur Detailansicht; kein Multi-Select | ❌ | **Reject vorerst.** Multi-Select mehrerer Zentren gleichzeitig ist erheblicher Mehraufwand und nicht in EMDREQ spezifiziert. Anforderung für nächste Milestone. |
| QUAL-011 | Nicht für Kohorten möglich | 💬 | Wie QUAL-001. |
| QUAL-011 | Absolute Kennzahlen fehlen | ✅ | **Behoben.** SummaryCards in QualityPage zeigen jetzt Prozentwert (z. B. 27 %) unter der absoluten Zahl. |
| QUAL-011 | Ergebnisse der Prüfung fehlen | ✅ | **Behoben.** Prozentualer Anteil geprüfter / in Bearbeitung / ungecheckt Fälle direkt in den SummaryCards sichtbar. |
| QUAL-011 | Plausibilitätsbereiche nur über Zentrum-Details | ✅ | **Behoben.** MetricCard zeigt Zielwert (Standard 80 %) und absolute Fallzahl unterhalb des Fortschrittsbalkens. |

---

### PROT — Protokoll / Audit Log

| ID | Finding | Status | Empfehlung |
|----|---------|--------|------------|
| PROT-001 | Gelöschter Account erscheint im Protokoll als „anonymous" | ✅ | **Behoben.** DELETE /api/auth/users/:username ruft jetzt `revokeByUsername(target)` auf — alle aktiven Sessions werden beim Löschen ungültig gemacht. Zukünftige Requests mit altem Token scheitern an der Session-Prüfung, bevor JWT-Identität in Audit-Log als "anonymous" erscheinen kann. |

---

## Zusammenfassung

| Status | Anzahl |
|--------|--------|
| ✅ ACCEPT — committed | 26 |
| ❌ REJECT (nicht im Scope) | 3 |
| 💬 COMMENT / Backlog | 22 |

Alle 26 ACCEPT-Items wurden implementiert und committed (2026-05-14).

### v1.10 Milestone Status

| Phase | Inhalt | Status |
|-------|--------|--------|
| 27 — Stateful Session Backend | Server-seitige Sitzungstabelle, Token-Rotation, Key-Rotation | ✅ Shipped 2026-05-11 |
| 28 — Admin Session Control UI | Sitzungsauflistung, Einzel-Revoke, Sign-out-everywhere, TTL-Konfiguration | ✅ Shipped 2026-05-14 |
| 29 — Home Panel UX | Review-Buttons + Jump-Back-In-Navigation (FB-02, FB-03) | ⏳ Ausstehend |
| 30 — Terminology Configuration Docs | settings.yaml + Konfiguration.md Terminology-Abschnitt | ⏳ Ausstehend |

### Offene Backlog-Items (mittelfristig, kein akuter Bug)

| ID | Beschreibung |
|----|-------------|
| FB-02 | Home „Attention needed" Review-Buttons → Phase 29 |
| FB-03 | Home „Jump Back In" Routing → Phase 29 |
| KOH-003 | Filter-State beim Rücknavigieren erhalten (History-State) |
| ANL-002 | Intervall-Histogramm auch im Kohorten-Vergleichsmodus |
| ANL-002 | Visus-Berechnung Aggregiert vs. Trajektorien in UI kenntlich machen |
| ANL-003 | Kohorten-Vergleich auch im Aggregiert-Tab |
| FALL-001 | Direkte Chart→Falldetail-Navigation (Phase-29-Scope) |
| FALL-006 | Erweiterter Fall–Kohorte-Vergleich in Fallansicht |
| QUAL-001 | Kohorten-basierte Qualitätsprüfung |
| QUAL-004 | Auto-Suggest fehlender Werte (Imputation) |
| USM-006 | Rate-Limiting-Meldung mit verbleibendem Timeout |
| USM-008 | `maxLoginAttempts` Admin-konfigurierbar (bewusst aus Phase 28 ausgelassen) |
| A-06 | Fehlende Achsenticks (Screenshot für Repro benötigt) |
| A-09 | Zeitraum-Badge in Grundgesamtheit QualityPage |
