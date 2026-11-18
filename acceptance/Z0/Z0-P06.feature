# Problem: Z0-P06 | Area: Kohortenanalyse | Severity: 3 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Abbildungen
Feature: Z0-P06 Diagramm-Einstellungen der Verläufe bleiben in der Sitzung erhalten

  Background:
    Given I am logged in as "klinikleitung"
    And saved cohorts "Testkohorte" and "Vergleichskohorte" exist
    And I open the cohort analysis for "Testkohorte"
    And I open the tab "Verläufe"
    And in "Diagramm-Anzeige" I set the x-axis to "Anzahl Behandlungen"
    And in "Diagramm-Anzeige" I untick "Streuband (IQR)"

  Scenario: Einstellungen überstehen den Wechsel zur Kohortenbildung
    When I open "Kohortenbildung"
    And I return to the tab "Verläufe" of the cohort analysis for "Testkohorte"
    Then "Diagramm-Anzeige" shows the x-axis "Anzahl Behandlungen" selected
    And "Streuband (IQR)" is unticked

  Scenario: Einstellungen gelten auch für eine neu gewählte Kohorte
    When I open "Kohortenbildung"
    And I open the cohort analysis for "Vergleichskohorte"
    And I open the tab "Verläufe"
    Then "Diagramm-Anzeige" shows the x-axis "Anzahl Behandlungen" selected
    And "Streuband (IQR)" is unticked

  Scenario: Einstellungen überstehen den Wechsel zum Tab Aggregiert
    When I open the tab "Aggregiert"
    And I open the tab "Verläufe"
    Then "Diagramm-Anzeige" shows the x-axis "Anzahl Behandlungen" selected
    And "Streuband (IQR)" is unticked
