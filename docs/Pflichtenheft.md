**Pflichtenheft**

EyeMatics Klinischer Demonstrator (EMD)

  ------------------------ -------------------------------------------
  **Dokumentstatus**       Gültig
  **Version**              1.4
  **Datum**                11.04.2026
  **Autoren**              Berger, Melina et al.
  **Projekt**              EyeMatics -- AP05 Klinischer Demonstrator
  **Zuständigkeit**        UKA / IMI Aachen
  **Prüfung / Freigabe**   \[ausstehend\]
  ------------------------ -------------------------------------------

*Dieses Dokument beschreibt die Anforderungen an den EyeMatics
Klinischen Demonstrator (EMD) sowie deren konkrete Umsetzung im Rahmen
des EyeMatics-Projekts.*

Revisionshistorie

  ------------- ------------ ------------ ---------------------------------
  **Version**   **Datum**    **Autor**    **Beschreibung**
  0.1           2025         Berger, M.   Erstversion
  0.9           07.04.2026   Berger, M.   Aktualisierung aller Abschnitte
  1.3           11.04.2026   Team         Full-Review: Sicherheit, Konsistenz, i18n
  1.4           11.04.2026   Team         Test Coverage Milestone, 221 Tests
  ------------- ------------ ------------ ---------------------------------

Inhaltsverzeichnis

1 Systemkontext und Abgrenzung

1.1 Ziel des EMD

Der EyeMatics Klinische Demonstrator (EMD) dient der explorativen
Analyse medizinischer Daten zur Unterstützung wissenschaftlicher
Fragestellungen im Bereich der Augenheilkunde. Im Rahmen des
EyeMatics-Projekts wird eine Infrastruktur aufgebaut, die über das MII
Data Sharing Framework (DSF) den standortübergreifenden Austausch von
Versorgungsdaten zwischen mehreren universitären Standorten ermöglicht.
Der Demonstrator nutzt diese Infrastruktur, um die bereitgestellten
Daten visuell zugänglich und analysierbar zu machen.

Ziel des Systems ist es, Forschenden die Möglichkeit zu bieten, auf
Basis strukturierter, standortübergreifend verfügbarer Daten Kohorten zu
bilden, Analysen durchzuführen und Hypothesen zu generieren.

Der Demonstrator unterstützt insbesondere:

-   die Durchführung von Qualitäts- und Plausibilitätsanalysen (z. B.
    Identifikation auffälliger Werte oder Verläufe),

-   die Vorbereitung von Studien (z. B. Machbarkeitsanalysen und
    Abschätzung von Fallzahlen),

-   sowie die Durchführung und Darstellung aggregierter Analysen.

1.2 Einordnung und Abgrenzung des Systems

Der EMD ist als Forschungstool konzipiert und nicht für den Einsatz in
der direkten Patientenversorgung vorgesehen. Die bereitgestellten
Funktionen dienen ausschließlich der Analyse und Interpretation
medizinischer Daten zu wissenschaftlichen Zwecken. Die im Demonstrator
dargestellten Ergebnisse haben keinen unmittelbaren Einfluss auf
diagnostische oder therapeutische Entscheidungen und dürfen nicht als
Grundlage für klinische Maßnahmen verwendet werden.

Der Demonstrator ist klar von klinischen Primärsystemen (z. B.
Krankenhausinformationssystemen) abgegrenzt. Insbesondere gilt:

-   Es erfolgt keine Eingabe, Änderung oder Löschung medizinischer
    Primärdaten.

-   Es besteht keine bidirektionale Integration mit Versorgungssystemen.

-   Ergebnisse und Analysen werden nicht in Primärsysteme zurückgeführt.

-   Der Zugriff auf Daten erfolgt ausschließlich lesend im Rahmen der
    Analyse.

1.3 Datenverarbeitung und Systemlogik

Der Demonstrator verarbeitet ausschließlich pseudonymisierte Daten, die
über das EyeMatics DSF Prozess Plugin bereitgestellt werden. Die Daten
basieren auf dem EyeMatics-Kerndatensatz und sind gemäß dem
HL7-FHIR-Standard strukturiert. Eine Reidentifikation von Patienten ist
nicht vorgesehen und wird durch das System nicht unterstützt.

Die zugrunde liegenden Daten werden regelmäßig, in der Regel täglich,
aktualisiert. Analysen und Kohorten basieren daher stets auf dem zum
jeweiligen Zeitpunkt verfügbaren Datenbestand. Ergebnisse können sich
bei erneuter Ausführung derselben Analyse aufgrund aktualisierter Daten
unterscheiden. Im System werden keine vollständigen persistierten Kopien
von Kohorten oder Datensätzen gespeichert. Stattdessen werden
Suchdefinitionen und Filterkriterien gespeichert, die bei Bedarf erneut
auf den aktuellen Datenbestand angewendet werden.

Diese Vorgehensweise dient der Vermeidung redundanter Datenspeicherung
und stellt sicher, dass Analysen stets auf dem aktuellsten verfügbaren
Datenstand basieren.

1.4 Entwicklungsvorgehen

Der EMD wird im Sinne eines Minimum Viable Product (MVP) entwickelt. Die
initiale Umsetzung fokussiert sich auf zentrale Kernfunktionen und wird
im Projektverlauf iterativ erweitert. Die Umsetzung der Anforderungen
erfolgt schrittweise in Abhängigkeit von der Verfügbarkeit und
fachlichen Definition der im EyeMatics-Kerndatensatz enthaltenen
Merkmale.

1.5 Systemüberblick

Der EMD ist in eine verteilte Systemlandschaft eingebettet, in der
medizinische Daten standortübergreifend ausgetauscht werden. Der EMD
selbst ist nicht am Datenaustausch beteiligt, sondern nutzt die über die
bestehende Infrastruktur bereitgestellten Daten für Analyse- und
Visualisierungszwecke. Der standortübergreifende Datenaustausch wird
durch das EyeMatics DSF Prozess Plugin realisiert, das auf dem DSF der
MII basiert. Über diese Infrastruktur werden pseudonymisierte Daten aus
den angebundenen DIZ zwischen den beteiligten Standorten übertragen. Die
ausgetauschten Daten werden in einem EMD Data Repository entsprechend
dem EyeMatics-Kerndatensatz auf Basis des FHIR-Standards gebündelt
bereitgestellt. Dieses Repository stellt die Datenquelle für den EMD
dar. Der Demonstrator greift ausschließlich lesend auf dieses Repository
zu und hat keinen direkten Zugriff auf klinische Primärsysteme oder
lokale Datenquellen. Der EMD wird standortbezogen betrieben, wobei jeder
Standort eine eigene Instanz des EMDs betreibt.

![](media/262597d481c7c08b7326881d2656171d4999d9b2.jpg){width="3.6666666666666665in"
height="2.6145833333333335in"}

*Abbildung 1: Datenfluss im EyeMatics-System*

Weitere Informationen zum EyeMatics DSF Prozess Plugin und dessen Ablauf
sind in der zugehörigen Projektdokumentation verfügbar (z. B. unter
https://github.com/prus-springsteen/eyematics-dsf-process-plugin). Diese
Informationen dienen ausschließlich dem besseren Verständnis der
Systemumgebung und sind nicht Bestandteil der im Pflichtenheft
beschriebenen Anforderungen.

2 Randbedingungen

2.1 Technische Rahmenbedingungen

Der Betrieb des Demonstrators erfolgt in einer verteilten Infrastruktur,
in der mehrere Standorte über ihre jeweiligen Datenintegrationszentren
(DIZ) angebunden sind. Die Bereitstellung der Daten ist vollständig an
die im Projekt eingesetzte Infrastruktur gebunden, insbesondere das
EyeMatics DSF Prozess Plugin und das EMD Data Repository. Der
Demonstrator ist darauf angewiesen, dass Daten über diese Schnittstellen
bereitgestellt werden. Die Struktur und Verfügbarkeit der Daten werden
durch den EyeMatics-Kerndatensatz sowie dessen Umsetzung auf Basis des
HL7-FHIR-Standards bestimmt. Ein direkter Zugriff auf klinische
Primärsysteme oder lokale Datenquellen ist nicht vorgesehen.

2.2 Datenbereitstellung

Die Verfügbarkeit der Daten im Demonstrator hängt vollständig von der
erfolgreichen Bereitstellung über das EyeMatics DSF Prozess Plugin sowie
die angebundenen DIZ ab. Es wird nicht garantiert, dass alle für die
Analyse relevanten Daten zu jedem Zeitpunkt vollständig oder konsistent
vorliegen.

Die Verfügbarkeit einzelner Attribute ist abhängig von:

-   der Definition im Kerndatensatz

-   der Implementierung in den angeschlossenen Systemen

-   sowie der erfolgreichen Datenbereitstellung.

2.3 Rechtliche und organisatorische Rahmenbedingungen

Die Nutzung der Daten erfolgt im Rahmen der geltenden rechtlichen und
organisatorischen Vorgaben, insbesondere im Kontext der
Forschungsnutzung.

Eine Weiterverwendung der Daten außerhalb des EMDs ist eingeschränkt.
Insbesondere kann ein vollständiger Export oder eine
standortübergreifende Nutzung exportierter Daten durch rechtliche
Rahmenbedingungen ausgeschlossen sein.

Die fachliche Freigabe von Nutzerkonten werden nicht durch den
Demonstrator unterstützt, sondern erfolgen außerhalb des Systems.

2.4 Rollenmodell und Zuständigkeiten

Der Demonstrator implementiert ein differenziertes 6-Rollen-Modell,
das den Stakeholder-Kategorien des Lastenhefts entspricht (siehe
Abschnitt 3.2.2 für Details). Jede Rolle definiert spezifische
Zugriffsrechte auf Funktionen und Daten. Die zentrenbasierte
Dateneinschränkung wird serverseitig erzwungen.

Die Verwaltung von Nutzerkonten erfolgt durch die administrative Rolle
(IT-Administrator), während fachliche Freigaben außerhalb des Systems
stattfinden.

3 Abgrenzung zum Lastenheft

Der Demonstrator dient zur prototypischen Umsetzung ausgewählter
Funktionen zur Analyse und Nutzung klinischer Daten. Folgende Aspekte
sind nicht Bestandteil des Demonstrators:

-   Betrieb als produktives klinisches System im Behandlungskontext

-   Integration in klinische Primärsysteme

-   Versionisierung oder Archivierung von Patientendaten

-   vollständige Implementierung aller im Lastenheft genannten
    Funktionen

-   umfassende Benutzerverwaltung außerhalb der definierten Rollen

3.1 Umgang mit Anforderungen aus dem Lastenheft

Das vorliegende Pflichtenheft konkretisiert die im Lastenheft
beschriebenen Anforderungen. Lastenheft siehe: RE-EM-LH: Lastenheft

Anforderungen des Lastenhefts werden im Pflichtenheft wie folgt
behandelt:

-   übernommen, wenn sie im Demonstrator vollständig umsetzbar sind

-   abweichend umgesetzt, wenn eine Anpassung aufgrund technischer,
    fachlicher oder rechtlicher Rahmenbedingungen erforderlich ist

-   nicht umgesetzt, wenn sie außerhalb der Systemgrenzen des EMDs
    liegen oder mit den zugrunde liegenden Randbedingungen nicht
    vereinbar sind

Die Nachvollziehbarkeit zum Lastenheft wird durch die Angabe der
jeweiligen Anforderungs-IDs sichergestellt.

Folgende Anforderungen des Lastenhefts werden im Rahmen des
Demonstrators nicht oder nur abweichend umgesetzt:

  ------------ ------------------------------------------------- ----------------- ---------------------------------------------------------------
  **LH-ID**    **Thema**                                         **Status**        **Begründung**
  N02.16 (1)   RE-EM-K02 -- Kohorte speichern                    abweichend        Nur Suchdefinition wird gespeichert, nicht das Ergebnis.
  N03.03       RE-EM-K03 -- Source-Data Verification             nicht umgesetzt   Setzt Zugriff auf identifizierbare Primärdaten voraus.
  N03.14       RE-EM-K03 -- Verantwortliche anzeigen (opt.)      nicht umgesetzt   Fachlich und datenschutzrechtlich nicht vorgesehen.
  N03.15       RE-EM-K03 -- Externe Bewertungen (opt.)           nicht umgesetzt   Außerhalb der Systemgrenze des EMDs.
  N03.16       RE-EM-K03 -- Mehrere externe Bewertungen (opt.)   nicht umgesetzt   Außerhalb der Systemgrenze des EMDs.
  N03.17       RE-EM-K03 -- Einsichten mit Zeitstempel (opt.)    abweichend        Protokollierung generalisiert umgesetzt.
  N03.18       RE-EM-K03 -- Datennutzungsprojekt (opt.)          nicht umgesetzt   Datennutzung außerhalb des EMD nicht vorgesehen.
  N04.05       RE-EM-K04 -- Änderungsverläufe anzeigen           nicht umgesetzt   Nicht sinnvoll bei nicht-manipulativer EMD-Nutzung.
  N04.06       RE-EM-K04 -- Eingaben/Löschungen dokumentieren    nicht umgesetzt   Keine Rückschreibung ins Primärsystem.
  N05.01       RE-EM-K05 -- Fälle pseudonymisieren               abweichend        Alle Daten sind pseudonym; Reidentifikation nicht vorgesehen.
  N07.04       RE-EM-K07 -- Benchmarking                         nicht umgesetzt   Setzt identifizierbare Primärdaten voraus.
  N07.06       RE-EM-K07 -- Aktualisierungsfrequenz              abweichend        Frequenz liegt nicht vor; stattdessen DSF-Datenaktualität.
  N08.01       RE-EM-K08 -- Datensatz downloaden                 abweichend        Rechtlich nicht abgedeckt durch FDPG-Datennutzungsantrag.
  N09.04       RE-EM-K09 -- Persistierte Suchergebnisse          abweichend        Nur Suchdefinition gespeichert, keine Datenduplikate.
  N11.02       RE-EM-K11 -- Behandelte Patienten je Zentrum      abweichend        Gesamtzahl wird nicht über DSF geliefert.
  ------------ ------------------------------------------------- ----------------- ---------------------------------------------------------------

3.2 Projektspezifische Festlegungen und Priorisierung (MVP)

3.2.1 Iteratives Vorgehen bei der Umsetzung

Die Umsetzung der funktionalen Anforderungen erfolgt iterativ und
orientiert sich an der schrittweisen Verfügbarkeit und fachlichen
Definition der im EyeMatics-Kerndatensatz enthaltenen Merkmale.

Im MVP werden zunächst ausgewählte, verfügbare Parameter unterstützt
(z. B. Visus, Netzhautdicke). Weitere Attribute werden im Projektverlauf
ergänzt.

3.2.2 Rollenmodell

Im Lastenheft werden verschiedene Stakeholder definiert (siehe RE-EM-S:
Stakeholder-Liste) und den jeweiligen Kernaufgaben zugeordnet. Im Rahmen
des Demonstrators wird ein differenziertes 6-Rollen-Modell umgesetzt,
das den Stakeholder-Kategorien des Lastenhefts entspricht:

1. **IT-Administrator (admin)** — Vollzugriff: Nutzerverwaltung, Systemkonfiguration, Audit-Log (alle Eintraege), FHIR-Proxy
2. **Forscher/in (researcher)** — Klinische Daten: Kohortenbildung, Analyse, Einzelfallansicht, Datenqualitaet
3. **Epidemiolog/in (epidemiologist)** — Wie Forscher/in, typischerweise mit Zugang zu mehreren Zentren
4. **Kliniker/in (clinician)** — Klinische Daten des eigenen Zentrums
5. **DIZ Data Manager (data_manager)** — Datenqualitaetspruefung und Dokumentationsqualitaet
6. **Klinikleitung (clinic_lead)** — Uebergreifender Zugang, Dokumentationsqualitaets-Benchmarking

Jeder Benutzer ist einem oder mehreren Zentren zugeordnet. Die
zentrenbasierte Dateneinschraenkung wird serverseitig erzwungen — Benutzer
sehen ausschliesslich Daten ihrer zugewiesenen Zentren.

4 Anforderungen

Die im Folgenden beschriebenen Anforderungen konkretisieren die im
Lastenheft definierten Anforderungen für den EMD. Dabei werden
ausschließlich Anforderungen berücksichtigt, die im Rahmen der
Systemgrenzen und Randbedingungen des Demonstrators umsetzbar sind. Eine
detaillierte Abgrenzung sowie die Behandlung nicht oder abweichend
umgesetzter Anforderungen sind in Kapitel 3 beschrieben.

Funktionale Anforderungen beziehen sich ausschließlich auf Daten,
Merkmale und Kennzeichnungen, die im EyeMatics-Kerndatensatz definiert
und über das EyeMatics DSF Prozess Plugin bereitgestellt werden.

Die Priorisierung der Anforderungen erfolgt nach der MoSCoW-Methode:

-   Must: zwingend erforderliche Anforderungen

-   Should: wichtige, aber nicht zwingend erforderliche Anforderungen

-   Could: optionale Anforderungen mit Mehrwert

-   Won't: im aktuellen Projektumfang nicht vorgesehen (siehe Kapitel 3)

4.1 Benutzer- und Zugriffsverwaltung

Die fachliche Freigabe von Nutzerkonten erfolgt standortintern durch die
Rolle „Fachlicher Administrator". Die Prüfung umfasst insbesondere die
Berechtigung zur Nutzung des Demonstrators. Die Freigabe erfolgt
außerhalb des Systems gemäß lokalen organisatorischen Prozessen (z. B.
per E-Mail). Das System selbst unterstützt diesen Freigabeprozess nicht
technisch.

EMDREQ-USM-001: Einrichtung von Nutzerkonten (Must)

  --------------------------- ------------------------------
  **Requirements ID**         EMDREQ-USM-001
  **Name**                    Einrichtung von Nutzerkonten
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K10 (N10.01--N10.04)
  --------------------------- ------------------------------

Das System muss der Rolle „Technischer Administrator" die Möglichkeit
bieten, neue Nutzerkonten anzulegen. Dabei müssen dem Nutzerkonto
mindestens eine Rolle, ein oder mehrere zugeordnete Standorte sowie eine
eindeutige Benutzerkennung zugewiesen werden.

EMDREQ-USM-002: Entzug von Nutzerkonten (Must)

  --------------------------- -------------------------
  **Requirements ID**         EMDREQ-USM-002
  **Name**                    Entzug von Nutzerkonten
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   ---
  --------------------------- -------------------------

Das System muss der Rolle „Technischer Administrator" die Möglichkeit
bieten, Nutzerkonten bei Wegfall der Berechtigung zu deaktivieren oder
zu löschen.

EMDREQ-USM-003: Eindeutige Benutzerkennung (Must)

  --------------------------- ----------------------------
  **Requirements ID**         EMDREQ-USM-003
  **Name**                    Eindeutige Benutzerkennung
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K10 (N10.03)
  --------------------------- ----------------------------

Das System muss jedem Nutzerkonto eine eindeutige Benutzerkennung
zuweisen.

EMDREQ-USM-004: Autorisierung (Must)

  --------------------------- ----------------------------
  **Requirements ID**         EMDREQ-USM-004
  **Name**                    Autorisierung
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K10 (N10.01, N10.02)
  --------------------------- ----------------------------

Das System muss die Zuweisung von Rollen und zugeordneten Standorten zu
Nutzerkonten ermöglichen. Zugriffsrechte müssen auf Basis dieser Rollen-
und Standortzuordnungen geprüft und beschränkt werden.

EMDREQ-USM-005: Authentisierung (Must)

  --------------------------- ------------------------------------
  **Requirements ID**         EMDREQ-USM-005
  **Name**                    Authentisierung
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K01 (N01.01--N01.05, N01.09)
  --------------------------- ------------------------------------

Das System muss Nutzern die Anmeldung über eine
Zwei-Faktor-Authentisierung (2-FA) ermöglichen. Die Authentisierung
erfolgt über Benutzerkennung und Passwort sowie einen zusätzlichen
Authentisierungsfaktor (z. B. OTP).

EMDREQ-USM-006: Behandlung fehlerhafter Anmeldeversuche (Must)

  --------------------------- -----------------------------------------
  **Requirements ID**         EMDREQ-USM-006
  **Name**                    Behandlung fehlerhafter Anmeldeversuche
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K01 (N01.06--N01.08)
  --------------------------- -----------------------------------------

Das System muss bei fehlerhaften Authentisierungsdaten eine
Fehlermeldung anzeigen und die erneute Eingabe ermöglichen. Die Anzahl
aufeinanderfolgender fehlerhafter Anmeldeversuche sollte aus
Sicherheitsgründen begrenzbar sein.

EMDREQ-USM-007: Aktive Abmeldung (Must)

  --------------------------- --------------------
  **Requirements ID**         EMDREQ-USM-007
  **Name**                    Aktive Abmeldung
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K01 (N01.10)
  --------------------------- --------------------

Das System muss angemeldeten Nutzern die Möglichkeit bieten, sich aktiv
vom System abzumelden.

EMDREQ-USM-008: Automatische Abmeldung bei Inaktivität (Must)

  --------------------------- ----------------------------------------
  **Requirements ID**         EMDREQ-USM-008
  **Name**                    Automatische Abmeldung bei Inaktivität
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K01 (N01.11)
  --------------------------- ----------------------------------------

Das System muss angemeldete Nutzer nach einer konfigurierbaren Zeit ohne
Aktivität automatisch abmelden und die Abmeldung kenntlich machen.

4.2 Systemstart und Informationen zur Datengrundlage

EMDREQ-DAT-001: Landing Page nach Systemstart (Must)

  --------------------------- -------------------------------
  **Requirements ID**         EMDREQ-DAT-001
  **Name**                    Landing Page nach Systemstart
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K11 (N11.01, N11.02)
  --------------------------- -------------------------------

Das System muss nach erfolgreicher Anmeldung eine Landing Page anzeigen,
auf der allgemeine Informationen zur Datengrundlage des Demonstrators
bereitgestellt werden. Die Landing Page muss zusätzlich über die
Navigation des Systems aufrufbar sein.

EMDREQ-DAT-002: Anzeige angeschlossener Zentren und Standorte (Must)

  --------------------------- -----------------------------------------------
  **Requirements ID**         EMDREQ-DAT-002
  **Name**                    Anzeige angeschlossener Zentren und Standorte
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K11 (N11.01)
  --------------------------- -----------------------------------------------

Das System muss auf der Landing Page Informationen zu angeschlossenen
Zentren und Standorten anzeigen. Angezeigt werden müssen mindestens der
Name des Zentrums sowie der zugehörige Standort.

EMDREQ-DAT-003: Anzeige der verfügbaren Datengrundlage je Zentrum (Must)

  --------------------------- ---------------------------------------------------
  **Requirements ID**         EMDREQ-DAT-003
  **Name**                    Anzeige der verfügbaren Datengrundlage je Zentrum
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K11 (N11.02, abgewandelt)
  --------------------------- ---------------------------------------------------

Das System muss zentrums- bzw. standortbezogene Informationen zur
verfügbaren Datengrundlage anzeigen. Sofern Informationen zur Gesamtzahl
behandelter Patienten bereitgestellt werden, sollen diese ebenfalls
angezeigt werden.

EMDREQ-DAT-004: Anzeige des Aktualitätsstands (Must)

  --------------------------- ---------------------------------
  **Requirements ID**         EMDREQ-DAT-004
  **Name**                    Anzeige des Aktualitätsstands
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K07 (N07.06, abgewandelt)
  --------------------------- ---------------------------------

Das System muss den Aktualitätsstand der Datengrundlage durch Angabe der
letzten erfolgreichen Datenbereitstellung durch das DSF kenntlich
machen.

4.3 Kohortenbildung

EMDREQ-KOH-001: Filterparameter konfigurieren (Must)

  --------------------------- -------------------------------
  **Requirements ID**         EMDREQ-KOH-001
  **Name**                    Filterparameter konfigurieren
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K02 (N02.01)
  --------------------------- -------------------------------

Das System muss die für die Kohortenbildung verfügbaren Filterparameter
konfigurierbar bereitstellen. Als Filterparameter dürfen ausschließlich
Merkmale verwendet werden, die im EyeMatics-Kerndatensatz vorhanden und
verfügbar sind.

EMDREQ-KOH-002: Definition von Filterkriterien für Kohorten (Must)

  --------------------------- ---------------------------------------------
  **Requirements ID**         EMDREQ-KOH-002
  **Name**                    Definition von Filterkriterien für Kohorten
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K02 (N02.02, N02.04, N02.05)
  --------------------------- ---------------------------------------------

Das System muss Nutzern die Möglichkeit bieten, Filterkriterien für die
Bildung einer Kohorte zu definieren. Für numerische oder zeitlich
geordnete Merkmale soll das System Bereichsfilter unterstützen. Für
kategoriale Merkmale soll das System Mehrfachauswahlen unterstützen.

EMDREQ-KOH-003: Filterung und Anzeige von Kohorten und Subkohorten
(Must)

  --------------------------- ----------------------------------------------------
  **Requirements ID**         EMDREQ-KOH-003
  **Name**                    Filterung und Anzeige von Kohorten und Subkohorten
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K02 (N02.03, N02.06, N02.15)
  --------------------------- ----------------------------------------------------

Das System muss Nutzern die Möglichkeit bieten, auf Basis definierter
Filterkriterien Kohorten und Subkohorten zu bilden, weiter zu
unterteilen und die entsprechenden Fälle anzuzeigen.

EMDREQ-KOH-004: Speichern von Suchdefinitionen (Must)

  --------------------------- ---------------------------------
  **Requirements ID**         EMDREQ-KOH-004
  **Name**                    Speichern von Suchdefinitionen
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K02 (N02.16, abgewandelt)
  --------------------------- ---------------------------------

Das System muss Nutzern die Möglichkeit bieten, eine Suchdefinition
einschließlich Filterkriterien und eines frei vergebenen Namens zu
speichern. Hinweis: Es wird nur die Suche gespeichert, nicht das
Ergebnis.

EMDREQ-KOH-005: Anzeige und Sortierung gespeicherter Suchdefinitionen
(Must)

  --------------------------- -------------------------------------------------------
  **Requirements ID**         EMDREQ-KOH-005
  **Name**                    Anzeige und Sortierung gespeicherter Suchdefinitionen
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K09 (N09.01, N09.02)
  --------------------------- -------------------------------------------------------

Das System muss Nutzern die Möglichkeit bieten, gespeicherte
Suchdefinitionen anzuzeigen, auszuwählen und nach Name oder Datum zu
sortieren.

EMDREQ-KOH-006: Erneute Ausführung gespeicherter Suchdefinitionen (Must)

  --------------------------- ---------------------------------------------------
  **Requirements ID**         EMDREQ-KOH-006
  **Name**                    Erneute Ausführung gespeicherter Suchdefinitionen
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K09 (N09.03)
  --------------------------- ---------------------------------------------------

Das System muss Nutzern die Möglichkeit bieten, eine gespeicherte
Suchdefinition erneut auf der aktuellen Datengrundlage auszuführen.

EMDREQ-KOH-007: Export von Kohorten (Could)

  --------------------------- ---------------------
  **Requirements ID**         EMDREQ-KOH-007
  **Name**                    Export von Kohorten
  **MoSCoW (Priorität)**      Could
  **Herkunft (Lastenheft)**   RE-EM-K08 (N08.01)
  --------------------------- ---------------------

Das System könnte Nutzern die Möglichkeit bieten, Kohorten zu
exportieren. Dabei sollen nur Daten des eigenen Standorts in pseudonymer
Form zur Verfügung stehen.

4.4 Kohortenanalyse und Visualisierung

*Einschränkung: Funktionale Anforderungen beziehen sich ausschließlich
auf Daten, Merkmale und Kennzeichnungen, die im EyeMatics-Kerndatensatz
definiert und über das EyeMatics DSF Prozess Plugin bereitgestellt
werden.*

EMDREQ-ANL-001: Verteilung von Fällen über Zentren (Must)

  --------------------------- ------------------------------------
  **Requirements ID**         EMDREQ-ANL-001
  **Name**                    Verteilung von Fällen über Zentren
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K02 (N02.07)
  --------------------------- ------------------------------------

Das System muss die Verteilung der einer Kohorte zugeordneten Fälle über
Zentren aggregiert anzeigen können. Die Darstellung erfolgt entsprechend
der im Projekt abgestimmten Datenschutz- und Darstellungsvorgaben.

EMDREQ-ANL-002: Zeitliche Verlaufsdarstellung (Must)

  --------------------------- -------------------------------
  **Requirements ID**         EMDREQ-ANL-002
  **Name**                    Zeitliche Verlaufsdarstellung
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K02 (N02.08, N02.09)
  --------------------------- -------------------------------

Das System muss Messwerte und andere metrische Parameter von Kohorten
und Subkohorten im zeitlichen Verlauf anzeigen können. Für Subkohorten
soll eine Vergleichsdarstellung unterstützt werden.

EMDREQ-ANL-003: Darstellung von Verteilungen metrischer Parameter (Must)

  --------------------------- ---------------------------------------------------
  **Requirements ID**         EMDREQ-ANL-003
  **Name**                    Darstellung von Verteilungen metrischer Parameter
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K02 (N02.10--N02.13)
  --------------------------- ---------------------------------------------------

Das System muss die Verteilung metrischer Parameter aggregiert anzeigen
können. Dies gilt für absolute und relative Werte. Für Subkohorten soll
eine Vergleichsdarstellung unterstützt werden.

EMDREQ-ANL-004: Fälle mit kritischen Werten / Adverse Events (Must)

  --------------------------- ----------------------------------------------
  **Requirements ID**         EMDREQ-ANL-004
  **Name**                    Fälle mit kritischen Werten / Adverse Events
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K02 (N02.14)
  --------------------------- ----------------------------------------------

Das System muss die Anzahl der Fälle innerhalb einer Kohorte anzeigen
können, bei denen kritische Werte überschritten wurden oder Adverse
Events vorliegen. Voraussetzung: Definitionen im Kerndatensatz.

4.5 Einzelfallanalyse und Verlaufsdarstellung

*Einschränkung: Funktionale Anforderungen beziehen sich ausschließlich
auf Daten, Merkmale und Kennzeichnungen, die im EyeMatics-Kerndatensatz
definiert und über das EyeMatics DSF Prozess Plugin bereitgestellt
werden.*

EMDREQ-FALL-001: Auswahl eines Falls aus einer Kohorte (Must)

  --------------------------- ---------------------------------------
  **Requirements ID**         EMDREQ-FALL-001
  **Name**                    Auswahl eines Falls aus einer Kohorte
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K05 (N05.03/N03.07)
  --------------------------- ---------------------------------------

Das System muss Nutzern die Möglichkeit bieten, einen einzelnen Fall aus
einer Kohorte auszuwählen und zur detaillierten Analyse anzuzeigen.

EMDREQ-FALL-002: Anzeige pseudonymisierter Falldaten (Must)

  --------------------------- -------------------------------------
  **Requirements ID**         EMDREQ-FALL-002
  **Name**                    Anzeige pseudonymisierter Falldaten
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K05 (N05.01, abgewandelt)
  --------------------------- -------------------------------------

Das System muss die zu einem ausgewählten Fall gehörenden Daten in
pseudonymisierter Form anzeigen.

EMDREQ-FALL-003: Darstellung von Verlaufsdaten eines Falls (Must)

  --------------------------- ----------------------------------------------------
  **Requirements ID**         EMDREQ-FALL-003
  **Name**                    Darstellung von Verlaufsdaten eines Falls
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K05 (N05.17--N05.20, N05.24, N05.25, N05.35)
  --------------------------- ----------------------------------------------------

Das System muss zeitliche Verläufe von Messwerten, Untersuchungen und
Behandlungsereignissen eines Falls darstellen können.

EMDREQ-FALL-004: Anzeige relevanter Parameter und Ereignisse (Must)

  --------------------------- ---------------------------------------------
  **Requirements ID**         EMDREQ-FALL-004
  **Name**                    Anzeige relevanter Parameter und Ereignisse
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K05 (N05.04--N05.16, N05.21--N05.32)
  --------------------------- ---------------------------------------------

Das System muss relevante medizinische Parameter und Ereignisse
strukturiert anzeigen: einzelne Messwerte, daraus abgeleitete Werte
sowie zusammenfassende Darstellungen.

EMDREQ-FALL-005: Kennzeichnung auffälliger Werte im Einzelfall (Should)

  --------------------------- -----------------------------------------------
  **Requirements ID**         EMDREQ-FALL-005
  **Name**                    Kennzeichnung auffälliger Werte im Einzelfall
  **MoSCoW (Priorität)**      Should
  **Herkunft (Lastenheft)**   RE-EM-K05 (N05.02, N05.28--N05.34)
  --------------------------- -----------------------------------------------

Das System sollte kritische Werte, Adverse Events und starke
Abweichungen kennzeichnen können, sofern entsprechende Kriterien
definiert sind.

EMDREQ-FALL-006: Vergleich eines Falls mit Kohortenwerten (Must)

  --------------------------- ------------------------------------------
  **Requirements ID**         EMDREQ-FALL-006
  **Name**                    Vergleich eines Falls mit Kohortenwerten
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K05 (N05.23)
  --------------------------- ------------------------------------------

Das System muss die Werte eines einzelnen Patienten im Vergleich zu
aggregierten Kohortenwerten darstellen können.

4.6 Kennzeichnung, Datenqualitätsbewertung und spezielle Analysemerkmale

EMDREQ-QUAL-001: Definition zu prüfender Parameter (Must)

  --------------------------- -----------------------------------
  **Requirements ID**         EMDREQ-QUAL-001
  **Name**                    Definition zu prüfender Parameter
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K03 (N03.01)
  --------------------------- -----------------------------------

Das System muss Nutzern die Möglichkeit bieten, für eine ausgewählte
Subkohorte die zu prüfenden Parameter festzulegen.

EMDREQ-QUAL-002: Anzeige des Prüfstatus von Fällen (Must)

  --------------------------- -----------------------------------
  **Requirements ID**         EMDREQ-QUAL-002
  **Name**                    Anzeige des Prüfstatus von Fällen
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K03 (N03.02, N03.11)
  --------------------------- -----------------------------------

Das System muss den Prüfstatus der Fälle einer Subkohorte anzeigen
können; ungeprüfte, unvollständige und abgeschlossene Prüfungen müssen
unterscheidbar sein.

EMDREQ-QUAL-003: Auswahl eines Falls zur Prüfung (Must)

  --------------------------- ---------------------------------
  **Requirements ID**         EMDREQ-QUAL-003
  **Name**                    Auswahl eines Falls zur Prüfung
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K03 (N03.07)
  --------------------------- ---------------------------------

Das System muss Nutzern die Möglichkeit bieten, einen Fall aus einer
Subkohorte zur Prüfung auszuwählen.

EMDREQ-QUAL-004: Anzeige zu prüfender Werte und auffälliger Daten (Must)

  --------------------------- --------------------------------------------------
  **Requirements ID**         EMDREQ-QUAL-004
  **Name**                    Anzeige zu prüfender Werte und auffälliger Daten
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K03 (N03.05, N03.06, N03.08, N03.09)
  --------------------------- --------------------------------------------------

Das System muss für einen zur Prüfung ausgewählten Fall die zu prüfenden
Werte anzeigen sowie fehlende oder auffällige Werte kennzeichnen können.

EMDREQ-QUAL-005: Kennzeichnung von Fehlern (Must)

  --------------------------- ----------------------------
  **Requirements ID**         EMDREQ-QUAL-005
  **Name**                    Kennzeichnung von Fehlern
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K03 (N03.10, N03.13)
  --------------------------- ----------------------------

Das System muss Nutzern die Möglichkeit bieten, für zu prüfende
Parameter einen Fehler zu kennzeichnen und die Art des Fehlers
zuzuordnen.

EMDREQ-QUAL-006: Anzeige von Prüfergebnissen (Must)

  --------------------------- -----------------------------
  **Requirements ID**         EMDREQ-QUAL-006
  **Name**                    Anzeige von Prüfergebnissen
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K03 (N03.11, N03.12)
  --------------------------- -----------------------------

Das System muss die Ergebnisse abgeschlossener Prüfungen sowohl pro Fall
als auch pro Parameter anzeigen können.

EMDREQ-QUAL-007: Anzeige des Status der Fehlerbehandlung (Must)

  --------------------------- -----------------------------------------
  **Requirements ID**         EMDREQ-QUAL-007
  **Name**                    Anzeige des Status der Fehlerbehandlung
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K04 (N04.01, N04.02)
  --------------------------- -----------------------------------------

Das System muss den Status der Fehlerbehandlung pro Fall sowie für
fehlerhaft gekennzeichnete Parameter anzeigen können. Bezieht sich auf
Kennzeichnung im Demonstrator, nicht auf Korrektur im Primärsystem.

EMDREQ-QUAL-008: Ausschluss aus Analysen (Must)

  --------------------------- -------------------------
  **Requirements ID**         EMDREQ-QUAL-008
  **Name**                    Ausschluss aus Analysen
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K04 (N04.04)
  --------------------------- -------------------------

Das System muss Nutzern die Möglichkeit bieten, Fälle oder Parameter auf
Analyseebene von weiteren Auswertungen auszuschließen.

EMDREQ-QUAL-009: Kennzeichnung von Therapieabbruch/-unterbrechung (Must)

  --------------------------- --------------------------------------------------
  **Requirements ID**         EMDREQ-QUAL-009
  **Name**                    Kennzeichnung von Therapieabbruch/-unterbrechung
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K06 (N06.01--N06.07)
  --------------------------- --------------------------------------------------

Das System muss Therapieabbruch und -unterbrechung auf Basis vom Nutzer
definierter Zeitkriterien kennzeichnen und das zugrunde liegende
Kriterium anzeigen können.

EMDREQ-QUAL-010: Filterung therapiebezogener Kennzeichnungen (Must)

  --------------------------- ---------------------------------------------
  **Requirements ID**         EMDREQ-QUAL-010
  **Name**                    Filterung therapiebezogener Kennzeichnungen
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K06 (N06.03, N06.05)
  --------------------------- ---------------------------------------------

Das System muss Nutzern die Möglichkeit bieten, nach Therapieabbrechern
und Therapieunterbrechern zu filtern und diese anzuzeigen.

EMDREQ-QUAL-011: Aggregierte Datenqualitätsbewertung (Should)

  --------------------------- --------------------------------------------
  **Requirements ID**         EMDREQ-QUAL-011
  **Name**                    Aggregierte Datenqualitätsbewertung
  **MoSCoW (Priorität)**      Should
  **Herkunft (Lastenheft)**   RE-EM-K07 (N07.01--N07.03, N07.05, N07.06)
  --------------------------- --------------------------------------------

Das System sollte Kennzahlen zur Datenqualität für auswählbare Zentren
und Zeiträume aggregiert anzeigen können. Bewertung auf verfügbare
Qualitätsmerkmale begrenzt.

4.7 Protokollierung

EMDREQ-PROT-001: Protokollierung von Zugriffen auf Datensätze (Must)

  --------------------------- ----------------------------------------------
  **Requirements ID**         EMDREQ-PROT-001
  **Name**                    Protokollierung von Zugriffen auf Datensätze
  **MoSCoW (Priorität)**      Must
  **Herkunft (Lastenheft)**   RE-EM-K03 (N03.17)
  --------------------------- ----------------------------------------------

Das System muss Zugriffe auf Datensätze und deren Einsicht
protokollieren. Die Protokollierung muss mindestens Zeitstempel und
Nutzerkontext enthalten. Die Protokollierung dient der
Nachvollziehbarkeit und Auditierbarkeit der Nutzung des Demonstrators.

5 Ergänzende Ausführungen

5.1 Kohortenanalysen -- Abhängige und unabhängige Parameter

-   Unabhängige Parameter: Risikofaktoren, Exposition, angewandte
    Therapieschemata -- Abhängigkeiten dazwischen untersuchen, im
    zeitlichen Verlauf darstellen

-   Abhängige Parameter (Outcome-Parameter): Visus (Sehstärke),
    Netzhautdicke -- darzustellen im zeitlichen Verlauf und in
    Abhängigkeit zu den durchgeführten Eingriffen (Injektionen)

Zu untersuchen: Abhängigkeiten zwischen den unabhängigen und abhängigen
Parametern, zwischen Gruppen unterschiedliche Darstellung

5.2 Rollen und Rechte

Diese Rollen sollten an jedem EyeMatics Rollout Standort vertreten sein:

  --------------------------- -------------------------------------------------------------------------------------- -----------------------------------------------------------------------------------------------
  **Rolle**                   **Aufgabenbeschreibung**                                                               **Rechte**
  Technischer Administrator   Installation, Wartung und Updates, Monitoring, Nutzermanagement (Anlegen der Nutzer)   Technischer Zugriff auf Demonstrator-Infrastruktur
  Fachlicher Administrator    Nutzermanagement (Freigabe von Nutzern)                                                Standortinterne Lösung für Freigabe, z. B. per E-Mail
  Forscher                    Datensätze abrufen, Analysen durchführen                                               Zugriff auf Benutzungsoberfläche des klinischen Demonstrators (pseudonyme medizinische Daten)
  --------------------------- -------------------------------------------------------------------------------------- -----------------------------------------------------------------------------------------------

Berechtigungskonzept im EMD (6-Rollen-Modell, Stand v1.4):

  ----------------------------- --------------------------------- --------------------------------- --------------------------- ---------------------------
  **Rolle**                     **Klinische Daten**               **Dokumentationsqualitaet**       **Nutzer-Administration**   **System-Administration**
  IT-Administrator (admin)      ja (alle Zentren)                 ja                                ja                          ja
  Forscher/in (researcher)      ja (zugewiesene Zentren)          nein                              nein                        nein
  Epidemiolog/in                ja (zugewiesene Zentren)          nein                              nein                        nein
  Kliniker/in (clinician)       ja (zugewiesene Zentren)          nein                              nein                        nein
  DIZ Data Manager              ja (zugewiesene Zentren)          ja                                nein                        nein
  Klinikleitung (clinic_lead)   ja (zugewiesene Zentren)          ja                                nein                        nein
  ----------------------------- --------------------------------- --------------------------------- --------------------------- ---------------------------

Zentrenbasierte Einschraenkung: Jede Rolle (ausser admin) sieht nur Daten der zugewiesenen Zentren. Die Filterung erfolgt serverseitig im JWT-Payload.
