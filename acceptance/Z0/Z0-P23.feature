# Problem: Z0-P23 | Area: Kohortenanalyse | Severity: 2 | Source: PROBLEMS.md
# Written by: NF on 2026-11-18 | drafted_by: ai-assisted | Supersedes: — | Related earlier scenarios: —
# Thema: Abbildungen · Umfang lt. Studienteam (NF, 2026-11-18): Kohortenvergleich im Tab Aggregiert; einheitliches Erscheinungsbild der Diagramme und der Kohorten-Vergleichsauswahl in Aggregiert, Verläufe und Einzelfallansicht
# Vorgabe (Team, NF 2026-11-18): Alle Diagramme der Analyse-Tabs (Aggregiert, Verläufe, Einzelfallansicht) mit derselben Bibliothek wie die Einzelfallansicht (Recharts), für ein einheitliches Erscheinungsbild.
Feature: Z0-P23 Kohortenvergleich im Tab Aggregiert und einheitliche Abbildungen

  Background:
    Given I am logged in as "klinikleitung"
    And saved cohorts "Testkohorte" and "Vergleichskohorte" exist
    And I open the cohort analysis for "Testkohorte"

  Scenario: Vergleich im Tab Aggregiert starten
    Given the tab "Aggregiert" is open
    Then a button "Kohorten vergleichen" is shown in the same position as on the tab "Verläufe"
    When I click "Kohorten vergleichen"
    Then the drawer "Kohorten vergleichen" opens with "Testkohorte" marked "Basis-Kohorte (fest)"

  Scenario: Aggregierte Abbildungen zeigen den Vergleich
    Given the tab "Aggregiert" is open
    When I compare "Testkohorte" with "Vergleichskohorte"
    Then the legend lists "Testkohorte" and "Vergleichskohorte" with their patient counts
    And the diagnosis chart shows "2" cohorts
    And the age-versus-visus chart shows "2" series named "Testkohorte" and "Vergleichskohorte"

  Scenario: Vergleich zurücksetzen im Tab Aggregiert
    Given the tab "Aggregiert" shows the comparison of "Testkohorte" with "Vergleichskohorte"
    When I click "Einzelne Kohorte anzeigen"
    Then the legend "Vergleichskohorte" is not shown
    And the charts show only "Testkohorte"

  Scenario: Vergleichsauswahl gilt für beide Tabs
    Given the tab "Aggregiert" is open
    When I compare "Testkohorte" with "Vergleichskohorte"
    And I open the tab "Verläufe"
    Then the view shows "2 Kohorten verglichen"
    And after returning to the tab "Aggregiert" the legend still lists "Vergleichskohorte"

  Scenario: Gleiche Kohortenfarben in Aggregiert und Verläufe
    Given I compare "Testkohorte" with "Vergleichskohorte"
    Then the legend colour of "Testkohorte" on "Aggregiert" equals its legend colour on "Verläufe"
    And the legend colour of "Vergleichskohorte" on "Aggregiert" equals its legend colour on "Verläufe"

  Scenario: Gleiche Achsenbeschriftung in Verläufe und Einzelfallansicht
    Given I open the tab "Verläufe" with the metric tab "Visus" and the y-axis set to absolute values
    And I open the "Einzelfallansicht" of a case of "Testkohorte"
    Then both views label the visus axis "Visus (logMAR)"
    And both views label the CRT axis "Netzhautdicke (µm)"

  Scenario: Gleiche Bezeichnung des Kohorten-Medians in Verläufe und Einzelfallansicht
    Given I open the tab "Verläufe" with the metric tab "CRT"
    And I open the "Einzelfallansicht" of a case of "Testkohorte" with "Kohorten-Referenz anzeigen" ticked
    Then the median line is named "Kohorten-Median CRT" in both views

  Scenario: Gleiches Mouseover-Format in Aggregiert, Verläufe und Einzelfallansicht
    When I hover over a data point in the age-versus-visus chart on "Aggregiert", a median point on "Verläufe" and a visus point in the "Einzelfallansicht"
    Then each tooltip has "1" heading line with the x-axis value
    And each value row has the form "<Bezeichnung>: <Wert>"

  Scenario: Gleiche Kohortenauswahl in Aggregiert, Verläufe und Einzelfallansicht
    When I open the comparison selection on "Aggregiert", on "Verläufe" and in the "Einzelfallansicht" of a case of "Testkohorte"
    Then each is opened by a button labelled "Kohorten vergleichen"
    And each lists "Alle Patienten" as its first option
    And each option reads "<Kohortenname> (N=<Anzahl> Patient:innen)"
    And the options are sorted the same way in all "3" views

  Scenario: Einzelfallansicht nutzt dieselbe Auswahl mit genau einer Vergleichskohorte
    Given I open the "Einzelfallansicht" of a case of "Testkohorte"
    When I click "Kohorten vergleichen"
    Then the same selection panel as on "Verläufe" opens
    And it allows exactly "1" comparison cohort at a time
    And it lists only cohorts that contain this case, plus "Alle Patienten"

  @visual
  Scenario: Einheitliches Erscheinungsbild der Kohortenauswahl
    When I compare the comparison selection on "Aggregiert", "Verläufe" and in the "Einzelfallansicht"
    Then panel layout, checkbox or radio style, colour swatches and the hint text look the same in all three views

  Scenario: Verläufe bleiben bei großen Kohorten bedienbar
    Given I open the cohort analysis without choosing a cohort, so that it shows "Alle Patienten"
    And I open the tab "Verläufe" with the metric tab "Visus"
    And "Individuelle Kurven" is ticked in "Diagramm-Anzeige"
    When I untick "Streuband (IQR)" in "Diagramm-Anzeige"
    Then the chart shows the new state at most "2" s after the click
    And after ticking "Streuband (IQR)" again the chart shows the new state at most "2" s after the click

  @visual
  Scenario: Einheitliches Erscheinungsbild der Diagramme
    When I compare the chart cards on "Aggregiert", "Verläufe" and in the "Einzelfallansicht"
    Then card frame, title style, grid lines, axis font and tooltip box look the same in all three views
    And the same quantity uses the same colour in all three views

  # Added by NF on 2026-11-23 (drafted_by: ai-assisted) from the /useavibe-release 0 browser pass on emd-smoke built
  # from c6edd3b: regressions of the Recharts migration in Verläufe (D1–D3) and the number format across the three
  # views (D4, decision: decimal comma in German everywhere, decimal point in English).
  Scenario: Achsenbeschriftungen der Verläufe zeigen gerundete Werte
    Given I open the tab "Verläufe" with the metric tab "CRT" and the y-metric "Δ (µm zur Baseline)"
    And I open the metric tab "Visus" afterwards
    Then on both metric tabs every x-axis tick label of "Tage seit Baseline" is a whole number
    And every y-axis tick label is a multiple of "1", "2", "2.5" or "5" times a power of ten
    And no tick label shows more than "2" decimal places

  @visual
  Scenario: Kurven bleiben innerhalb der Diagrammfläche
    Given I open the tab "Verläufe" with the metric tab "CRT"
    And "Individuelle Kurven" is ticked in "Diagramm-Anzeige"
    Then no curve, point or band of any chart card is drawn outside the plot area of that card

  Scenario: Einheitliches Zahlenformat in Aggregiert, Verläufe und Einzelfallansicht
    Given the UI language is "Deutsch"
    When I hover over a data point in the age-versus-visus chart on "Aggregiert", a median point on "Verläufe" and a visus point in the "Einzelfallansicht"
    Then every decimal number in the tooltips and axis tick labels uses a decimal comma, e.g. "0,5" and not "0.5"
    And with the UI language "English" every decimal number uses a decimal point, e.g. "0.5"

  # Added by NF on 2026-11-23 (drafted_by: ai-assisted) after the second /useavibe-release 0 browser pass on emd-smoke
  # built from 4b7b17e: an unsaved filtered cohort could not be compared (Q46).
  Scenario: Gefilterte, nicht gespeicherte Kohorte lässt sich vergleichen
    Given in "Kohortenbildung" I have entered "70" in the "Alter" field "Min"
    And I have opened the cohort analysis for this filter
    And the tab "Aggregiert" is open
    When I click "Kohorten vergleichen"
    Then the drawer "Kohorten vergleichen" lists the cohort named after "Aktive Kohorte: " in the header, starting with "Gefilterte Kohorte", marked "Basis-Kohorte (fest)"
    When I close the drawer with "Alle Patienten" selected
    Then the legend lists the "Gefilterte Kohorte" entry and "Alle Patienten" with their patient counts
    And after opening the tab "Verläufe" the legend still lists both cohorts

  # Added by NF on 2026-11-24 (drafted_by: ai-assisted) from the open reviewer findings of the Z0-P23 follow-up 29f32d3
  # (Q48 a: order of the filtered cohort; Q49 a: switching the base cohort back to the filtered cohort).
  Scenario: Gefilterte Kohorte steht in beiden Auswahlen direkt nach Alle Patienten
    Given a saved cohort "Alterskohorte" also exists
    And in "Kohortenbildung" I have entered "70" in the "Alter" field "Min"
    And I have opened the cohort analysis for this filter
    And the tab "Aggregiert" is open
    When I click "Kohorten vergleichen"
    Then the drawer "Kohorten vergleichen" lists "Alle Patienten" first and the "Gefilterte Kohorte" entry second, before "Alterskohorte", "Testkohorte" and "Vergleichskohorte"
    And the selector "Kohorte wählen" lists the entries in the same order
    And with the UI language "English" both lists show "All patients" first and the "Filtered cohort" entry second
    When I close the drawer with "Alle Patienten" selected
    And I choose "Testkohorte" in "Kohorte wählen"
    And I choose the "Gefilterte Kohorte" entry in "Kohorte wählen"
    Then the header reads "Aktive Kohorte: " followed by the "Gefilterte Kohorte" entry
    And the legend lists the "Gefilterte Kohorte" entry and "Alle Patienten" with their patient counts
