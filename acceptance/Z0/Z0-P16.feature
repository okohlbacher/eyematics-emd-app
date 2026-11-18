# Problem: Z0-P16 | Area: Datenqualität (Quality Review) | Severity: 2 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Kohortenauswahl
Feature: Z0-P16 Filter der Datenqualität an einer Stelle

  Background:
    Given I am logged in as "klinikleitung"
    And I open "Datenqualität"

  Scenario: Alle Filter in einem Filterbereich
    Then one region labelled "Filterkriterien" contains the controls "Zeitraum", "Prüfstatus", "Therapiestatus", "CRT-Wert" and the search field "Pseudonym suchen..."
    And no filter control of the case list is placed outside the region "Filterkriterien"

  Scenario: Kohortenauswahl bleibt eine einzelne Schaltfläche
    Then exactly "1" control labelled "Kohorte" is shown
    And it is placed directly next to the region "Filterkriterien"

  Scenario: Filter wirken weiterhin
    Given a saved cohort "Testkohorte" exists
    When I choose "Testkohorte" in "Kohorte"
    And I choose "Therapieunterbrecher" in "Therapiestatus"
    Then every case in the case list carries the badge "UB"
