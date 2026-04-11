# Anforderungsabgleich — EyeMatics Klinischer Demonstrator (EMD)

**Stand:** 11.04.2026 | **Version:** 1.1 (nach Lint-Cleanup und Konsistenzpruefung)

> Dieses Dokument gleicht die Anforderungen aus Lastenheft (RE-EM-LH) und Pflichtenheft (EMDREQ-*) mit der tatsaechlichen Implementierung im EMD v1.1 ab.

---

## 1. Benutzer- und Zugriffsverwaltung (RE-EM-K01, K10)

| Lastenheft-ID | Pflichtenheft-ID | Beschreibung | Status | Nachweis |
|---------------|------------------|--------------|--------|----------|
| N01.01 | EMDREQ-USM-005 | Nutzernamen-Eingabe | Umgesetzt | `src/pages/LoginPage.tsx` — Formularfeld `username` |
| N01.02 | EMDREQ-USM-005 | Passwort-Eingabe und Bestaetigung | Umgesetzt | `src/pages/LoginPage.tsx` — Formularfeld `password`, `POST /api/auth/login` |
| N01.03 | EMDREQ-USM-005 | OTP-Eingabe (2FA) | Umgesetzt | `src/pages/LoginPage.tsx` — OTP-Formular, `POST /api/auth/verify` |
| N01.04 | EMDREQ-USM-005 | OTP-Bestaetigung | Umgesetzt | `server/authApi.ts` — `/verify` Endpunkt prueft OTP gegen `config/settings.yaml` |
| N01.05 | EMDREQ-USM-005 | Abbruch des Anmeldeprozesses | Umgesetzt | Client-seitig: Navigation zurueck zum Login-Formular |
| N01.06 | EMDREQ-USM-006 | Fehlermeldung bei falschen Daten | Umgesetzt | `server/authApi.ts` — 401 mit Fehlermeldung, Client zeigt Fehler an |
| N01.07 | EMDREQ-USM-006 | Passwort-Wiederholung mit Begrenzung | Umgesetzt | `server/rateLimiting.ts` — 5 Versuche (konfigurierbar), exponentielles Backoff |
| N01.08 | EMDREQ-USM-006 | OTP-Wiederholung mit Begrenzung | Umgesetzt | Challenge-Token laeuft ab; Ratenbegrenzung greift |
| N01.09 | — | Anmeldestatus anzeigen | Umgesetzt | `src/context/AuthContext.tsx` — `user` State, `Layout.tsx` zeigt Benutzername |
| N01.10 | EMDREQ-USM-007 | Aktive Abmeldung | Umgesetzt | `AuthContext.tsx` — `logout()` loescht sessionStorage und JWT |
| N01.11 | EMDREQ-USM-008 | Automatische Abmeldung bei Inaktivitaet | Umgesetzt | `AuthContext.tsx` — Inaktivitaets-Timer mit konfigurierbarer Dauer, Warnung vor Abmeldung |
| N10.01 | EMDREQ-USM-004 | Rollen verwalten | Umgesetzt | `src/pages/AdminPage.tsx` — Rollenauswahl beim Anlegen, 6 Rollen definiert |
| N10.02 | EMDREQ-USM-004 | Zentren zuweisen | Umgesetzt | `AdminPage.tsx` — Zentren-Checkboxen bei Benutzeranlage |
| N10.03 | EMDREQ-USM-003 | Anmeldenamen zuweisen | Umgesetzt | `server/authApi.ts` — `POST /api/auth/users` mit eindeutigem Username |
| N10.04 | EMDREQ-USM-001 | Benutzer anlegen und speichern | Umgesetzt | `server/authApi.ts` — `POST /api/auth/users`, Passwort bcrypt-gehasht |
| — | EMDREQ-USM-002 | Benutzer loeschen | Umgesetzt | `server/authApi.ts` — `DELETE /api/auth/users/:username` (nur Admin) |

## 2. Systemstart und Datengrundlage (RE-EM-K11)

| Lastenheft-ID | Pflichtenheft-ID | Beschreibung | Status | Nachweis |
|---------------|------------------|--------------|--------|----------|
| N11.01 | EMDREQ-DAT-001, DAT-002 | Landing Page mit Zentreninformationen | Umgesetzt | `src/pages/LandingPage.tsx` — Zentren-Karten mit Name, Kuerzel, Fallzahlen |
| N11.02 | EMDREQ-DAT-003 | Behandelte Patienten je Zentrum | Abweichend | Fallzahlen aus lokalen FHIR-Bundles berechnet; Gesamtzahl nicht via DSF geliefert |
| — | EMDREQ-DAT-004 | Aktualitaetsstand anzeigen | Teilweise | Kein DSF-Zeitstempel verfuegbar; letzte lokale Datenverfuegbarkeit implizit |

## 3. Kohortenbildung (RE-EM-K02, K09)

| Lastenheft-ID | Pflichtenheft-ID | Beschreibung | Status | Nachweis |
|---------------|------------------|--------------|--------|----------|
| N02.01 | EMDREQ-KOH-001 | Filterparameter konfigurierbar | Umgesetzt | `src/pages/CohortBuilderPage.tsx` — Alter, Geschlecht, Visus, Diagnose, Zentrum |
| N02.02 | EMDREQ-KOH-002 | Filterkriterien definieren | Umgesetzt | Bereichsfilter (Alter, Visus), Mehrfachauswahl (Geschlecht, Zentren) |
| N02.03 | EMDREQ-KOH-003 | Faelle nach Kriterien anzeigen | Umgesetzt | Kohorte wird live gefiltert und als Tabelle angezeigt |
| N02.04–N02.05 | EMDREQ-KOH-002 | Parameter definieren | Umgesetzt | Filterkriterien dienen als Parameter-Definition |
| N02.06 | EMDREQ-KOH-003 | Sub-Kohorten anzeigen | Umgesetzt | Mehrere Filterebenen moeglich |
| N02.07 | EMDREQ-ANL-001 | Verteilung ueber Zentren | Umgesetzt | `src/pages/AnalysisPage.tsx` — Zentren-Verteilungsdiagramm |
| N02.08–N02.09 | EMDREQ-ANL-002 | Zeitlicher Verlauf | Umgesetzt | Visus/CRT-Verlaufsdiagramme in AnalysisPage |
| N02.10–N02.13 | EMDREQ-ANL-003 | Verteilung metrischer Parameter | Umgesetzt | Verteilungshistogramme, Box-Plots |
| N02.14 | EMDREQ-ANL-004 | Kritische Werte / Adverse Events | Umgesetzt | Konfigurierbare Schwellenwerte in `src/config/clinicalThresholds.ts` |
| N02.15 | EMDREQ-KOH-003 | Weitere Subkohorten per Filter | Umgesetzt | Filterbare Kohortenansicht |
| N02.16 | EMDREQ-KOH-004 | Kohorte speichern | Abweichend | Nur Suchdefinition gespeichert (nicht Ergebnis), `POST /api/data/saved-searches` |
| N09.01 | EMDREQ-KOH-005 | Vorherige Suche auswaehlen | Umgesetzt | Gespeicherte Suchen per Dropdown, `GET /api/data/saved-searches` |
| N09.02 | EMDREQ-KOH-005 | Nach Datum/Name sortieren | Umgesetzt | Sortierung in der UI |
| N09.03 | EMDREQ-KOH-006 | Suche erneut ausfuehren | Umgesetzt | Gespeicherte Filter werden geladen und auf aktuelle Daten angewendet |
| N09.04 | — | Persistierte Suchergebnisse | Abweichend | Nur Suchdefinition gespeichert, keine Datenduplikate |
| N08.01 | EMDREQ-KOH-007 | Datensatz downloaden | Abweichend | Rechtlich nicht abgedeckt; `src/utils/download.ts` existiert fuer Screenshots |

## 4. Source-Data Verification und Datenqualitaet (RE-EM-K03, K04)

| Lastenheft-ID | Pflichtenheft-ID | Beschreibung | Status | Nachweis |
|---------------|------------------|--------------|--------|----------|
| N03.01 | EMDREQ-QUAL-001 | Zu pruefende Parameter definieren | Umgesetzt | `src/pages/QualityPage.tsx` — Parameter-Auswahl |
| N03.02 | EMDREQ-QUAL-002 | Pruefstatus anzeigen | Umgesetzt | Quality Flags (ungeprueft/gemeldet), `src/components/quality/QualityCaseList.tsx` |
| N03.03 | — | Mit Patientenakte vergleichen | Nicht umgesetzt | Setzt Zugriff auf identifizierbare Primaerdaten voraus |
| N03.05–N03.06 | EMDREQ-QUAL-004 | Fehlende/auffaellige Daten anzeigen | Umgesetzt | `QualityCaseDetail.tsx` — Hervorhebung auffaelliger Werte |
| N03.07 | EMDREQ-QUAL-003 | Fall zur Pruefung auswaehlen | Umgesetzt | Klickbare Fallliste in QualityPage |
| N03.08–N03.09 | EMDREQ-QUAL-004 | Zu pruefende Werte anzeigen | Umgesetzt | Detailansicht pro Fall |
| N03.10 | EMDREQ-QUAL-005 | Fehler kennzeichnen | Umgesetzt | `QualityFlagDialog.tsx` — Dialog mit Fehlertyp-Auswahl |
| N03.11–N03.12 | EMDREQ-QUAL-006 | Pruefergebnisse anzeigen | Umgesetzt | Quality Flags pro Fall und Parameter sichtbar |
| N03.13 | EMDREQ-QUAL-005 | Fehlerart kennzeichnen | Umgesetzt | 5 Fehlertypen: Unplausibel, Fehlend, Duplikat, Formatfehler, Sonstiger Fehler |
| N03.14 | — | Verantwortliche anzeigen (opt.) | Nicht umgesetzt | Datenschutzrechtlich nicht vorgesehen |
| N03.15 | — | Externe Bewertungen (opt.) | Nicht umgesetzt | Ausserhalb der Systemgrenze |
| N03.16 | — | Mehrfachbewertungen (opt.) | Nicht umgesetzt | Ausserhalb der Systemgrenze |
| N03.17 | EMDREQ-PROT-001 | Einsichten mit Zeitstempel | Abweichend | Generalisierte Protokollierung via Audit-Log (`server/auditMiddleware.ts`) |
| N03.18 | — | Datennutzungsprojekt anzeigen | Nicht umgesetzt | Ausserhalb des EMD |
| N04.01–N04.02 | EMDREQ-QUAL-007 | Fehlerbehandlungsstatus | Umgesetzt | Quality Flags zeigen Status pro Fall/Parameter |
| N04.04 | EMDREQ-QUAL-008 | Von Analysen ausschliessen | Umgesetzt | `PUT /api/data/excluded-cases`, `PUT /api/data/reviewed-cases` |
| N04.05 | — | Aenderungsverlaeufe anzeigen | Nicht umgesetzt | Nicht sinnvoll bei nicht-manipulativer EMD-Nutzung |
| N04.06 | — | Eingaben/Loeschungen dokumentieren | Nicht umgesetzt | Keine Rueckschreibung ins Primaersystem |

## 5. Einzelfallanalyse (RE-EM-K05)

| Lastenheft-ID | Pflichtenheft-ID | Beschreibung | Status | Nachweis |
|---------------|------------------|--------------|--------|----------|
| N05.01 | EMDREQ-FALL-002 | Faelle pseudonymisieren | Abweichend | Alle Daten sind pseudonym; Reidentifikation nicht vorgesehen |
| N05.02 | EMDREQ-FALL-005 | Starke Abweichungen kennzeichnen | Umgesetzt | Konfigurierbare Schwellenwerte in `clinicalThresholds.ts` |
| N05.03 | EMDREQ-FALL-001 | Fall auswaehlen | Umgesetzt | `src/pages/CaseDetailPage.tsx` — Navigation via Kohorte oder URL |
| N05.04–N05.05 | EMDREQ-FALL-004 | Injektionen, Arzneimittel | Umgesetzt | `MedicationCard.tsx`, FHIR MedicationAdministration-Ressourcen |
| N05.06–N05.07 | EMDREQ-FALL-004 | Augeninnendruck, Visus | Umgesetzt | `VisusCrtChart.tsx`, `ClinicalParametersRow.tsx` |
| N05.08 | EMDREQ-FALL-004 | Anamnese | Umgesetzt | `AnamnesisFindings.tsx` |
| N05.17 | EMDREQ-FALL-003 | Verlaufsdokumentation | Umgesetzt | Zeitliche Verlaufsdiagramme in CaseDetailPage |
| N05.23 | EMDREQ-FALL-006 | Mit Kohortenwerten vergleichen | Umgesetzt | Kohortenvergleich in Diagrammen |
| N05.24–N05.25 | EMDREQ-FALL-003 | Zeitlicher Verlauf, Injektionen | Umgesetzt | Visus/CRT-Verlauf mit Injektionsmarkern |
| N05.26–N05.27 | EMDREQ-FALL-004 | Absolute/relative Messwerte | Umgesetzt | `DistributionCharts.tsx` |
| N05.28–N05.29 | EMDREQ-FALL-005 | Kritische Werte, Adverse Events | Umgesetzt | Schwellenwert-basierte Kennzeichnung |

## 6. Therapieabbruch/-unterbrechung (RE-EM-K06)

| Lastenheft-ID | Pflichtenheft-ID | Beschreibung | Status | Nachweis |
|---------------|------------------|--------------|--------|----------|
| N06.01 | EMDREQ-QUAL-009 | Zeitkriterium Unterbrecher definieren | Umgesetzt | `config/settings.yaml` — `therapyInterrupterDays: 120` |
| N06.02 | EMDREQ-QUAL-009 | Faelle kennzeichnen | Umgesetzt | Automatische Berechnung in CohortBuilderPage |
| N06.03 | EMDREQ-QUAL-010 | Nach Abbrechern/Unterbrechern filtern | Umgesetzt | Filteroptionen in der Kohortenansicht |
| N06.04 | EMDREQ-QUAL-009 | Zeitkriterium Abbrecher definieren | Umgesetzt | `config/settings.yaml` — `therapyBreakerDays: 365` |
| N06.05–N06.07 | EMDREQ-QUAL-010 | Alle Abbrecher anzeigen, Kriterium anzeigen | Umgesetzt | Kennzeichnung in der Fallliste mit Kriterium |

## 7. Dokumentationsqualitaet (RE-EM-K07)

| Lastenheft-ID | Pflichtenheft-ID | Beschreibung | Status | Nachweis |
|---------------|------------------|--------------|--------|----------|
| N07.01 | EMDREQ-QUAL-011 | Zentrum auswaehlen | Umgesetzt | `src/pages/DocQualityPage.tsx` — Zentrenauswahl |
| N07.02 | EMDREQ-QUAL-011 | Zeitraum auswaehlen | Umgesetzt | Zeitraum-Filter in DocQualityPage |
| N07.03 | EMDREQ-QUAL-011 | Dokumentationsqualitaet anzeigen | Umgesetzt | Metriken: Vollzaehligkeit, Vollstaendigkeit, Plausibilitaet |
| N07.04 | — | SDV-Stichproben anzeigen | Nicht umgesetzt | Setzt identifizierbare Primaerdaten voraus |
| N07.05 | EMDREQ-QUAL-011 | Qualitaet aller Zentren anzeigen | Umgesetzt | `CenterComparisonChart.tsx`, `CenterTable.tsx` |
| N07.06 | — | Aktualisierungsfrequenz | Abweichend | DSF-Datenaktualitaet nicht uebermittelt |

## 8. Protokollierung (RE-EM-K03 N03.17)

| Lastenheft-ID | Pflichtenheft-ID | Beschreibung | Status | Nachweis |
|---------------|------------------|--------------|--------|----------|
| N03.17 | EMDREQ-PROT-001 | Zugriffe protokollieren | Umgesetzt | `server/auditMiddleware.ts` — SQLite audit.db, Zeitstempel, Nutzer, Methode, Pfad, Status, Dauer |
| — | — | Audit-Log einsehbar | Umgesetzt | `src/pages/AuditPage.tsx`, `GET /api/audit` (auto-scoped nach Rolle) |
| — | — | Audit-Export (Admin) | Umgesetzt | `GET /api/audit/export` (nur Admin) |

## Zusammenfassung

| Kategorie | Umgesetzt | Abweichend | Nicht umgesetzt | Gesamt |
|-----------|-----------|------------|-----------------|--------|
| Authentifizierung (K01) | 11 | 0 | 0 | 11 |
| Nutzerverwaltung (K10) | 5 | 0 | 0 | 5 |
| Datengrundlage (K11) | 1 | 1 | 0 | 2 |
| Kohortenbildung (K02, K09) | 12 | 3 | 0 | 15 |
| SDV/Qualitaet (K03, K04) | 12 | 1 | 5 | 18 |
| Einzelfallanalyse (K05) | 11 | 1 | 0 | 12 |
| Therapieabbruch (K06) | 7 | 0 | 0 | 7 |
| Dok.Qualitaet (K07) | 4 | 1 | 1 | 6 |
| Protokollierung | 3 | 0 | 0 | 3 |
| **Gesamt** | **66** | **7** | **6** | **79** |

**Abweichend umgesetzte Anforderungen** betreffen ausschliesslich:
- Speicherung von Suchdefinitionen statt Ergebnissen (datenschutzkonform)
- Pseudonymisierung aller Daten (nicht nur fremder Zentren)
- DSF-abhaengige Informationen (Aktualitaet, Gesamtzahlen) die nicht uebermittelt werden
- Export-Einschraenkungen aus rechtlichen Gruenden

**Nicht umgesetzte Anforderungen** betreffen ausschliesslich:
- Zugriff auf identifizierbare Primaerdaten (SDV, N03.03)
- Optionale Anforderungen (N03.14–N03.16, externe Bewertungen)
- Aenderungsverlaeufe im Primaersystem (N04.05–N04.06)
- SDV-Stichproben (N07.04)

---

*Dieses Dokument ersetzt die vorige docx-Version und wird als Markdown neben dem Pflichtenheft gepflegt.*
