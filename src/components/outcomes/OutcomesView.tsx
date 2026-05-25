/**
 * Cohort Outcome Trajectories view — OUTCOME-01..12 / Phase 09.
 *
 * Rendered as the "Trajectories" tab inside AnalysisPage. Formerly lived at
 * its own route /outcomes (src/pages/OutcomesPage.tsx, removed 2026-04-16).
 * Route resolution (?cohort / ?filter) and the audit beacon on mount are
 * preserved — the beacon now fires when this component mounts (i.e. when
 * the user switches to the Trajectories tab).
 *
 * Phase 13 / METRIC-04: inline metric tab strip (?metric= URL param).
 *
 * Phase 44 / TECH-02: slim orchestrator — logic extracted to:
 *   useOutcomesRouteState   (URL/cohort/handlers/effects)
 *   useOutcomesAggregation  (server routing + aggregate memos)
 *   VisusMetricContainer    (visus metric body)
 *   CrtMetricContainer      (CRT metric body)
 *
 * CRITICAL — Rules of Hooks (WR-01 / Pitfall 3): both hook calls are
 * unconditional and above any early return; their internal hook call order
 * mirrors the original OutcomesView exactly.
 */
import { GitCompare, Settings } from 'lucide-react';

import type { TranslationKey } from '../../i18n/translations';
import CohortCompareDrawer from './CohortCompareDrawer';
import CrtMetricContainer from './CrtMetricContainer';
import IntervalHistogram from './IntervalHistogram';
import OutcomesDataPreview from './OutcomesDataPreview';
import OutcomesEmptyState from './OutcomesEmptyState';
import OutcomesSettingsDrawer from './OutcomesSettingsDrawer';
import ResponderView from './ResponderView';
import { useOutcomesAggregation } from './useOutcomesAggregation';
import {
  METRIC_TAB_ORDER,
  metricTitleKey,
  useOutcomesRouteState,
} from './useOutcomesRouteState';
import VisusMetricContainer from './VisusMetricContainer';

export default function OutcomesView() {
  // WR-01 / Pitfall 3: both hooks called unconditionally before any return.
  const s = useOutcomesRouteState();
  const a = useOutcomesAggregation(s);

  const renderTabStrip = () => (
    <nav
      role="tablist"
      aria-label={s.t('metricsSelectorLabel')}
      className="flex gap-2 border-b border-gray-200 mb-6"
    >
      {METRIC_TAB_ORDER.map((m) => {
        const active = m === s.activeMetric;
        return (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => s.handleMetricChange(m)}
            onKeyDown={(e) => s.handleMetricKeyDown(e, m)}
            data-testid={`metric-tab-${m}`}
            className={
              active
                ? 'px-4 py-2 text-sm font-semibold text-blue-700 border-b-2 border-blue-700'
                : 'px-4 py-2 text-sm text-gray-500 hover:text-gray-700'
            }
          >
            {s.t(metricTitleKey(m))}
            {m === 'responder' && (
              <span
                title={`${s.t('metricsResponderTooltip')}`}
                className="ml-1 text-gray-400 hover:text-blue-600 cursor-help"
                aria-label={s.t('metricsResponderTooltip')}
              >ℹ</span>
            )}
          </button>
        );
      })}
    </nav>
  );

  const renderBody = () => {
    if (!s.cohort || s.cohort.cases.length === 0) {
      return <OutcomesEmptyState variant="no-cohort" t={s.t as (key: TranslationKey) => string} />;
    }

    // Server fetch in flight (only relevant for visus/crt)
    if (a.routeServerSide && s.serverLoading && !s.serverAggregate && (s.activeMetric === 'visus' || s.activeMetric === 'crt')) {
      return (
        <div className="flex items-center gap-2 py-8 justify-center text-gray-500 text-sm italic">
          <span
            role="status"
            aria-live="polite"
            data-testid="outcomes-server-computing"
          >
            {s.t('outcomesServerComputingLabel')}
          </span>
        </div>
      );
    }

    if (s.activeMetric === 'visus') {
      if (!a.aggregate) {
        return <OutcomesEmptyState variant="no-cohort" t={s.t as (key: TranslationKey) => string} />;
      }
      return (
        <VisusMetricContainer
          aggregate={a.aggregate}
          cohort={s.cohort}
          t={s.t}
          locale={s.locale as 'de' | 'en'}
          axisMode={s.axisMode}
          yMetric={s.yMetric}
          layers={s.layers}
          isCrossMode={s.isCrossMode}
          crossCohortAggregates={a.crossCohortAggregates}
          handlePointDrillDown={s.handlePointDrillDown}
        />
      );
    }

    if (s.activeMetric === 'crt') {
      if (!a.crtAggregate) {
        return <OutcomesEmptyState variant="no-crt" t={s.t as (key: TranslationKey) => string} />;
      }
      return (
        <CrtMetricContainer
          crtAggregate={a.crtAggregate}
          cohort={s.cohort}
          t={s.t}
          locale={s.locale as 'de' | 'en'}
          axisMode={s.axisMode}
          yMetric={s.yMetric}
          layers={s.layers}
          isCrossMode={s.isCrossMode}
          crossCohortAggregates={a.crossCohortAggregates}
          handlePointDrillDown={s.handlePointDrillDown}
        />
      );
    }

    if (s.activeMetric === 'interval') {
      return (
        <>
          <IntervalHistogram
            cases={s.cohort.cases}
            t={s.t as (k: TranslationKey) => string}
            locale={s.locale as 'de' | 'en'}
            cohortSeries={s.isCrossMode && a.crossCohortCaseSeries.length >= 2 ? a.crossCohortCaseSeries : undefined}
          />
          <OutcomesDataPreview
            activeMetric="interval"
            cases={s.cohort.cases}
            aggregate={a.aggregate ?? { od: { patients: [], scatterPoints: [], medianGrid: [], summary: { patientCount: 0, measurementCount: 0, excludedCount: 0 } }, os: { patients: [], scatterPoints: [], medianGrid: [], summary: { patientCount: 0, measurementCount: 0, excludedCount: 0 } }, combined: { patients: [], scatterPoints: [], medianGrid: [], summary: { patientCount: 0, measurementCount: 0, excludedCount: 0 } } }}
            t={s.t}
            locale={s.locale as 'de' | 'en'}
          />
        </>
      );
    }

    if (s.activeMetric === 'responder') {
      return (
        <>
          <ResponderView
            cases={s.cohort.cases}
            thresholdLetters={s.thresholdLetters}
            t={s.t as (k: TranslationKey) => string}
            locale={s.locale as 'de' | 'en'}
            cohortSeries={s.isCrossMode && a.crossCohortCaseSeries.length >= 2 ? a.crossCohortCaseSeries : undefined}
          />
          <OutcomesDataPreview
            activeMetric="responder"
            cases={s.cohort.cases}
            aggregate={a.aggregate ?? { od: { patients: [], scatterPoints: [], medianGrid: [], summary: { patientCount: 0, measurementCount: 0, excludedCount: 0 } }, os: { patients: [], scatterPoints: [], medianGrid: [], summary: { patientCount: 0, measurementCount: 0, excludedCount: 0 } }, combined: { patients: [], scatterPoints: [], medianGrid: [], summary: { patientCount: 0, measurementCount: 0, excludedCount: 0 } } }}
            t={s.t}
            locale={s.locale as 'de' | 'en'}
            thresholdLetters={s.thresholdLetters}
          />
        </>
      );
    }

    return null;
  };

  return (
    <div>
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {s.cohort?.name ? `${s.t('outcomesTitle')}: ${s.cohort.name}` : s.t('outcomesTitle')}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {s.isCrossMode && a.crossCohortAggregates
              ? (() => {
                  const names = a.crossCohortAggregates.combined.map((c) => c.cohortName);
                  let namesStr = names.join(', ');
                  if (namesStr.length > 50) namesStr = namesStr.slice(0, 47) + '…';
                  const base = s.t('outcomesCrossMode').replace('{count}', String(names.length));
                  return `${base} · ${namesStr}`;
                })()
              : (s.cohort?.name ? s.t('outcomesSubtitleSaved') : s.t('outcomesSubtitleAdhoc'))
                  .replace('{count}', String(s.cohort?.cases.length ?? 0))}
          </p>
          {a.routeServerSide && s.serverLoading && (
            <span
              role="status"
              aria-live="polite"
              className="ml-3 text-gray-500 text-sm italic"
              data-testid="outcomes-server-computing-header"
            >
              {s.t('outcomesServerComputingLabel')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={s.t('outcomesCompareOpenDrawer')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
            onClick={() => s.setCompareOpen(true)}
          >
            <GitCompare className="w-4 h-4" />
            <span>{s.t('outcomesCompareOpenDrawer')}</span>
          </button>
          <button
            type="button"
            aria-label={s.t('outcomesOpenSettings')}
            aria-expanded={s.drawerOpen}
            aria-controls="outcomes-settings-drawer"
            onClick={() => s.setDrawerOpen((v) => !v)}
            className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Phase 13 / METRIC-04: inline metric tab strip */}
      {renderTabStrip()}

      {/* Conditional metric body */}
      {renderBody()}

      {/* Settings drawer (OUTCOME-03 through -06) */}
      <OutcomesSettingsDrawer
        open={s.drawerOpen}
        onClose={() => s.setDrawerOpen(false)}
        activeMetric={s.activeMetric}
        axisMode={s.axisMode}
        setAxisMode={s.setAxisMode}
        yMetric={s.yMetric}
        setYMetric={s.setYMetric}
        gridPoints={s.gridPoints}
        setGridPoints={s.setGridPoints}
        layers={s.layers}
        setLayers={s.setLayers}
        thresholdLetters={s.thresholdLetters}
        setThresholdLetters={s.setThresholdLetters}
        patientCount={s.cohort?.cases.length ?? 0}
        t={s.t as (key: string) => string}
        isCrossMode={s.isCrossMode}
      />

      {/* Phase 16 / XCOHORT-01..03: cohort compare drawer */}
      <CohortCompareDrawer
        open={s.compareOpen}
        onClose={() => s.setCompareOpen(false)}
        savedSearches={s.savedSearches}
        patientCounts={s.patientCounts}
        primaryCohortId={s.primaryCohortId}
        selectedIds={s.crossCohortIds.length > 0 ? s.crossCohortIds : (s.primaryCohortId ? [s.primaryCohortId] : [])}
        onChange={s.handleCompareChange}
        onReset={s.handleCompareReset}
        t={s.t as (k: string) => string}
      />
    </div>
  );
}
