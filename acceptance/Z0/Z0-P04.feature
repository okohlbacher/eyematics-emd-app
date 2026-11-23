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

  # Added by NF on 2026-11-23 (drafted_by: ai-assisted) from the second /useavibe-release 0 browser pass on emd-smoke
  # built from 4b7b17e: Verläufe heading as decided in PLAN Q27 (Q43); a saved cohort loaded without changes keeps its
  # name (Q45, placed here to keep one problem per session).
  Scenario: Verläufe-Überschrift nennt die aktive Kohorte wie der Kopf
    Given a saved cohort "Testkohorte" exists
    When I open the cohort analysis for "Testkohorte"
    And I open the tab "Verläufe"
    Then the "Verläufe" heading reads "Testkohorte", the same text as after "Aktive Kohorte: " in the "Kohortenanalyse" header
    And the "Verläufe" heading does not contain "Outcomes"
    And the texts "Gespeicherte Kohorte" and "Ad-hoc-Filter" are not shown
    And with the UI language "English" the "Verläufe" heading reads "Testkohorte" and does not contain "Outcomes"

  Scenario: Verläufe-Überschrift einer gefilterten Kohorte und ohne Kohorte
    Given in "Kohortenbildung" I have entered "70" in the "Alter" field "Min"
    And I have opened the cohort analysis for this filter
    When I open the tab "Verläufe"
    Then the "Verläufe" heading starts with "Gefilterte Kohorte", the same text as after "Aktive Kohorte: " in the "Kohortenanalyse" header
    When I open "Analyse" from the navigation without choosing a cohort
    And I open the tab "Verläufe"
    Then the "Verläufe" heading reads "Alle Patienten"

  Scenario: Unverändert geladene gespeicherte Kohorte behält ihren Namen
    Given a saved cohort "Testkohorte" exists
    And in "Kohortenbildung" I have loaded "Testkohorte" without changing its filters
    When I click "Kohorte analysieren"
    Then the "Kohortenanalyse" header reads "Aktive Kohorte: Testkohorte"
    And after opening the tab "Verläufe" the "Verläufe" heading reads "Testkohorte"
    When in "Kohortenbildung" I load "Testkohorte", change one of its filters and click "Kohorte analysieren"
    Then the "Kohortenanalyse" header starts with "Aktive Kohorte: Gefilterte Kohorte"
