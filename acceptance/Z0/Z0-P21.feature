# Problem: Z0-P21 | Area: Kohortenanalyse | Severity: 3 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Einzelfallauswahl
Feature: Z0-P21 Einzelverlauf durch Klick auf die Kurve öffnen

  Background:
    Given I am logged in as "klinikleitung"
    And a saved cohort "Testkohorte" exists
    And I open the cohort analysis for "Testkohorte"
    And I open the tab "Verläufe"
    And "Individuelle Kurven" is ticked in "Diagramm-Anzeige"

  Scenario: Klick auf die Linie zwischen zwei Messungen
    When I click a per-patient curve halfway between two of its measurement points
    Then the "Einzelfallansicht" of that patient opens
    And its header shows the pseudonym that the tooltip of that curve named after "Patient"

  Scenario: Kurve beim Überfahren hervorheben
    When I hover over a per-patient curve between two measurement points
    Then that curve is drawn wider than the other per-patient curves, by at least "1" px
    And the tooltip shows the pseudonym of that patient after "Patient"

  Scenario: Klick auf einen Messpunkt funktioniert weiterhin
    When I click a measurement point of a per-patient curve
    Then the "Einzelfallansicht" of that patient opens
