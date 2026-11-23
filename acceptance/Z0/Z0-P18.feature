# Problem: Z0-P18 | Area: Datenqualität (Quality Review) | Severity: 4 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Einzelfallauswahl · Duplikat lt. PL12 (Team): Z0-P14 · eigener Aspekt: Einzelfallansicht seitenübergreifend erreichbar (UP09 „Dashboard übergreifend“)
Feature: Z0-P18 Einzelfallansicht von jeder Seite aus öffnen

  Background:
    Given I am logged in as "klinikleitung"

  Scenario: Fallsuche in der Navigation
    When I open, one after another, "Startseite", "Kohortenbildung", "Analyse" and "Datenqualität"
    Then each of the "4" pages shows the search field "Fall öffnen (Pseudonym)" in the navigation

  Scenario: Fall über die Navigation öffnen
    Given I am on "Analyse"
    When I type the first "8" characters of an existing pseudonym into "Fall öffnen (Pseudonym)"
    And I choose that pseudonym from the suggestions
    Then the "Einzelfallansicht" of that case opens

  Scenario: Nur berechtigte Fälle werden vorgeschlagen
    Given I am logged in as a user restricted to "1" site
    When I type the first "8" characters of a pseudonym of another site into "Fall öffnen (Pseudonym)"
    Then the suggestion list shows "Kein Fall gefunden"
