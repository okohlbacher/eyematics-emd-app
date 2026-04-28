Table of Contents {#table-of-contents .TOCHeading}
=================

Lastenheft
==========

EyeMatics -- Dashboard-Demonstrator

*Kürzel: RE-EM-LH • Status: KOMMENTIERUNGSPHASE*

  -------------------- -------------------------------------------
  **Dokumentstatus**   KOMMENTIERUNGSPHASE
  **Kürzel**           RE-EM-LH
  **Projekt**          EyeMatics
  **Projektleitung**   Eter, Nicole
  **Version**          29 (29.04.2025)
  **Autoren**          Nils Freyer, Susann Bozkir, Rainer Röhrig
  **Prüfer\*in**       Myriam Lipprandt, Kobak, Eva-Maria
  **Freigeber\*in**    Eter, Nicole; Tobias Brix
  -------------------- -------------------------------------------

Revisionshistorie
=================

  Version   Datum        Autor        Beschreibung
  --------- ------------ ------------ -----------------------------------------------------
  1         05.09.2024   Freyer, N.   Erstversion
  6         11.03.2025   Bozkir, S.   Aktualisierung
  29        29.04.2025   Röhrig, R.   Präambel, Zweckbestimmung, erweiterte Anforderungen

3 Präambel: Offene Fragen an das Konsortium
===========================================

Im Rahmen der Anforderungsanalyse zeigten sich mehrere Punkte, die
abgestimmte Vorgaben erforderlich machen.

  Nr.   Thema                                   Entscheidung                                 Begründung
  ----- --------------------------------------- -------------------------------------------- ---------------------------------------------------------------------------------------------
  1     Rechtsgrundlage der Datenverarbeitung   Initial BC, GDNG wird in AP02 geprüft        Im Antrag auf BC verständigt. Ca. 20% BC-Abdeckung in Münster. GDNG parallel angestrebt.
  2     Architektur                             On Premises                                  Dem Vorbild der MII folgend. Dashboard an jedem Standort betrieben.
  3     PROMs Zweckbestimmung                   Beides (Routine + Forschung)                 Entscheidung obliegt Standorten. BC-Zusatzmodul für Forschungszweck. Ethikvotum durch AP08.
  4     Datensatzdefinition                     Vorgabe durch AP03, iterativ                 Kerndatensatz initial durch AP03; PROMs von AP08.
  5     Datenexport                             FDPG und DSF                                 Datenaustausch primär über DSF. Plugin von AP04.
  6     Reidentifikation für SDV/Chart Review   Änderung im Quellsystem (Benachrichtigung)   Fehler sollen im Primärsystem behoben werden.
  7     Ergebnisdokumentation SDV               *\[In Klärung\]*                             
  8     Ergebnisdokumentation Chart Review      *\[In Klärung\]*                             

4 Einleitung
============

Dieses Lastenheft beschreibt systematisch die verbindlichen
Anforderungen an den im Rahmen des Verbundprojekts „EyeMatics" zu
entwickelnden Dashboard-Demonstrator. Alle relevanten
Nutzungs-Anforderungen werden durch Kontext-Interviews und die Abfrage
von Nutzungsszenarien ermittelt. Die Definition der Kernaufgaben bildet
die Grundlage für die Kategorisierung spezifischer Anforderungen und der
Evaluation des Systems.

4.1 Hintergrund
---------------

In Deutschland gibt es jährlich rund 10.000 neue Erblindungen, wobei 50
Prozent durch die altersbedingte Makuladegeneration und 17 Prozent durch
diabetische Retinopathie verursacht werden. Die „Intravitreale operative
Medikamentenapplikation" (IVOM) ist eine gängige Therapie und wird etwa
1,5 Millionen Mal pro Jahr durchgeführt. Im Rahmen des
Forschungsprojekts EyeMatics soll an verschiedenen Standorten ein
Prozess zur systematischen Erhebung IVOM-spezifischer Daten eingeführt
werden.

4.2 Zielsetzung
---------------

Die Zweckbestimmung des EyeMatics Dashboards adressiert den Bedarf an
Routinedaten aus den IVOM-Behandlungen mit dem Ziel, Forschungsfragen
auf ihre Machbarkeit zu generieren.

5 Zweckbestimmung
=================

  -------------------------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Verwendungszweck**       Darstellung von Behandlungsdaten von IVOM Patient\*innen. Unterstützung der Generierung von Forschungsfragen und Prüfung der Machbarkeit durch Darstellung von Behandlungsverläufen, Source-Data-Verification, Chart-Reviews und aggregierten Patientendaten.
  **Nutzer\*innen**          **Forscher\*innen**: Ärzt\*innen in der Ophthalmologie mit augenärztlicher Expertise und Basiswissen zur Studienplanung.
  **Weitere Stakeholder**    DIZ-Leitungen/-Mitarbeiter\*innen, Biometriker\*innen/Epidemiolog\*innen.
  **Anwendungsbegrenzung**   Das Dashboard soll *nicht* in der Krankenversorgung eingesetzt werden.
  **Leistungsbegrenzung**    Keine genomischen Daten. Ausschließlich EyeMatics-Kerndatensatz.
  **Einschlusskriterien**    IVOM-Behandlung (OPS 5-156.9). Rechtsgrundlage gegeben (BC oder GDNG). Alter ≥ 18 Jahre.
  **Ausschlusskriterien**    Widerspruch der Patient\*in (bei Einwilligung als Rechtsgrundlage).
  **Rahmenbedingungen**      Tübingen ist Hersteller. FHIR + Kerndatensatz. On-Premises je Standort. Open Source (MIT).
  -------------------------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

5.1 Stakeholder-Analyse
-----------------------

  ID   Funktion/Rolle          Fachgebiet                                  Ziele und Interessen
  ---- ----------------------- ------------------------------------------- ----------------------------------------------------------------------
  1    Forscher\*in (Klinik)   Ärzt\*innen der Augenheilkunde              Entwicklung von Forschungsfragen, Prüfung auf Machbarkeit
  2    IT-Administrator\*in    IT-Betrieb                                  Installation, Betrieb des Demonstrators, IT-Security
  3    Epidemiolog\*in         Studienplanung, Studiendesign, Analysen     Machbarkeitsbewertung und Studienplanung (Fallzahlen, Datenqualität)
  4    Kliniker\*in            Klinische Versorgung                        Behandlung von Patient\*innen
  5    DIZ Data Manager        Kerndatensatz im FHIR-Store bereitstellen   Datenbereitstellung
  6    Klinikleitung           Ggf. mehr Einsicht in Benchmarking-Daten    Überblick über Dokumentationsqualität
  7    Patientinnen            --                                          --

6 Anforderungsanalyse
=====================

Für die Analyse wurden Stakeholder identifiziert und durch
Kontext-Interviews Erfordernisse ausgearbeitet. Anforderungstypen:
Nutzungs-, Regulatorische, Fachliche, Markt- und Organisatorische
Anforderungen.

  ----------- ---------------------------------------------------------------------------------------
  **Typ 1**   **Selbsttätige Systemaktivität** -- System startet und führt Prozess selbsttätig aus.
  **Typ 2**   **Benutzungsinteraktion** -- System stellt Person eine Funktionalität zur Verfügung.
  **Typ 3**   **Schnittstellenanforderung** -- System empfängt Daten von Dritten.
  ----------- ---------------------------------------------------------------------------------------

6.1 Kernaufgaben
----------------

6.1.1 RE-EM-K01: Im System anmelden / abmelden
----------------------------------------------

*User-Story: Als Nutzer\*in möchte ich mich sicher am System an- und
abmelden können.*

  ---------------------------------- -------------------------------------------------------------------------------------------------------------
  **Kurzbeschreibung**               Anmeldung und Abmeldung des Nutzers im System.
  **Nutzer\*in (Stakeholder-IDs)**   Forscher\*in (1), IT-Admin (2), Epidemiolog\*in (3), Kliniker\*in (4), DIZ Data Manager (5)
  **Auslösendes Ereignis**           Nutzer möchte sich im System anmelden.
  **Hauptszenario**                  1\. Nutzernamen eingeben 2. Passwort eingeben 3. 2-FA/OTP eingeben 4.
                                     Rechte vergeben 5. Abgeschlossen
  **Alternativszenarien**            Falsche Nutzerdaten: Rückmeldung und Korrektur. OTP fehlerhaft: zurück zu Schritt 3. Abbruch: Login-Screen.
  **Nachbedingungen**                Nutzer erfolgreich angemeldet, Berechtigungen erteilt.
  ---------------------------------- -------------------------------------------------------------------------------------------------------------

### Anforderungen

  ID       Beschreibung                                                                         Typ
  -------- ------------------------------------------------------------------------------------ -----
  N01.01   System muss Nutzernamen und Passwort Eingabe ermöglichen.                            2
  N01.02   System muss Nutzernamen und Passwort Bestätigung ermöglichen.                        2
  N01.03   System muss OTP einer 2-FA Eingabe ermöglichen.                                      2
  N01.04   System muss OTP einer 2-FA Bestätigung ermöglichen.                                  2
  N01.05   System muss Abbruch des Anmeldeprozesses ermöglichen.                                2
  N01.06   Bei falschen Anmeldedaten muss Fehlermeldung angezeigt werden.                       2
  N01.07   Bei fehlerhaftem Passwort muss Wiederholung möglich sein. Begrenzung der Versuche.   2
  N01.08   Bei fehlerhaftem OTP muss Wiederholung möglich sein. Begrenzung der Versuche.        2
  N01.09   System muss An-/Abmeldestatus anzeigen.                                              1
  N01.10   System muss aktive Abmeldung ermöglichen.                                            2
  N01.11   Nach x Minuten Inaktivität automatische Abmeldung mit Notification.                  1

6.1.2 RE-EM-K02: Erzeugen eines Datensatzes
-------------------------------------------

*User-Story: Als Nutzer\*in möchte ich Kriterien zur Einteilung von
Fällen definieren, eine Sub-Kohorte erstellen, Parameter festlegen und
Muster analysieren.*

  ---------------------------------- ----------------------------------------------------------------------------------------------------
  **Kurzbeschreibung**               Nutzer\*in kann einen Datensatz der IVOM-Behandlungen für spätere Verwendung erstellen.
  **Nutzer\*in (Stakeholder-IDs)**   Forscher\*in (1), Epidemiolog\*in (3), Kliniker\*in (4)
  **Auslösendes Ereignis**           Nutzer\*in möchte Patienten nach Kriterien gruppieren, Sub-Kohorten erzeugen, Zeitraum definieren.
  **Hauptszenario**                  1\. 0-N Kriterien definieren (Visus, Alter, Geschlecht, Medikation,
                                     Therapieschema, Netzhautdicke) 2. Kohorte betrachten 3. Sub-Kohorte
                                     erzeugen (Fraktion R%) 4. Zeitraum T definieren 5. Unabhängige/abhängige
                                     Parameter definieren 6. Muster suchen, filtern 7. Kohorte speichern und
                                     benennen
  **Alternativszenarien**            Keine Einschränkung: alle Daten angezeigt. Keine Fraktion: R=100%.
  **Nachbedingungen**                Erstellte Kohorte (inkl. Sub-Kohorten) im System persistiert.
  ---------------------------------- ----------------------------------------------------------------------------------------------------

### Anforderungen

  ID        Beschreibung                                             Typ
  --------- -------------------------------------------------------- -----
  N02.01    Parameter für Kriterien konfigurierbar.                  1
  N02.02    0-N Kriterien für Kohorte definieren.                    2
  N02.03    Fälle nach Kriterien anzeigen.                           1
  N02.04    1-N unabhängige Parameter definieren.                    2
  N02.05    1-N abhängige Parameter definieren.                      2
  N02.06    M Sub-Kohorten nach Parametern anzeigen.                 1
  N02.07    Verteilung der Fälle über Zentren anzeigen.              1
  N02.08    Messwerte von Kohorten im zeitlichen Verlauf.            1
  N02.09    Messwerte von Sub-Kohorten parallel im Verlauf.          1
  N02.10    Verteilung absoluter Messwerte einer Kohorte.            1
  N02.11a   Absolute Messwerte innerhalb Sub-Kohorte parallel.       1
  N02.11b   Absolute Messwerte über Sub-Kohorten.                    1
  N02.12    Verteilung relativer Messwerte einer Kohorte.            1
  N02.13a   Relative Messwerte innerhalb Sub-Kohorten parallel.      1
  N02.13b   Relative Messwerte über Sub-Kohorten parallel.           1
  N02.14    Anzahl Fälle mit kritischen Werten/Adverse Events.       1
  N02.15    Kohorten über Filter in weitere Subkohorten aufteilen.   2
  N02.16    Kohorte speichern und benennen.                          2

6.1.3 RE-EM-K03: Source-Data Verification und Fehlerkennzeichnung
-----------------------------------------------------------------

*User-Story: Als Nutzer\*in möchte ich eine Sub-Kohorte auswählen, zu
prüfende Parameter definieren sowie Fälle prüfen und abschließen.*

  ---------------------------------- -------------------------------------------------------------------------
  **Kurzbeschreibung**               Plausibilitätsprüfung, Verifikation und Fehlerkennzeichnung im System.
  **Nutzer\*in (Stakeholder-IDs)**   Forscher\*in (1), Epidemiolog\*in (3), Kliniker\*in (4)
  **Auslösendes Ereignis**           Nutzer\*in möchte Fehler kennzeichnen oder Plausibilität prüfen.
  **Hauptszenario**                  1\. Zu prüfende Parameter definieren 2. Übersicht unvollständiger Fälle
                                     3. Fall auswählen, Status prüfen, Parameter pro Datenpunkt prüfen,
                                     Ergebnis markieren
  **Alternativszenarien**            /
  **Nachbedingungen**                Alle Parameter vollständig geprüft und gekennzeichnet.
  ---------------------------------- -------------------------------------------------------------------------

### Anforderungen

  ID       Beschreibung                                            Typ
  -------- ------------------------------------------------------- -----
  N03.01   Zu prüfende Parameter für Sub-Kohorte definieren.       2
  N03.02   Status (unvollständig/geprüft/ungeprüft) anzeigen.      1
  N03.03   Parameter mit Patientenakte vergleichen.                2
  N03.04   Kriterien für Verifikation anzeigen.                    1
  N03.05   Fälle mit fehlenden Daten anzeigen.                     1
  N03.06   Fälle mit unwahrscheinlichen Werten anzeigen.           1
  N03.07   Fall aus Sub-Kohorte auswählen.                         2
  N03.08   Zu prüfende Werte eines Falls anzeigen.                 1
  N03.09   Unwahrscheinliche Werte anzeigen.                       1
  N03.10   Fehler kennzeichnen.                                    2
  N03.11   Prüfungsergebnisse pro Fall anzeigen.                   1
  N03.12   Prüfungsergebnisse pro Parameter anzeigen.              1
  N03.13   Art eines Fehlers kennzeichnen.                         2
  N03.14   Verantwortliche Nutzer\*innen anzeigen. (OPTIONAL)      1
  N03.15   Bewertung externer Fachärztinnen anzeigen. (OPTIONAL)   1
  N03.16   Mehrfachbewertungen explizit anzeigen. (OPTIONAL)       1
  N03.17   Alle Einsichten mit Zeitstempel dokumentieren.          1
  N03.18   Datennutzungsprojekt für verifizierte Daten anzeigen.   1

6.1.4 RE-EM-K04: Fehlerbehandlung
---------------------------------

*User-Story: Als Nutzer\*in möchte ich Fälle mit unvollständiger
Fehlerbehandlung korrigieren oder von Analysen ausschließen.*

  ---------------------------------- ------------------------------------------------------------------------------
  **Kurzbeschreibung**               Gesamtheit der Fehlerbehandlung im System.
  **Nutzer\*in (Stakeholder-IDs)**   Forscher\*in (1), Epidemiolog\*in (3), Kliniker\*in (4)
  **Auslösendes Ereignis**           Nutzer\*in möchte gefundene Fehler korrigieren oder ausschließen.
  **Hauptszenario**                  1\. Übersicht der zu korrigierenden Fälle 2. Fall auswählen,
                                     Prüfungsergebnis und Status betrachten, korrigieren, Status setzen 3.
                                     Abgeschlossen
  **Alternativszenarien**            Nutzer\*in kann Fehler nicht korrigieren und schließt Fall von Analysen aus.
  **Nachbedingungen**                Alle Parameter vollständig behandelt und korrigiert oder ausgeschlossen.
  ---------------------------------- ------------------------------------------------------------------------------

### Anforderungen

  ID       Beschreibung                                                         Typ
  -------- -------------------------------------------------------------------- -----
  N04.01   Status aller Fehlerbehandlungen pro Fall anzeigen.                   2
  N04.02   Status der Fehlerbehandlung für falschen Parameter anzeigen.         1
  N04.04   Parameter und Fälle dauerhaft von Analysen ausschließen.             2
  N04.05   Änderungsverläufe für einzelne Parameter anzeigen.                   1
  N04.06   Eingaben, Veränderungen, Löschungen mit Zeitstempel dokumentieren.   1

6.1.5 RE-EM-K05: Betrachtung der Untersuchungs- und Therapiemaßnahmen
---------------------------------------------------------------------

*User-Story: Als Nutzer\*in möchte ich einen Fall auswählen, die
Verlaufsdokumentation einsehen und mit Kohortenwerten vergleichen.*

  ---------------------------------- ------------------------------------------------------------------------------
  **Kurzbeschreibung**               Anzeige patientenspezifischer Untersuchungs- und Therapiemaßnahmen.
  **Nutzer\*in (Stakeholder-IDs)**   Forscher\*in (1), Epidemiolog\*in (3), Kliniker\*in (4)
  **Auslösendes Ereignis**           Nutzer\*in möchte Untersuchungs- und Therapiedaten eines Patienten einsehen.
  **Hauptszenario**                  1\. Fall aus Kohorte auswählen 2. Verlaufsdokumentation überblicken 3.
                                     Auffälligkeiten prüfen 4. Parameter mit aggregierten Kohortenwerten
                                     vergleichen 5. Abgeschlossen
  **Alternativszenarien**            /
  **Nachbedingungen**                Nutzer\*in konnte Patientendaten einsehen.
  ---------------------------------- ------------------------------------------------------------------------------

### Anforderungen

  ID       Beschreibung                                                   Typ
  -------- -------------------------------------------------------------- -----
  N05.01   Fälle anderer Zentren pseudonymisieren.                        1
  N05.02   Starke Abweichungen kennzeichnen.                              1
  N05.03   Fall aus Kohorte auswählen.                                    2
  N05.04   Zeitpunkte der Injektionen darstellen.                         1
  N05.05   Arzneimittel und Dosierung anzeigen.                           1
  N05.06   Augeninnendruck und Messmethode anzeigen.                      1
  N05.07   Visus, Art, Korrektur und Messmethode anzeigen.                1
  N05.08   Anamnese (ophthalmologisch/nicht-ophthalmologisch) anzeigen.   1
  N05.09   Refraktionswerte (Sphäre, Zylinder, Achse) anzeigen.           1
  N05.10   Informationen dem linken/rechten Auge zuordnen.                1
  N05.11   Durchgeführte Prozeduren anzeigen.                             1
  N05.12   IVOM-Behandlungsschema anzeigen.                               1
  N05.13   Behandlungsindikation anzeigen.                                1
  N05.14   Präparat inkl. Wirkstoff und Handelsname anzeigen.             1
  N05.15   Befunde vorderer/hinterer Augenabschnitt anzeigen.             1
  N05.16   Diabetesspezifische Werte (Typ, Dauer, HBA1c) anzeigen.        1
  N05.17   Verlaufsdokumentation anzeigen.                                1
  N05.18   Daten über zeitlichen Verlauf interpolieren.                   1
  N05.19   Interpolierte Daten kennzeichnen.                              1
  N05.20   Interpolierte Daten im Verlauf anzeigen.                       1
  N05.21   Therapieschema eines/mehrerer Patienten anzeigen.              1
  N05.22   Präparat-Wechsel im Verlauf anzeigen.                          1
  N05.23   Therapieverlauf mit aggregiertem Gruppenverlauf vergleichen.   2
  N05.24   Metrische Parameter im zeitlichen Verlauf anzeigen.            1
  N05.25   Zeitlichen Verlauf der Injektionsgabe anzeigen.                1
  N05.26   Absolute Messwerte eines Patienten darstellen.                 1
  N05.27   Relative Veränderungen zum Ausgangswert anzeigen.              1
  N05.28   Überschreitung kritischer Werte erkennen und anzeigen.         1
  N05.29   Adverse Events erkennen und anzeigen.                          1
  N05.30   Aggregierte Darstellung eines Patienten anzeigen.              1
  N05.31   Verteilung absoluter Messwerte eines Patienten.                1
  N05.32   Verteilung relativer Messwerte eines Patienten.                1
  N05.33   Anzahl Überschreitungen kritischer Werte anzeigen.             1
  N05.34   Anzahl Adverse Events anzeigen.                                1
  N05.35   Zusammenhänge zwischen Parametern anzeigen.                    1

6.1.6 RE-EM-K06: Kennzeichnung der Therapieabbrecher und Therapieunterbrecher
-----------------------------------------------------------------------------

*User-Story: Als Nutzer\*in möchte ich eine Kohorte von
Therapieunterbrechern/-abbrechern basierend auf Zeitkriterien auswählen
und analysieren.*

  ---------------------------------- ------------------------------------------------------------------------------
  **Kurzbeschreibung**               Kennzeichnung von Patienten als Therapieabbrecher oder Therapieunterbrecher.
  **Nutzer\*in (Stakeholder-IDs)**   Forscher\*in (1), Epidemiolog\*in (3), Kliniker\*in (4)
  **Auslösendes Ereignis**           Nutzer möchte Patienten als Therapieunterbrecher/-abbrecher kennzeichnen.
  **Hauptszenario**                  1\. Zeit t (Unterbrecher) und t\' (Abbrecher) definieren 2. System
                                     kennzeichnet Fälle 3. Nach Abbrechern/Unterbrechern filtern 4. Fall
                                     auswählen (s. K05)
  **Alternativszenarien**            /
  **Nachbedingungen**                Markierung gespeichert.
  ---------------------------------- ------------------------------------------------------------------------------

### Anforderungen

  ID       Beschreibung                                                Typ
  -------- ----------------------------------------------------------- -----
  N06.01   Zeit t als Kriterium für Therapieunterbrecher definieren.   2
  N06.02   Fälle als Therapieabbrecher/-unterbrecher kennzeichnen.     1
  N06.03   Nach Therapieabbrechern/-unterbrechern filtern.             1
  N06.04   Zeit t\' als Kriterium für Therapieabbrecher definieren.    2
  N06.05   Alle Therapieabbrecher/Therapieunterbrecher anzeigen.       1
  N06.06   Abbruch/Unterbrechung pro Fall eindeutig kennzeichnen.      1
  N06.07   Kriterium für Kennzeichnung eindeutig anzeigen.             1

6.1.7 RE-EM-K07: Benchmarking der Dokumentationsqualität
--------------------------------------------------------

*User-Story: Als Nutzer\*in möchte ich die Dokumentationsqualität der
verschiedenen Zentren innerhalb eines bestimmten Zeitraums einsehen.*

  ---------------------------------- --------------------------------------------------------------------------
  **Kurzbeschreibung**               Evaluation der Dokumentationsqualität unterschiedlicher Zentren.
  **Nutzer\*in (Stakeholder-IDs)**   Klinikleitung (6)
  **Auslösendes Ereignis**           Nutzer\*in möchte die Dokumentationsqualität prüfen.
  **Hauptszenario**                  1\. Prüfung starten 2. Zeitraum T definieren 3. Parameter definieren
                                     (Vollzähligkeit, Vollständigkeit, Plausibilität, SDV) 4. Übersicht aller
                                     Zentren 5. Zentrum auswählen 6. Ergebnisse betrachten
  **Alternativszenarien**            Nur eigenes Zentrum im Ranking, ohne andere Zentren zu nennen.
  **Nachbedingungen**                Nutzer\*in kennt die Dokumentationsqualität.
  ---------------------------------- --------------------------------------------------------------------------

### Anforderungen

  ID       Beschreibung                                            Typ
  -------- ------------------------------------------------------- -----
  N07.01   Zentrum auswählen.                                      2
  N07.02   Zeitraum für Evaluation auswählen.                      2
  N07.03   Dokumentationsqualität des Zentrums anzeigen.           1
  N07.04   Ergebnisse der SDV-Stichproben des Zentrums anzeigen.   1
  N07.05   Dokumentationsqualität aller Zentren anzeigen.          1
  N07.06   Aktualisierungsfrequenz jedes Zentrums anzeigen.        1

6.1.8 RE-EM-K08: Download eines Datensatzes
-------------------------------------------

*User-Story: Als Nutzer\*in möchte ich gefilterte Daten herunterladen,
um sie mit gängigen Programmen auszuwerten.*

  ---------------------------------- -----------------------------------------------------------------------
  **Kurzbeschreibung**               Nutzer\*in kann einen Datensatz für spätere Verwendung herunterladen.
  **Nutzer\*in (Stakeholder-IDs)**   Forscher\*in (1), Epidemiolog\*in (3), Kliniker\*in (4)
  **Auslösendes Ereignis**           Nutzer\*in möchte Kohorte exportieren und herunterladen.
  **Hauptszenario**                  1\. Datei herunterladen (Dateityp zu spezifizieren) 2. Abgeschlossen
  **Alternativszenarien**            /
  **Nachbedingungen**                Kohorte im System persistiert.
  ---------------------------------- -----------------------------------------------------------------------

### Anforderungen

  ID       Beschreibung                                                             Typ
  -------- ------------------------------------------------------------------------ -----
  N08.01   Datensatz für spätere Nutzung downloaden. Dateitypen zu spezifizieren.   2

6.1.9 RE-EM-K09: Anzeige der Suchhistorie
-----------------------------------------

*User-Story: Als Nutzer\*in möchte ich gefilterte Suchanfragen anzeigen
und wieder aktivieren lassen.*

  ---------------------------------- -----------------------------------------------------------------------
  **Kurzbeschreibung**               Suchhistorie anzeigen und Suche wieder aktivieren.
  **Nutzer\*in (Stakeholder-IDs)**   Forscher\*in (1), Epidemiolog\*in (3), Kliniker\*in (4)
  **Auslösendes Ereignis**           Nutzer\*in möchte spezielle Kohorte wieder auswählen.
  **Hauptszenario**                  1\. Suchanfragen überblicken (Datum, Name) 2. Nach Datum sortieren 3.
                                     Suchanfrage auswählen und neu ausführen 4. Abgeschlossen
  **Alternativszenarien**            /
  **Nachbedingungen**                Kohorte persistiert.
  ---------------------------------- -----------------------------------------------------------------------

### Anforderungen

  ID       Beschreibung                                                         Typ
  -------- -------------------------------------------------------------------- -----
  N09.01   Vorherige Suche auswählen.                                           2
  N09.02   Vorherige Suchen nach Datum oder Namen sortieren.                    2
  N09.03   Ausgewählte Suche neu ausführen.                                     2
  N09.04   Datensatz der vorherigen Suche in persistierter Version auswählen.   2

6.1.10 RE-EM-K10: Nutzer\*in hinzufügen
---------------------------------------

*User-Story: Als Nutzer\*in möchte ich Zugangsdaten für neue
Nutzer\*innen hinzufügen.*

  ---------------------------------- ----------------------------------------------------------------------
  **Kurzbeschreibung**               Neue Nutzer\*innen erhalten Rolle und Zugangsdaten.
  **Nutzer\*in (Stakeholder-IDs)**   IT-Administrator\*in (2)
  **Auslösendes Ereignis**           Neue Mitarbeiter\*innen oder initiale Einführung des Systems.
  **Hauptszenario**                  1\. Rolle definieren 2. Zentrum zuweisen 3. Anmeldename und Passwort
                                     erstellen 4. Daten speichern 5. Abgeschlossen
  **Alternativszenarien**            /
  **Nachbedingungen**                /
  ---------------------------------- ----------------------------------------------------------------------

### Anforderungen

  ID       Beschreibung                                                 Typ
  -------- ------------------------------------------------------------ -----
  N10.01   Rollen von Nutzer\*innen verwalten.                          2
  N10.02   Nutzer\*innen einem/mehreren Zentren zuweisen.               2
  N10.03   Anmeldenamen und Passwort einer neuen Nutzer\*in zuweisen.   2
  N10.04   Neue Nutzer\*in anlegen und speichern.                       2

6.1.11 RE-EM-K11: Informationen über Datengrundlage
---------------------------------------------------

*User-Story: Als Nutzer\*in möchte ich Informationen über die generelle
Datengrundlage erhalten.*

  ---------------------------------- ------------------------------------------------------------------------------------
  **Kurzbeschreibung**               Landing Page zeigt nach Start und Login an, welche Standorte welche Daten liefern.
  **Nutzer\*in (Stakeholder-IDs)**   Alle
  **Auslösendes Ereignis**           Start des Systems oder Navigation zur Landing Page.
  **Hauptszenario**                  1\. Landing Page wird automatisch angezeigt 2. Abgeschlossen
  **Alternativszenarien**            Nutzer\*in navigiert manuell zur Landing Page.
  **Nachbedingungen**                /
  ---------------------------------- ------------------------------------------------------------------------------------

### Anforderungen

  ID       Beschreibung                                                                                           Typ
  -------- ------------------------------------------------------------------------------------------------------ -----
  N11.01   Informationen zu angeschlossenen Zentren (Name, Standort, optional Ansprechperson) auf Landing Page.   1/2
  N11.02   Informationen zu behandelten/verfügbaren Patienten je Zentrum/Standort auf Landing Page.               1/2

6.2 Regulatorische Anforderungen
--------------------------------

*Kein Inhalt gefunden.*

6.3 Fachliche Anforderungen
---------------------------

*Kein Inhalt gefunden.*

6.4 Organisatorische Anforderungen
----------------------------------

*Kein Inhalt gefunden.*

6.5 Markt Anforderungen
-----------------------

*Kein Inhalt gefunden.*

7 Lieferumfang
==============

Software-Lieferung, keine Hardware. Hersteller liefert Software und
Informationen zur Handhabung.

7.1 Schulung
------------

Schulung nach Installation und beim Onboarding. Theoretische und
praktische Einweisung. Inhalte: Bedienung, Fehleingaben,
Störungsdokumentation. Geschult: Fachärzte, MTA/Pflege, MFA. Alle
Unterlagen in Deutsch.

8 Abnahmekriterien
==================

Damit das Produkt abgenommen werden kann, müssen die definierten
Kriterien erfüllt sein. \[Zu spezifizieren\]

9 Glossar
=========

*Das Glossar wird über die separate Seite RE-EM-G: Glossar
bereitgestellt (29 ophthalmologische Fachbegriffe).*

---

**Anmerkung v1.5 (Rosterkorrektur):** Der Software-Demonstrator EMD wurde ab v1.5 auf die sieben realen EyeMatics-Standorte beschränkt: UKA (Aachen), UKC (Chemnitz), UKD (Dresden), UKG (Greifswald), UKL (Leipzig), UKMZ (Mainz), UKT (Tübingen). Frühere Demo-Standorte (UKB Bonn, LMU München, UKM Münster) sind entfernt; historische Lastenheft-Passagen bleiben als Projektdokumentation unverändert.

**Anmerkung Phase 24 (FB-01):** UKM (Münster) wurde post-v1.8 wieder in das Roster aufgenommen; UKD (Dresden) und UKMZ (Mainz) wurden in Phase 24 auf Wunsch der Standorte entfernt. Aktuelles Roster: UKA, UKC, UKG, UKL, UKM, UKT (6 Standorte). Maßgeblich ist `data/centers.json`.
