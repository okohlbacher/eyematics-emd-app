# Problem: Z0-P04 | Area: Kohortenanalyse | Severity: 4 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Kohortenauswahl
Feature: Z0-P04 Ausgewählte Kohorte wird in den Verläufen dargestellt

  Background:
    Given I am logged in as "klinikleitung"

  Scenario: Gefilterte, nicht gespeicherte Kohorte erscheint in Verläufe
    Given in "Kohortenbildung" I have entered "70" in the "Alter" field "Min"
    And I have opened the cohort analysis for this filter
    And the "Kohortenanalyse" header shows the cohort name "Gefilterte Kohorte" with a case count
    When I open the tab "Verläufe"
    Then the "Verläufe" heading names the same cohort as the "Kohortenanalyse" header
    And the "Verläufe" view shows the same number of cases as "Fälle in der aktuellen Kohorte"
    And the text "Keine Patient:innen in dieser Kohorte" is not shown

  Scenario: Gespeicherte Kohorte erscheint in Verläufe
    Given a saved cohort "Testkohorte" exists
    When I open the cohort analysis for "Testkohorte"
    And I open the tab "Verläufe"
    Then the "Verläufe" heading contains "Testkohorte"
    And the "Verläufe" view shows the same number of cases as "Fälle in der aktuellen Kohorte"

  Scenario: Kohorte bleibt beim Wechsel zwischen Aggregiert und Verläufe erhalten
    Given in "Kohortenbildung" I have entered "70" in the "Alter" field "Min"
    And I have opened the cohort analysis for this filter
    When I open the tab "Verläufe"
    And I open the tab "Aggregiert"
    And I open the tab "Verläufe"
    Then the "Kohortenanalyse" header still shows "Gefilterte Kohorte"
    And the "Verläufe" view shows the same number of cases as "Fälle in der aktuellen Kohorte"
