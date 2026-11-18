# Problem: Z0-P20 | Area: Kohortenanalyse | Severity: 4 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Einzelfallauswahl · Duplikat lt. PL12 (Team): Z0-P11 · eigener Aspekt: Klickbarkeit am Diagramm selbst erkennbar (Mouseover)
Feature: Z0-P20 Mouseover zeigt, dass ein Einzelfall geöffnet werden kann

  Background:
    Given I am logged in as "klinikleitung"
    And a saved cohort "Testkohorte" exists
    And I open the cohort analysis for "Testkohorte"
    And I open the tab "Verläufe"
    And "Individuelle Kurven" is ticked in "Diagramm-Anzeige"

  Scenario: Mouseover eines Einzelverlaufs nennt Pseudonym und Aktion
    When I hover over a measurement point of a per-patient curve
    Then the tooltip shows the pseudonym of that patient after "Patient"
    And the tooltip ends with "Klicken öffnet die Einzelfallansicht"

  Scenario: Zeiger zeigt Klickbarkeit
    When I hover over a measurement point of a per-patient curve
    Then the mouse cursor is "pointer"

  Scenario: Englische Oberfläche
    Given the UI language is "English"
    When I hover over a measurement point of a per-patient curve
    Then the tooltip ends with "Click to open the case view"
