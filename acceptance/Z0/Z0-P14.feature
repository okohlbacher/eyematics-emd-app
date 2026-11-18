# Problem: Z0-P14 | Area: Datenqualität (Quality Review) | Severity: 4 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Einzelfallauswahl
Feature: Z0-P14 Einzelfallansicht und Kohortenvergleich aus der Datenqualität auffindbar

  Background:
    Given I am logged in as "klinikleitung"
    And I open "Datenqualität"
    And I select the first case in the case list

  Scenario: Einzelfallansicht als deutliche Schaltfläche
    Then the case panel shows a button "Vollständige Fallansicht" in its header row next to the pseudonym
    And the button has the tooltip "Einzelfallansicht mit Verläufen und Vergleich mit einer Kohorte öffnen"

  Scenario: Hinweis auf den Kohortenvergleich
    Then the case panel shows the text "In der vollständigen Fallansicht können Sie diesen Fall mit einer Kohorte vergleichen."

  Scenario: Einzelfallansicht öffnen
    When I click "Vollständige Fallansicht"
    Then the "Einzelfallansicht" of the selected case opens
    And it shows the selector "Vergleichskohorte wählen"
