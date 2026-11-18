# Problem: Z0-P22 | Area: Kohortenanalyse | Severity: 5 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Kohortenauswahl
Feature: Z0-P22 Einzelne Kohorte in der Kohortenanalyse wählen und überall übernehmen

  Background:
    Given I am logged in as "klinikleitung"
    And saved cohorts "Testkohorte" and "Vergleichskohorte" exist

  Scenario: Kohortenwahl im Kopf der Kohortenanalyse
    When I open "Analyse" from the navigation
    Then the header shows a selector "Kohorte wählen"
    And it lists "Alle Patienten", "Testkohorte" and "Vergleichskohorte"

  Scenario: Gewählte Kohorte gilt für Verläufe
    Given I open "Analyse" from the navigation
    When I choose "Testkohorte" in "Kohorte wählen"
    And I open the tab "Verläufe"
    Then the "Verläufe" heading contains "Testkohorte"
    And the "Verläufe" view shows the same number of patients as the "Kohortenanalyse" header

  Scenario: Wechsel in den Verläufen gilt auch für Aggregiert
    Given I open the cohort analysis for "Testkohorte"
    And I open the tab "Verläufe"
    When I choose "Vergleichskohorte" in "Kohorte wählen"
    And I open the tab "Aggregiert"
    Then the "Kohortenanalyse" header names "Vergleichskohorte"
    And the case count in the header equals the size of "Vergleichskohorte" shown in "Kohortenbildung"

  Scenario: Wechsel der Kohorte beendet einen laufenden Vergleich nicht
    Given I open the cohort analysis for "Testkohorte"
    And I open the tab "Verläufe"
    And I compare "Testkohorte" with "Alle Patienten"
    When I choose "Vergleichskohorte" in "Kohorte wählen"
    Then the legend contains "Vergleichskohorte" and "Alle Patienten"
    And the legend does not contain "Testkohorte"
