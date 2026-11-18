# Problem: Z0-P15 | Area: Einzelfallansicht (Case Detail) | Severity: 2 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Abbildungen
Feature: Z0-P15 Vollständiger Titel der Abbildung „Veränderung zum Ausgangswert“

  Background:
    Given I am logged in as "klinikleitung"
    And I open the "Einzelfallansicht" of any case with at least "2" visus measurements

  Scenario: Vollständiger Titel ohne Kohortenvergleich
    Then the second chart is titled "Veränderung von Visus und CRT zum Ausgangswert (erste Visite)"

  Scenario: Vollständiger Titel mit Kohortenvergleich
    When I tick "Kohorten-Referenz anzeigen"
    Then the second chart is titled "Veränderung von Visus und CRT zum Ausgangswert (erste Visite)"

  Scenario: Englische Oberfläche
    Given the UI language is "English"
    Then the second chart is titled "Change in visual acuity and CRT from baseline (first visit)"

  @visual
  Scenario: Legende und Achsenbeschriftung bleiben unverändert
    When I tick "Kohorten-Referenz anzeigen"
    Then legend entries and axis labels of the second chart are the same as before the change
