# Problem: Z0-P13 | Area: Kohortenanalyse | Severity: 4 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Einzelfallauswahl · Duplikat lt. PL12 (Team): Z0-P11 · eigener Aspekt: sichtbarer Bedienhinweis am Diagramm
Feature: Z0-P13 Sichtbarer Hinweis zur Einzelfallauswahl in den Verläufen

  Background:
    Given I am logged in as "klinikleitung"
    And a saved cohort "Testkohorte" exists
    And I open the cohort analysis for "Testkohorte"
    And I open the tab "Verläufe"

  Scenario: Hinweis ohne Interaktion sichtbar
    Given "Individuelle Kurven" is ticked in "Diagramm-Anzeige"
    Then the text "Klicken Sie auf eine Kurve oder einen Messpunkt, um die Einzelfallansicht zu öffnen." is visible directly above the chart

  Scenario: Hinweis bei ausgeblendeten Einzelverläufen
    Given "Individuelle Kurven" and "Streupunkte" are unticked in "Diagramm-Anzeige"
    Then the hint reads "Blenden Sie unter „Diagramm-Anzeige“ individuelle Kurven ein, um einzelne Fälle zu öffnen."

  Scenario: Englische Oberfläche
    Given the UI language is "English"
    And "Per-patient curves" is ticked in "Chart display"
    Then the text "Click a curve or a measurement point to open the case view." is visible directly above the chart
