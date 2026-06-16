/**
 * VisusMetricContainer — Phase 44 / TECH-02 extraction from OutcomesView.tsx.
 *
 * Renders the visus-metric body: empty-state guards, OutcomesSummaryCards,
 * scatter-default test div, 3 OutcomesPanel renders (od/os/combined), and
 * OutcomesDataPreview. Extracted verbatim from the `activeMetric === 'visus'`
 * branch of OutcomesView.renderBody().
 */
import type { TranslationKey } from '../../i18n/translations';
import type { AxisMode, TrajectoryResult, YMetric } from '../../utils/cohortTrajectory';
import OutcomesDataPreview from './OutcomesDataPreview';
import OutcomesEmptyState from './OutcomesEmptyState';
import type { CohortSeriesEntry } from './OutcomesPanel';
import OutcomesPanel from './OutcomesPanel';
import { PanelPlaceholder, PROGRESSIVE_PANEL_THRESHOLD_CASES } from './OutcomesPanelProgressive';
import OutcomesSummaryCards from './OutcomesSummaryCards';
import { EYE_COLORS } from './palette';
import { useProgressivePanels } from './useProgressivePanels';

interface VisusMetricContainerProps {
  aggregate: TrajectoryResult;
  cohort: { name: string | null; cases: import('../../../shared/types/fhir').PatientCase[] };
  t: (key: TranslationKey) => string;
  locale: 'de' | 'en';
  axisMode: AxisMode;
  yMetric: YMetric;
  layers: { median: boolean; perPatient: boolean; scatter: boolean; spreadBand: boolean };
  isCrossMode: boolean;
  crossCohortAggregates: null | { od: CohortSeriesEntry[]; os: CohortSeriesEntry[]; combined: CohortSeriesEntry[] };
  handlePointDrillDown: (patientId: string) => void;
}

export default function VisusMetricContainer({
  aggregate,
  cohort,
  t,
  locale,
  axisMode,
  yMetric,
  layers,
  isCrossMode,
  crossCohortAggregates,
  handlePointDrillDown,
}: VisusMetricContainerProps) {
  // J2 (v1.15-p4): stage the three panels (od/os/combined) one at a time on a heavy
  // single-cohort render so the main thread yields between Recharts builds and the
  // controls stay responsive. Cross-mode + small cohorts mount all three at once.
  // The stage key re-arms staging when the heavy inputs change. Hook runs before the
  // early returns below to satisfy Rules of Hooks (the guards never change between
  // renders for a given aggregate).
  // K7 (v1.16-A): stage in CROSS-MODE too. Compare renders N cohorts × (Area+Line)
  // across all three panels; mounting all three synchronously on every compare-drawer
  // toggle is the freeze. Staging yields the main thread between panel builds so the
  // drawer stays responsive. Keyed on the cross-cohort series identity so a selection
  // change re-arms staging.
  const crossWork = isCrossMode
    ? (crossCohortAggregates?.combined.reduce((n, c) => n + c.patientCount, 0) ?? 0)
    : 0;
  const progressiveActive = isCrossMode
    ? crossWork > PROGRESSIVE_PANEL_THRESHOLD_CASES
    : cohort.cases.length > PROGRESSIVE_PANEL_THRESHOLD_CASES;
  const stageKey = isCrossMode
    ? `cross|${crossCohortAggregates?.combined.map((c) => `${c.cohortId}:${c.patientCount}`).join(',') ?? ''}|${axisMode}|${yMetric}`
    : `${cohort.cases.length}|${axisMode}|${yMetric}|${layers.perPatient}|${layers.scatter}|${layers.median}|${layers.spreadBand}`;
  const mountedPanels = useProgressivePanels(3, progressiveActive, stageKey);

  if (!aggregate) {
    return <OutcomesEmptyState variant="no-cohort" t={t as (key: TranslationKey) => string} />;
  }
  if (
    aggregate.od.summary.measurementCount === 0 &&
    aggregate.os.summary.measurementCount === 0
  ) {
    return <OutcomesEmptyState variant="no-visus" t={t as (key: TranslationKey) => string} />;
  }
  if (
    cohort.cases.length > 0 &&
    aggregate.od.summary.measurementCount + aggregate.os.summary.measurementCount > 0 &&
    !layers.median &&
    !layers.perPatient &&
    !layers.scatter &&
    !layers.spreadBand
  ) {
    return <OutcomesEmptyState variant="all-eyes-filtered" t={t as (key: TranslationKey) => string} />;
  }
  return (
    <>
      <OutcomesSummaryCards
        aggregate={aggregate}
        t={t as (key: string) => string}
        locale={locale as 'de' | 'en'}
      />
      <div data-testid={layers.scatter ? 'outcomes-scatter-default-on' : 'outcomes-scatter-default-off'} />
      <div className="mt-12 grid grid-cols-1 xl:grid-cols-3 gap-6">
        {mountedPanels >= 1 ? (
          <OutcomesPanel
            panel={aggregate.od}
            eye="od"
            color={EYE_COLORS.OD}
            axisMode={axisMode}
            yMetric={yMetric}
            layers={layers}
            t={t as (key: string) => string}
            locale={locale as 'de' | 'en'}
            titleKey="outcomesPanelOd"
            cohortSeries={isCrossMode && crossCohortAggregates ? crossCohortAggregates.od : undefined}
            onPointClick={!isCrossMode ? handlePointDrillDown : undefined}
          />
        ) : (
          <PanelPlaceholder eye="od" titleKey="outcomesPanelOd" t={t} />
        )}
        {mountedPanels >= 2 ? (
          <OutcomesPanel
            panel={aggregate.os}
            eye="os"
            color={EYE_COLORS.OS}
            axisMode={axisMode}
            yMetric={yMetric}
            layers={layers}
            t={t as (key: string) => string}
            locale={locale as 'de' | 'en'}
            titleKey="outcomesPanelOs"
            cohortSeries={isCrossMode && crossCohortAggregates ? crossCohortAggregates.os : undefined}
            onPointClick={!isCrossMode ? handlePointDrillDown : undefined}
          />
        ) : (
          <PanelPlaceholder eye="os" titleKey="outcomesPanelOs" t={t} />
        )}
        {mountedPanels >= 3 ? (
          <OutcomesPanel
            panel={aggregate.combined}
            eye="combined"
            color={EYE_COLORS['OD+OS']}
            axisMode={axisMode}
            yMetric={yMetric}
            layers={layers}
            t={t as (key: string) => string}
            locale={locale as 'de' | 'en'}
            titleKey="outcomesPanelCombined"
            cohortSeries={isCrossMode && crossCohortAggregates ? crossCohortAggregates.combined : undefined}
            onPointClick={!isCrossMode ? handlePointDrillDown : undefined}
          />
        ) : (
          <PanelPlaceholder eye="combined" titleKey="outcomesPanelCombined" t={t} />
        )}
      </div>
      <OutcomesDataPreview
        activeMetric="visus"
        cases={cohort.cases}
        aggregate={aggregate}
        t={t}
        locale={locale as 'de' | 'en'}
      />
    </>
  );
}
