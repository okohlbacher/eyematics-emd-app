# Problem: Z0-P08 | Area: Kohortenanalyse | Severity: 4 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Abbildungen
Feature: Z0-P08 Mouseover der Verläufe wie in der Einzelfallansicht

  Background:
    Given I am logged in as "klinikleitung"
    And saved cohorts "Testkohorte" and "Vergleichskohorte" exist
    And I open the cohort analysis for "Testkohorte"
    And I open the tab "Verläufe"
    And I compare "Testkohorte" with "Vergleichskohorte"
    And I open the metric tab "CRT"
    And in "Diagramm-Anzeige" I set the x-axis to "Anzahl Behandlungen"

  Scenario: Kopfzeile des Mouseovers nennt Achse und x-Wert
    When I hover over the median point at x = 5 of "Testkohorte"
    Then the tooltip heading reads "Anzahl Behandlungen: 5"

  Scenario: Zeilen des Mouseovers sind beschriftet und der Kohorte zugeordnet
    When I hover over the median point at x = 5 of "Testkohorte"
    Then the tooltip has a row starting with "Testkohorte · Median"
    And that row shows a value with the unit "µm"
    And the row "Testkohorte · Median" has the legend colour of "Testkohorte"

  Scenario: Exakter Messpunkt bei ganzzahliger Behandlungsanzahl
    When I hover over the chart at x = 5
    Then a median point of "Testkohorte" is highlighted at exactly x = "5"
    And no median point of "Testkohorte" lies between x = "4" and x = "5"

  Scenario: Zeitachse im Mouseover
    Given in "Diagramm-Anzeige" I set the x-axis to "Tage seit Baseline"
    When I hover over any median point of "Testkohorte"
    Then the tooltip heading starts with "Tage seit Baseline:"

  @visual
  Scenario: Hervorhebung des Messpunkts wie in der Einzelfallansicht
    When I hover over a median point of "Testkohorte"
    Then the hovered point is visibly enlarged like the active point in the "Einzelfallansicht"
    And the tooltip uses the same box layout as the tooltip of the "Einzelfallansicht"
