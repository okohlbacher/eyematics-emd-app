# Problem: Z0-P07 | Area: Kohortenanalyse | Severity: 3 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Abbildungen
Feature: Z0-P07 Streuband-Schalter wirkt auch im Kohortenvergleich

  Background:
    Given I am logged in as "klinikleitung"
    And saved cohorts "Testkohorte" and "Vergleichskohorte" exist
    And I open the cohort analysis for "Testkohorte"
    And I open the tab "Verläufe"
    And I compare "Testkohorte" with "Vergleichskohorte"
    And I open the metric tab "CRT"

  Scenario: Streuband im Vergleich ausblenden
    Given "Streuband (IQR)" is ticked
    When I untick "Streuband (IQR)" in "Diagramm-Anzeige"
    Then each chart panel shows "0" IQR bands

  Scenario: Streuband im Vergleich einblenden
    Given "Streuband (IQR)" is unticked
    When I tick "Streuband (IQR)" in "Diagramm-Anzeige"
    Then each chart panel shows "2" IQR bands, one per cohort
    And each band has the legend colour of its cohort "Testkohorte" or "Vergleichskohorte"

  Scenario: Einzelne Kohorte unverändert
    Given I click "Einzelne Kohorte anzeigen"
    When I untick "Streuband (IQR)" in "Diagramm-Anzeige"
    Then each chart panel shows "0" IQR bands
    And after ticking "Streuband (IQR)" each chart panel shows "1" IQR band
