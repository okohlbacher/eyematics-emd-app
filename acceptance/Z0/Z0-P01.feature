# Problem: Z0-P01 | Area: Kohortenbildung (Cohort Builder) | Severity: 3 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Kohortenauswahl
Feature: Z0-P01 Altersfilter ohne automatisch eingetragene Obergrenze

  Background:
    Given I am logged in as "klinikleitung"
    And I open "Kohortenbildung"

  Scenario: Untergrenze trägt keine Obergrenze ein
    When I enter "70" in the "Alter" field "Min"
    Then the "Alter" field "Max" is empty
    And the "Alter" field "Max" does not contain "120"

  Scenario: Nur Untergrenze filtert ab der Untergrenze
    When I enter "70" in the "Alter" field "Min"
    And I leave the "Alter" field "Max" empty
    Then every case in the result list has an age of at least "70"
    And no validation message is shown at the "Alter" field

  Scenario: Eigene Obergrenze ohne vorheriges Löschen eingeben
    Given I have entered "70" in the "Alter" field "Min"
    When I type "85" into the "Alter" field "Max"
    Then the "Alter" field "Max" contains "85"
    And every case in the result list has an age between "70" and "85"

  Scenario: Nur Obergrenze filtert bis zur Obergrenze
    When I enter "60" in the "Alter" field "Max"
    Then the "Alter" field "Min" is empty
    And every case in the result list has an age of at most "60"
