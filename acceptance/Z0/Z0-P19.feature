# Problem: Z0-P19 | Area: Kohortenanalyse | Severity: 3 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Einzelfallauswahl
Feature: Z0-P19 Einzelfälle über die Rohdaten der Verläufe auswählen

  Background:
    Given I am logged in as "klinikleitung"
    And a saved cohort "Testkohorte" exists
    And I open the cohort analysis for "Testkohorte"
    And I open the tab "Verläufe"
    And I click "Rohdaten anzeigen"

  Scenario: Pseudonyme in den Rohdaten sind Links
    Then each value in the column "Pseudonym" is a link

  Scenario: Einzelfallansicht aus den Rohdaten öffnen
    When I click the pseudonym in the first row of the raw data table
    Then the "Einzelfallansicht" of that case opens
    And its header shows the pseudonym from the column "Pseudonym" of that row

  Scenario: CSV-Export bleibt unverändert
    When I click "CSV exportieren"
    Then the exported file has the column "Pseudonym" as before
    And the column "Pseudonym" contains plain text without link markup such as "http"
