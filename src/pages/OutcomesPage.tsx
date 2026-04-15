/** Cohort Outcome Trajectories — OUTCOME-01..12 / Phase 09. */
import { useEffect, useMemo, useState } from 'react';
import { Settings } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import OutcomesEmptyState from '../components/outcomes/OutcomesEmptyState';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import type { TranslationKey } from '../i18n/translations';
import { applyFilters } from '../services/fhirLoader';
import type { CohortFilter } from '../types/fhir';
import {
  type AxisMode,
  defaultScatterOn,
  type SpreadMode,
  type YMetric,
} from '../utils/cohortTrajectory';

// M-04 safe-pick pattern (copied verbatim from AnalysisPage.tsx L48-59)
function safePickFilter(raw: unknown): CohortFilter {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const parsed = raw as Record<string, unknown>;
  const safe: CohortFilter = {};
  if (Array.isArray(parsed.diagnosis)) safe.diagnosis = parsed.diagnosis.map(String);
  if (Array.isArray(parsed.gender)) safe.gender = parsed.gender.map(String);
  if (Array.isArray(parsed.ageRange) && parsed.ageRange.length === 2) safe.ageRange = [Number(parsed.ageRange[0]), Number(parsed.ageRange[1])];
  if (Array.isArray(parsed.visusRange) && parsed.visusRange.length === 2) safe.visusRange = [Number(parsed.visusRange[0]), Number(parsed.visusRange[1])];
  if (Array.isArray(parsed.crtRange) && parsed.crtRange.length === 2) safe.crtRange = [Number(parsed.crtRange[0]), Number(parsed.crtRange[1])];
  if (Array.isArray(parsed.centers)) safe.centers = parsed.centers.map(String);
  return safe;
}

export default function OutcomesPage() {
  const { activeCases, savedSearches } = useData();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();

  // Session-only toggle state (D-24). Drawer UI lands in 09-02.
  const [, setDrawerOpen] = useState(false);
  const [axisMode] = useState<AxisMode>('days');
  const [yMetric] = useState<YMetric>('absolute');
  const [gridPoints] = useState<number>(120);
  const [spreadMode] = useState<SpreadMode>('iqr');
  const [layers, setLayers] = useState({
    median: true, perPatient: true, scatter: true, spreadBand: true,
  });

  // Cohort resolution (OUTCOME-01 / D-03)
  const cohort = useMemo(() => {
    const cohortId = searchParams.get('cohort');
    const filterParam = searchParams.get('filter');
    if (cohortId) {
      const saved = savedSearches.find((s) => s.id === cohortId);
      return saved ? { name: saved.name, cases: applyFilters(activeCases, saved.filters) } : null;
    }
    if (filterParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(filterParam));
        return { name: null, cases: applyFilters(activeCases, safePickFilter(parsed)) };
      } catch { return null; }
    }
    return { name: null, cases: activeCases };
  }, [activeCases, savedSearches, searchParams]);

  // D-37 default-scatter-off once cohort size known
  useEffect(() => {
    if (cohort && !defaultScatterOn(cohort.cases.length)) {
      setLayers((L) => ({ ...L, scatter: false }));
    }
  }, [cohort]);

  // Audit beacon (OUTCOME-11 / D-32) — fire-and-forget, once per mount.
  useEffect(() => {
    const params = new URLSearchParams({ name: 'open_outcomes_view' });
    const cid = searchParams.get('cohort');
    const fp = searchParams.get('filter');
    if (cid) params.set('cohort', cid);
    if (fp) params.set('filter', fp);
    fetch(`/api/audit/events/view-open?${params.toString()}`, { credentials: 'include' })
      .catch(() => { /* beacon is fire-and-forget */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cohort || cohort.cases.length === 0) {
    return <OutcomesEmptyState variant="no-cohort" t={t as (key: TranslationKey) => string} />;
  }

  // Unused-var discipline: touch the state setters/getters so downstream plans
  // can import them without TS6133 noise. (09-02 will actually render drawer.)
  void axisMode; void yMetric; void gridPoints; void spreadMode;

  return (
    <div className="p-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {cohort.name ? `${t('outcomesTitle')}: ${cohort.name}` : t('outcomesTitle')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {(cohort.name ? t('outcomesSubtitleSaved') : t('outcomesSubtitleAdhoc'))
              .replace('{count}', String(cohort.cases.length))}
          </p>
        </div>
        <button
          type="button"
          aria-label={t('outcomesOpenSettings')}
          onClick={() => setDrawerOpen((v) => !v)}
          className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
        >
          <Settings className="w-4 h-4" />
        </button>
      </header>

      {/* Task-1.2 marker: asserts the D-37 default-scatter-off effect ran. */}
      <div
        data-testid={layers.scatter ? 'outcomes-scatter-default-on' : 'outcomes-scatter-default-off'}
      />
      {/* Plans 09-02 / 09-03 wire summary cards, panels, drawer, data preview here. */}
      <div data-testid="outcomes-content-placeholder" />
    </div>
  );
}
