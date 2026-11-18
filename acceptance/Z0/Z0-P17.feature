# Problem: Z0-P17 | Area: Kohortenanalyse | Severity: 4 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Kohortenauswahl
Feature: Z0-P17 Jederzeit erkennbar, welche Kohorte ausgewählt ist

  Background:
    Given I am logged in as "klinikleitung"
    And saved cohorts "Testkohorte" and "Vergleichskohorte" exist

  Scenario: Aktive Kohorte im Kopf beider Tabs
    When I open the cohort analysis for "Testkohorte"
    Then the "Kohortenanalyse" header reads "Aktive Kohorte: Testkohorte"
    And after opening the tab "Verläufe" the header still reads "Aktive Kohorte: Testkohorte"

  Scenario: Gefilterte Kohorte wird ebenso benannt
    Given in "Kohortenbildung" I have entered "70" in the "Alter" field "Min"
    When I open the cohort analysis for this filter
    Then the "Kohortenanalyse" header starts with "Aktive Kohorte: Gefilterte Kohorte"

  Scenario: Vergleich wird im Kopf benannt
    Given I open the cohort analysis for "Testkohorte"
    When I compare "Testkohorte" with "Vergleichskohorte"
    Then the "Kohortenanalyse" header reads "Aktive Kohorte: Testkohorte · verglichen mit: Vergleichskohorte"

  Scenario: Keine Kohorte ausgewählt
    When I open "Analyse" from the navigation without choosing a cohort
    Then the header reads "Aktive Kohorte: Alle Patienten"
