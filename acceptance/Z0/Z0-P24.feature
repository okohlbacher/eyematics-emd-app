# Problem: Z0-P24 | Area: Datenqualität (Quality Review) | Severity: 2 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Einzelfallauswahl
Feature: Z0-P24 Erklärung von Bestätigen und Ausschließen in der Datenqualität

  Background:
    Given I am logged in as "klinikleitung"
    And I open "Datenqualität"
    And I select the first case in the case list

  Scenario: Bestätigen erklärt Wirkung und Geltungsbereich
    When I hover over the first button "Bestätigen"
    Then a tooltip contains "Markiert diesen Messwert als geprüft und korrekt"
    And the tooltip contains "gilt nur für Ihr Benutzerkonto"
    And the tooltip contains "Die Daten im Quellsystem werden nicht verändert"

  Scenario: Ausschließen erklärt Wirkung und Geltungsbereich
    When I hover over the button "Von Analysen ausschließen"
    Then a tooltip contains "Dieser Fall wird in Ihren Kohortenanalysen nicht mehr berücksichtigt"
    And the tooltip contains "gilt nur für Ihr Benutzerkonto"
    And the tooltip contains "rückgängig"

  Scenario: Erklärung per Tastatur erreichbar
    When I move the keyboard focus to the button "Von Analysen ausschließen"
    Then the same explanation is shown or announced as accessible description containing "gilt nur für Ihr Benutzerkonto"

  Scenario: Englische Oberfläche
    Given the UI language is "English"
    When I hover over the button "Exclude from analyses"
    Then a tooltip contains "applies to your user account only"
