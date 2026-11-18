# Problem: Z0-P11 | Area: Kohortenanalyse | Severity: 4 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Einzelfallauswahl
Feature: Z0-P11 Hilfe erklärt die Möglichkeiten des Verläufe-Tabs

  Background:
    Given I am logged in as "klinikleitung"
    And a saved cohort "Testkohorte" exists
    And I open the cohort analysis for "Testkohorte"
    And I open the tab "Verläufe"

  Scenario: Hilfe-Schaltfläche im Verläufe-Tab
    Then a button with the accessible name "Hilfe zu Verläufen" is visible next to "Diagramm-Anzeige"

  Scenario: Hilfe erklärt Einzelfallauswahl, Vergleich und Anzeige
    When I click "Hilfe zu Verläufen"
    Then a dialog "Hilfe zu Verläufen" opens
    And it explains how to open a single case and contains "Einzelfallansicht"
    And it contains "Kohorten vergleichen"
    And it contains "Diagramm-Anzeige"
    And it contains "Rohdaten anzeigen"

  Scenario: Hilfe schließen
    Given the dialog "Hilfe zu Verläufen" is open
    When I press "Escape"
    Then the dialog "Hilfe zu Verläufen" is closed
    And the focus returns to the button "Hilfe zu Verläufen"

  Scenario: Englische Oberfläche
    Given the UI language is "English"
    When I click "Help on trajectories"
    Then a dialog "Help on trajectories" opens
