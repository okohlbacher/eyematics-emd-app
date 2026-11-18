# Problem: Z0-P03 | Area: Kohortenanalyse | Severity: 3 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Abbildungen
Feature: Z0-P03 Selbsterklärende Y-Achse der Verläufe

  Background:
    Given I am logged in as "klinikleitung"
    And a saved cohort "Testkohorte" exists
    And I open the cohort analysis for "Testkohorte"
    And I open the tab "Verläufe"
    And I open the metric tab "CRT"

  Scenario: Veränderungsdarstellung CRT nennt Größe, Bezug und Einheit
    Given the y-axis shows the change from baseline in µm
    Then the y-axis title reads "CRT-Veränderung zum Ausgangswert (µm)"

  Scenario: Prozentuale Veränderung CRT
    When I set the y-axis to the percentage change in "Diagramm-Anzeige"
    Then the y-axis title reads "CRT-Veränderung zum Ausgangswert (%)"

  Scenario: Absolutwerte CRT
    When I set the y-axis to absolute values in "Diagramm-Anzeige"
    Then the y-axis title reads "Netzhautdicke (µm)"

  Scenario: Veränderungsdarstellung Visus
    When I open the metric tab "Visus"
    Then the y-axis title reads "Visus-Veränderung zum Ausgangswert (logMAR)"

  Scenario: Erklärung per Mouseover an der Y-Achse
    When I hover over the info icon next to the y-axis title
    Then a tooltip contains "Ausgangswert"
    And the tooltip contains "erste Messung"

  Scenario: Englische Oberfläche
    Given the UI language is "English"
    Then the y-axis title reads "CRT change from baseline (µm)"
