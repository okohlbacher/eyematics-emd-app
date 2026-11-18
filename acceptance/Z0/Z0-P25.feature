# Problem: Z0-P25 | Area: Datenqualität (Quality Review) | Severity: 2 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Abbildungen
Feature: Z0-P25 Unterschiedliche Farben für Therapiestatus und auffällige/kritische Werte

  Background:
    Given I am logged in as "klinikleitung"
    And I open "Datenqualität"

  Scenario: Therapiestatus-Kennzeichen nutzen eine eigene Farbfamilie
    Given the case list shows a case with the badge "AB" and a case with the badge "UB"
    Then the background colours of "AB" and "UB" differ from the colours used for "auffällig" and for "Kritisch"
    And "AB" and "UB" differ from each other

  Scenario: Kennzeichen sind auch ohne Farbe unterscheidbar
    Then the badge "AB" has the tooltip or accessible name "Therapieabbrecher"
    And the badge "UB" has the tooltip or accessible name "Therapieunterbrecher"

  @visual
  Scenario: Kein Verwechseln neben Werten
    When I select a case with the badge "UB" that also has an anomalous value
    Then the therapy status badge and the value status "auffällig" are clearly different colours in the case panel
