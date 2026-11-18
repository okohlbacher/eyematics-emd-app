# Problem: Z0-P10 | Area: Kohortenanalyse | Severity: 4 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Kohortenauswahl · Duplikat lt. PL12 (Team): Z0-P04 · eigener Aspekt: alle Kennzahl-Tabs und Rohdaten der Verläufe
Feature: Z0-P10 Alle Kennzahlen der Verläufe verwenden die ausgewählte Kohorte

  Background:
    Given I am logged in as "klinikleitung"
    And in "Kohortenbildung" I have entered "70" in the "Alter" field "Min"
    And I have opened the cohort analysis for this filter
    And I open the tab "Verläufe"

  Scenario: Jeder Kennzahl-Tab zeigt die ausgewählte Kohorte
    When I open, one after another, the metric tabs "Visus", "CRT", "Behandlungsintervall" and "Responder"
    Then each of the "4" tabs shows the same number of patients as the "Kohortenanalyse" header
    And none of them shows the text "Keine Patient:innen in dieser Kohorte"

  Scenario: Rohdaten enthalten nur Fälle der ausgewählten Kohorte
    When I click "Rohdaten anzeigen"
    Then every pseudonym in the raw data table belongs to a case aged at least "70"
