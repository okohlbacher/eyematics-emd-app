# Problem: Z0-P02 | Area: Kohortenbildung (Cohort Builder) | Severity: 3 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Kohortenauswahl
Feature: Z0-P02 Gespeicherte Kohorten erkennbar laden

  Background:
    Given I am logged in as "klinikleitung"
    And a saved cohort "Testkohorte" exists with the "Alter" filter "Min" "70"
    And I open "Kohortenbildung"

  Scenario: Schaltfläche der gespeicherten Suchen erklärt sich selbst
    When I hover over the button "Gespeicherte Suchen"
    Then a tooltip reads "Gespeicherte Kohorten anzeigen und laden"

  Scenario: Lade-Schaltfläche nennt Aktion und Kohorte
    When I open "Gespeicherte Suchen"
    Then the row "Testkohorte" has a button with the accessible name "Kohorte „Testkohorte“ laden"
    And hovering that button shows the tooltip "Kohorte „Testkohorte“ laden"
    And no button in the row "Testkohorte" is labelled only "Ausführen"

  Scenario: Laden ersetzt die aktuellen Filter durch die gespeicherten
    Given I have entered "50" in the "Alter" field "Min"
    When I open "Gespeicherte Suchen"
    And I load the cohort "Testkohorte"
    Then the "Alter" field "Min" contains "70"
    And the page shows the loaded cohort name "Testkohorte"

  Scenario: Englische Oberfläche
    Given the UI language is "English"
    When I hover over the button "Saved Searches"
    Then a tooltip reads "Show and load saved cohorts"
