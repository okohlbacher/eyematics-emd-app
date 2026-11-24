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

  # Added by NF on 2026-11-24 (drafted_by: ai-assisted) from the third /useavibe-release 0 browser pass on emd-smoke
  # built from 4fc84aa: the info icon covers the end of the y-axis title (D8, Q52).
  Scenario: Infosymbol verdeckt den Y-Achsentitel nicht
    When I open each metric tab "Visus" and "CRT" with each y-axis setting "Absolut", "Δ" and "Δ %" in "Diagramm-Anzeige"
    Then in every chart card the info icon "Erläuterung der Y-Achse" stays at the upper end of the y-axis
    And the info icon "Erläuterung der Y-Achse" overlaps neither the y-axis title, nor the y-axis tick labels, nor the plot area
    And the y-axis title, e.g. "Visus-Veränderung zum Ausgangswert (logMAR)", is drawn in full inside its chart card, including the closing ")"
    And the same holds with the UI language "English"
