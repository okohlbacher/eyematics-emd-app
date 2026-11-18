# Problem: Z0-P12 | Area: Kohortenanalyse | Severity: 4 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Einzelfallauswahl · Duplikat lt. PL12 (Team): Z0-P09 · eigener Aspekt: kritische Fälle in den Verläufen hervorheben (P09 Vorschlag 1)
Feature: Z0-P12 Fälle mit kritischen Werten in den Verläufen hervorheben

  Background:
    Given I am logged in as "klinikleitung"
    And a saved cohort "Testkohorte" exists that contains at least "1" case with a CRT above "400" µm
    And I open the cohort analysis for "Testkohorte"
    And I open the tab "Verläufe"
    And I open the metric tab "CRT"

  Scenario: Option zum Hervorheben
    When I open "Diagramm-Anzeige"
    Then a checkbox "Fälle mit kritischen Werten hervorheben" is shown
    And "Fälle mit kritischen Werten hervorheben" is unticked by default

  Scenario: Kritische Fälle werden hervorgehoben
    When I tick "Fälle mit kritischen Werten hervorheben" in "Diagramm-Anzeige"
    Then the chart shows as many highlighted per-patient curves as the number before "Fälle mit kritischen Werten (CRT > 400 µm)"
    And the legend contains "Fälle mit kritischen Werten"

  Scenario: Hervorgehobenen Fall öffnen
    Given "Fälle mit kritischen Werten hervorheben" is ticked
    When I click a measurement point of a highlighted curve
    Then the "Einzelfallansicht" of that patient opens
    And its CRT chart contains a value above "400" µm
