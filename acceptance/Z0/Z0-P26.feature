# Problem: Z0-P26 | Area: Kohortenanalyse | Severity: 4 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Kohortenauswahl · Duplikat lt. PL12 (Team): Z0-P23; Z0-P05 · eigener Aspekt: Grundgesamtheit als Standardvergleich im Tab Aggregiert
Feature: Z0-P26 Grundgesamtheit als Standardvergleich in den aggregierten Daten

  Background:
    Given I am logged in as "klinikleitung"
    And a saved cohort "Testkohorte" exists
    And I open the cohort analysis for "Testkohorte"
    And the tab "Aggregiert" is open

  Scenario: Grundgesamtheit als erste Vergleichsoption
    When I click "Kohorten vergleichen"
    Then the drawer lists "Alle Patienten" as its first comparison option
    And the option "Alle Patienten" is selected

  Scenario: Vergleich mit der Grundgesamtheit
    When I click "Kohorten vergleichen"
    And I close the drawer
    Then the legend lists "Testkohorte" and "Alle Patienten" with their patient counts
    And the diagnosis chart shows "2" cohorts

  Scenario: Grundgesamtheit im Vergleich nutzt die Fälle aller berechtigten Standorte
    When I compare "Testkohorte" with "Alle Patienten"
    Then the patient count of "Alle Patienten" equals the patient count shown for "Alle Patienten" in the "Einzelfallansicht" selector "Vergleichskohorte wählen"

  # Added by NF on 2026-11-23 (drafted_by: ai-assisted) from the second /useavibe-release 0 browser pass on emd-smoke
  # built from 4b7b17e: the active cohort was hidden under "Alle Patienten" in the age-versus-visus chart (Q44 a:
  # series drawn in descending patient count, so subsets lie on top).
  @visual
  Scenario: Basis-Kohorte bleibt im Vergleich mit der Grundgesamtheit sichtbar
    When I compare "Testkohorte" with "Alle Patienten"
    Then in the age-versus-visus chart the points of "Testkohorte" are drawn on top of the points of "Alle Patienten"
    And the points of "Testkohorte" are visible in the colour of "Testkohorte" in the legend
