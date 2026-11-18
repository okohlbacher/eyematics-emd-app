# Problem: Z0-P05 | Area: Kohortenanalyse | Severity: 4 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Kohortenauswahl
Feature: Z0-P05 Grundgesamtheit als Standard im Kohortenvergleich der Verläufe

  Background:
    Given I am logged in as "klinikleitung"
    And a saved cohort "Testkohorte" exists
    And I open the cohort analysis for "Testkohorte"
    And I open the tab "Verläufe"

  Scenario: Grundgesamtheit ist ohne eigene Kohortenbildung wählbar
    When I click "Kohorten vergleichen"
    Then the drawer "Kohorten vergleichen" lists "Alle Patienten" as its first comparison option
    And the option "Alle Patienten" shows the number of patients of all accessible cases

  Scenario: Grundgesamtheit ist beim ersten Öffnen vorausgewählt
    When I click "Kohorten vergleichen"
    Then the option "Alle Patienten" is selected
    And the view shows "2 Kohorten verglichen"
    And the legend contains "Testkohorte" and "Alle Patienten"

  Scenario: Grundgesamtheit lässt sich wieder abwählen
    Given I have opened "Kohorten vergleichen"
    When I deselect "Alle Patienten"
    Then the option "Alle Patienten" is not selected
    And the text "2 Kohorten verglichen" is not shown

  Scenario: Gleiche Bezeichnung wie in der Einzelfallansicht
    Given the UI language is "English"
    When I click "Compare cohorts"
    Then the drawer lists "All patients" as its first comparison option
