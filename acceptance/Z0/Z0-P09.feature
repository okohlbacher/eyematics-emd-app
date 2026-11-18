# Problem: Z0-P09 | Area: Kohortenanalyse | Severity: 4 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Einzelfallauswahl
Feature: Z0-P09 Fälle mit kritischen Werten aus der Kohortenanalyse öffnen

  Background:
    Given I am logged in as "klinikleitung"
    And a saved cohort "Testkohorte" exists that contains at least "1" case with a CRT above "400" µm
    And I open the cohort analysis for "Testkohorte"

  Scenario: Anzahl kritischer Fälle ist bedienbar
    Then the text "Fälle mit kritischen Werten (CRT > 400 µm)" is part of a button

  Scenario: Liste der kritischen Fälle
    When I click "Fälle mit kritischen Werten (CRT > 400 µm)"
    Then a list "Fälle mit kritischen Werten" opens
    And the list has as many entries as the number shown before "Fälle mit kritischen Werten (CRT > 400 µm)"
    And each entry shows the pseudonym and the highest CRT value in "µm"

  Scenario: Vollständige Fallansicht aus der Liste öffnen
    Given the list "Fälle mit kritischen Werten" is open
    When I click "Vollständige Fallansicht" in the first entry
    Then the "Einzelfallansicht" of that case opens
    And its header shows the pseudonym of the list entry next to "Pseudonym"

  Scenario: Zurück zur Kohortenanalyse
    Given I have opened a case from the list "Fälle mit kritischen Werten"
    When I click "Zurück"
    Then the "Kohortenanalyse" shows the cohort "Testkohorte" again
