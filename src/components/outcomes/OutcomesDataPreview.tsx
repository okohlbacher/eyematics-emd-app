/**
 * OutcomesDataPreview — collapsible data preview with CSV export (OUTCOME-08 / D-27..D-30).
 *
 * Design decisions (09-CONTEXT.md locked decision 3):
 *   - flattenToRows() lives HERE, not in cohortTrajectory.ts (frozen from Phase 8).
 *   - Does NOT call computeCohortTrajectory a second time.
 *   - Imports only pure helpers from cohortTrajectory.ts: decimalToLogmar, decimalToSnellen, eyeOf.
 *   - Uses native <details> element (no React state for open/closed — D-27 "no-JS" requirement).
 *   - CSV columns: D-28 order, no center_id (D-30).
 *
 * Phase 13 / METRIC-05: activeMetric prop switches flattener + CSV columns + filename.
 */
import { ChevronRight, Download } from 'lucide-react';

import type { TranslationKey } from '../../i18n/translations';
import { LOINC_CRT, LOINC_VISUS, SNOMED_IVI } from '../../services/fhirLoader';
import type { PatientCase } from '../../types/fhir';
import {
  decimalToLogmar,
  decimalToSnellen,
  eyeOf,
  type TrajectoryResult,
} from '../../utils/cohortTrajectory';
import { datedFilename, downloadCsv } from '../../utils/download';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MetricType = 'visus' | 'crt' | 'interval' | 'responder';

interface Props {
  cases: PatientCase[];
  aggregate: TrajectoryResult;
  t: (key: TranslationKey) => string;
  locale: 'de' | 'en';
  activeMetric?: MetricType;
  thresholdLetters?: number;
}

interface VisusRow {
  patient_pseudonym: string;
  eye: 'od' | 'os';
  observation_date: string;
  days_since_baseline: number;
  treatment_index: number;
  visus_logmar: number;
  visus_snellen_numerator: number;
  visus_snellen_denominator: number;
}

interface CrtRow {
  patient_pseudonym: string;
  eye: 'od' | 'os';
  observation_date: string;
  crt_um: number;
  crt_delta_um: number;
}

interface IntervalRow {
  patient_pseudonym: string;
  eye: 'od' | 'os';
  gap_index: number;
  gap_days: number;
  procedure_date: string;
}

interface ResponderRow {
  patient_pseudonym: string;
  eye: 'od' | 'os';
  bucket: string;
  delta_visus_letters: number;
  measurement_date: string;
}

// ---------------------------------------------------------------------------
// Helpers: eyeOf for dual SNOMED codes
// ---------------------------------------------------------------------------

function bodySiteEye(bodySite: unknown): 'od' | 'os' | null {
  if (!bodySite || typeof bodySite !== 'object') return null;
  const coding = (bodySite as Record<string, unknown>).coding;
  if (!Array.isArray(coding) || coding.length === 0) return null;
  const code = (coding[0] as Record<string, unknown>).code;
  if (code === '362503005' || code === '24028007') return 'od';
  if (code === '362502000' || code === '8966001') return 'os';
  return null;
}

// ---------------------------------------------------------------------------
// flattenToRows — visus (locked decision 3: lives inside this file only)
// ---------------------------------------------------------------------------

function flattenVisusRows(cases: PatientCase[]): VisusRow[] {
  const rows: VisusRow[] = [];

  for (const pc of cases) {
    const visusByEye: Record<'od' | 'os', Array<{ date: string; decimal: number }>> = {
      od: [],
      os: [],
    };

    for (const obs of pc.observations ?? []) {
      const isVisus = (obs.code?.coding ?? []).some((c) => c.code === LOINC_VISUS);
      if (!isVisus) continue;

      const e = eyeOf(obs.bodySite);
      if (e !== 'od' && e !== 'os') continue;

      const decimal =
        typeof obs.valueQuantity?.value === 'number' ? obs.valueQuantity.value : NaN;
      if (!Number.isFinite(decimal) || decimal <= 0) continue;

      const date =
        typeof obs.effectiveDateTime === 'string' ? obs.effectiveDateTime.slice(0, 10) : '';
      if (!date) continue;

      visusByEye[e].push({ date, decimal });
    }

    (['od', 'os'] as const).forEach((eye) =>
      visusByEye[eye].sort((a, b) => a.date.localeCompare(b.date)),
    );

    const iviByEye: Record<'od' | 'os', string[]> = { od: [], os: [] };

    for (const proc of pc.procedures ?? []) {
      const isIvi = (proc.code?.coding ?? []).some((c) => c.code === SNOMED_IVI);
      if (!isIvi) continue;

      const e = eyeOf(proc.bodySite);
      if (e !== 'od' && e !== 'os') continue;

      const date =
        typeof proc.performedDateTime === 'string' ? proc.performedDateTime.slice(0, 10) : '';
      if (!date) continue;

      iviByEye[e].push(date);
    }

    iviByEye.od.sort();
    iviByEye.os.sort();

    (['od', 'os'] as const).forEach((eye) => {
      const observations = visusByEye[eye];
      if (observations.length === 0) return;

      const baseline = observations[0].date;

      for (const obs of observations) {
        const logmar = decimalToLogmar(obs.decimal);
        const snellen = decimalToSnellen(obs.decimal);
        const daysSinceBaseline = Math.round(
          (new Date(obs.date).getTime() - new Date(baseline).getTime()) / (24 * 60 * 60 * 1000),
        );
        const treatmentIndex = iviByEye[eye].filter((d) => d <= obs.date).length;

        rows.push({
          patient_pseudonym: pc.pseudonym,
          eye,
          observation_date: obs.date,
          days_since_baseline: daysSinceBaseline,
          treatment_index: treatmentIndex,
          visus_logmar: logmar,
          visus_snellen_numerator: snellen.num,
          visus_snellen_denominator: snellen.den,
        });
      }
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// flattenCrtRows — METRIC-05 / CRT
// ---------------------------------------------------------------------------

function flattenCrtRows(cases: PatientCase[]): CrtRow[] {
  const rows: CrtRow[] = [];

  for (const pc of cases) {
    const crtByEye: Record<'od' | 'os', Array<{ date: string; um: number }>> = { od: [], os: [] };

    for (const obs of pc.observations ?? []) {
      const isCrt = (obs.code?.coding ?? []).some((c) => c.code === LOINC_CRT);
      if (!isCrt) continue;

      const e = bodySiteEye(obs.bodySite);
      if (e !== 'od' && e !== 'os') continue;

      const um = typeof obs.valueQuantity?.value === 'number' ? obs.valueQuantity.value : NaN;
      if (!Number.isFinite(um) || um <= 0) continue;

      const date =
        typeof obs.effectiveDateTime === 'string' ? obs.effectiveDateTime.slice(0, 10) : '';
      if (!date) continue;

      crtByEye[e].push({ date, um });
    }

    (['od', 'os'] as const).forEach((eye) => {
      crtByEye[eye].sort((a, b) => a.date.localeCompare(b.date));
      const obs = crtByEye[eye];
      if (obs.length === 0) return;

      const baselineUm = obs[0].um;
      for (const o of obs) {
        rows.push({
          patient_pseudonym: pc.pseudonym,
          eye,
          observation_date: o.date,
          crt_um: Math.round(o.um),
          crt_delta_um: Math.round(o.um - baselineUm),
        });
      }
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// flattenIntervalRows — METRIC-05 / treatment intervals
// ---------------------------------------------------------------------------

function flattenIntervalRows(cases: PatientCase[]): IntervalRow[] {
  const rows: IntervalRow[] = [];

  for (const pc of cases) {
    const iviByEye: Record<'od' | 'os', string[]> = { od: [], os: [] };

    for (const proc of pc.procedures ?? []) {
      const isIvi = (proc.code?.coding ?? []).some((c) => c.code === SNOMED_IVI);
      if (!isIvi) continue;

      const e = bodySiteEye(proc.bodySite) ?? eyeOf(proc.bodySite);
      if (e !== 'od' && e !== 'os') continue;

      const date =
        typeof proc.performedDateTime === 'string' ? proc.performedDateTime.slice(0, 10) : '';
      if (!date) continue;

      iviByEye[e].push(date);
    }

    (['od', 'os'] as const).forEach((eye) => {
      iviByEye[eye].sort();
      const dates = iviByEye[eye];
      for (let i = 1; i < dates.length; i++) {
        const gapDays = Math.round(
          (new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / (24 * 60 * 60 * 1000),
        );
        if (gapDays >= 0) {
          rows.push({
            patient_pseudonym: pc.pseudonym,
            eye,
            gap_index: i,
            gap_days: gapDays,
            procedure_date: dates[i],
          });
        }
      }
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// flattenResponderRows — METRIC-05 / responder classification
// ---------------------------------------------------------------------------

function deltaLogmarAtYear1(
  obs: Array<{ date: string; logmar: number }>,
): { delta: number; measurementDate: string } | null {
  if (obs.length < 2) return null;
  const baseline = obs[0];
  const year1Min = new Date(baseline.date);
  year1Min.setDate(year1Min.getDate() - 180);
  const year1Max = new Date(baseline.date);
  year1Max.setDate(year1Max.getDate() + 180);
  year1Max.setFullYear(year1Max.getFullYear() + 1);

  let best: { delta: number; measurementDate: string } | null = null;
  let minDist = Infinity;

  for (const o of obs.slice(1)) {
    const d = new Date(o.date);
    const target = new Date(baseline.date);
    target.setFullYear(target.getFullYear() + 1);
    if (d < year1Min || d > year1Max) continue;
    const dist = Math.abs(d.getTime() - target.getTime());
    if (dist < minDist) {
      minDist = dist;
      best = { delta: o.logmar - baseline.logmar, measurementDate: o.date };
    }
  }
  return best;
}

function flattenResponderRows(
  cases: PatientCase[],
  thresholdLetters: number,
): ResponderRow[] {
  const thresholdLogmar = Math.max(0, thresholdLetters) * 0.02;
  const rows: ResponderRow[] = [];

  for (const pc of cases) {
    const visusByEye: Record<'od' | 'os', Array<{ date: string; logmar: number }>> = {
      od: [],
      os: [],
    };

    for (const obs of pc.observations ?? []) {
      const isVisus = (obs.code?.coding ?? []).some((c) => c.code === LOINC_VISUS);
      if (!isVisus) continue;

      const e = bodySiteEye(obs.bodySite) ?? eyeOf(obs.bodySite);
      if (e !== 'od' && e !== 'os') continue;

      const decimal =
        typeof obs.valueQuantity?.value === 'number' ? obs.valueQuantity.value : NaN;
      if (!Number.isFinite(decimal) || decimal <= 0) continue;

      const date =
        typeof obs.effectiveDateTime === 'string' ? obs.effectiveDateTime.slice(0, 10) : '';
      if (!date) continue;

      visusByEye[e].push({ date, logmar: decimalToLogmar(decimal) });
    }

    (['od', 'os'] as const).forEach((eye) => {
      visusByEye[eye].sort((a, b) => a.date.localeCompare(b.date));
      const result = deltaLogmarAtYear1(visusByEye[eye]);
      if (!result) return;

      const { delta, measurementDate } = result;
      const bucket =
        delta <= -thresholdLogmar ? 'responder' : delta >= thresholdLogmar ? 'non-responder' : 'partial';
      const deltaLetters = Math.round(-delta / 0.02); // improvement = positive letters

      rows.push({
        patient_pseudonym: pc.pseudonym,
        eye,
        bucket,
        delta_visus_letters: deltaLetters,
        measurement_date: measurementDate,
      });
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** D-28 CSV column keys in exact order (visus) */
const VISUS_COL_KEYS = [
  'outcomesPreviewColPseudonym',
  'outcomesPreviewColEye',
  'outcomesPreviewColDate',
  'outcomesPreviewColDaysSinceBaseline',
  'outcomesPreviewColTreatmentIndex',
  'outcomesPreviewColVisusLogmar',
  'outcomesPreviewColSnellenNum',
  'outcomesPreviewColSnellenDen',
] as const;

export default function OutcomesDataPreview({
  cases,
  aggregate,
  t,
  locale,
  activeMetric = 'visus',
  thresholdLetters = 5,
}: Props) {
  const fmt = (n: number, digits = 3) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n);

  // ---------------------------------------------------------------------------
  // Metric-specific render + CSV
  // ---------------------------------------------------------------------------

  if (activeMetric === 'crt') {
    const rows = flattenCrtRows(cases);

    const handleExport = () => {
      const headers = [
        t('outcomesPreviewColPseudonym'),
        t('outcomesPreviewColEye'),
        t('outcomesPreviewColDate'),
        t('metricsPreviewColCrtUm'),
        t('metricsPreviewColCrtDeltaUm'),
      ];
      const csvRows = rows.map((r) => [
        r.patient_pseudonym,
        r.eye.toUpperCase(),
        r.observation_date,
        String(r.crt_um),
        String(r.crt_delta_um),
      ]);
      downloadCsv(headers, csvRows, datedFilename('outcomes-crt', 'csv'));
    };

    return (
      <details
        data-testid="outcomes-data-preview"
        className="mt-8 bg-white rounded-xl border border-gray-200"
      >
        <summary className="cursor-pointer text-sm font-medium text-gray-700 px-5 py-3 flex items-center gap-2">
          <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
          {t('outcomesPreviewToggleOpen')}
        </summary>
        <div className="px-5 pb-5">
          <div className="flex items-center justify-between py-3">
            <p className="text-xs text-gray-500">
              {t('outcomesPreviewCaption').replace('{rows}', String(rows.length))}
            </p>
            <button
              type="button"
              onClick={handleExport}
              aria-label={t('metricsPreviewExportCsvCrt')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
            >
              <Download className="w-4 h-4" />
              {t('metricsPreviewExportCsvCrt')}
            </button>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    t('outcomesPreviewColPseudonym'),
                    t('outcomesPreviewColEye'),
                    t('outcomesPreviewColDate'),
                    t('metricsPreviewColCrtUm'),
                    t('metricsPreviewColCrtDeltaUm'),
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, i) => (
                  <tr key={`${r.patient_pseudonym}|${r.eye}|${r.observation_date}|${i}`} className="text-sm hover:bg-gray-50">
                    <td className="px-3 py-2">{r.patient_pseudonym}</td>
                    <td className="px-3 py-2">{t(r.eye === 'od' ? 'outcomesPreviewEyeOd' : 'outcomesPreviewEyeOs')}</td>
                    <td className="px-3 py-2">{r.observation_date}</td>
                    <td className="px-3 py-2">{fmt(r.crt_um, 0)}</td>
                    <td className="px-3 py-2">{fmt(r.crt_delta_um, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    );
  }

  if (activeMetric === 'interval') {
    const rows = flattenIntervalRows(cases);

    const handleExport = () => {
      const headers = [
        t('outcomesPreviewColPseudonym'),
        t('outcomesPreviewColEye'),
        t('metricsPreviewColGapIndex'),
        t('metricsPreviewColGapDays'),
        t('metricsPreviewColProcedureDate'),
      ];
      const csvRows = rows.map((r) => [
        r.patient_pseudonym,
        r.eye.toUpperCase(),
        String(r.gap_index),
        String(r.gap_days),
        r.procedure_date,
      ]);
      downloadCsv(headers, csvRows, datedFilename('outcomes-intervals', 'csv'));
    };

    return (
      <details
        data-testid="outcomes-data-preview"
        className="mt-8 bg-white rounded-xl border border-gray-200"
      >
        <summary className="cursor-pointer text-sm font-medium text-gray-700 px-5 py-3 flex items-center gap-2">
          <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
          {t('outcomesPreviewToggleOpen')}
        </summary>
        <div className="px-5 pb-5">
          <div className="flex items-center justify-between py-3">
            <p className="text-xs text-gray-500">
              {t('outcomesPreviewCaption').replace('{rows}', String(rows.length))}
            </p>
            <button
              type="button"
              onClick={handleExport}
              aria-label={t('metricsPreviewExportCsvInterval')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
            >
              <Download className="w-4 h-4" />
              {t('metricsPreviewExportCsvInterval')}
            </button>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    t('outcomesPreviewColPseudonym'),
                    t('outcomesPreviewColEye'),
                    t('metricsPreviewColGapIndex'),
                    t('metricsPreviewColGapDays'),
                    t('metricsPreviewColProcedureDate'),
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, i) => (
                  <tr key={`${r.patient_pseudonym}|${r.eye}|${i}`} className="text-sm hover:bg-gray-50">
                    <td className="px-3 py-2">{r.patient_pseudonym}</td>
                    <td className="px-3 py-2">{t(r.eye === 'od' ? 'outcomesPreviewEyeOd' : 'outcomesPreviewEyeOs')}</td>
                    <td className="px-3 py-2">{r.gap_index}</td>
                    <td className="px-3 py-2">{r.gap_days}</td>
                    <td className="px-3 py-2">{r.procedure_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    );
  }

  if (activeMetric === 'responder') {
    const rows = flattenResponderRows(cases, thresholdLetters);

    const handleExport = () => {
      const headers = [
        t('outcomesPreviewColPseudonym'),
        t('outcomesPreviewColEye'),
        t('metricsPreviewColBucket'),
        t('metricsPreviewColDeltaVisusLetters'),
        t('metricsPreviewColMeasurementDate'),
      ];
      const csvRows = rows.map((r) => [
        r.patient_pseudonym,
        r.eye.toUpperCase(),
        r.bucket,
        String(r.delta_visus_letters),
        r.measurement_date,
      ]);
      downloadCsv(headers, csvRows, datedFilename('outcomes-responder', 'csv'));
    };

    return (
      <details
        data-testid="outcomes-data-preview"
        className="mt-8 bg-white rounded-xl border border-gray-200"
      >
        <summary className="cursor-pointer text-sm font-medium text-gray-700 px-5 py-3 flex items-center gap-2">
          <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
          {t('outcomesPreviewToggleOpen')}
        </summary>
        <div className="px-5 pb-5">
          <div className="flex items-center justify-between py-3">
            <p className="text-xs text-gray-500">
              {t('outcomesPreviewCaption').replace('{rows}', String(rows.length))}
            </p>
            <button
              type="button"
              onClick={handleExport}
              aria-label={t('metricsPreviewExportCsvResponder')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
            >
              <Download className="w-4 h-4" />
              {t('metricsPreviewExportCsvResponder')}
            </button>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    t('outcomesPreviewColPseudonym'),
                    t('outcomesPreviewColEye'),
                    t('metricsPreviewColBucket'),
                    t('metricsPreviewColDeltaVisusLetters'),
                    t('metricsPreviewColMeasurementDate'),
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, i) => (
                  <tr key={`${r.patient_pseudonym}|${r.eye}|${i}`} className="text-sm hover:bg-gray-50">
                    <td className="px-3 py-2">{r.patient_pseudonym}</td>
                    <td className="px-3 py-2">{t(r.eye === 'od' ? 'outcomesPreviewEyeOd' : 'outcomesPreviewEyeOs')}</td>
                    <td className="px-3 py-2">{r.bucket}</td>
                    <td className="px-3 py-2">{r.delta_visus_letters}</td>
                    <td className="px-3 py-2">{r.measurement_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    );
  }

  // ---------------------------------------------------------------------------
  // Default: visus (activeMetric === 'visus' or undefined)
  // ---------------------------------------------------------------------------

  const rows = flattenVisusRows(cases);
  const rowCount = rows.length;

  // CRREV-02: stable composite row keys — pure function of row identity,
  // not array index. Format: `${pseudo}|${eye}|${date}`; duplicate tuples
  // (multiple measurements same day) get a `|#N` suffix (N≥2) so every
  // rendered row has a unique, reorder-invariant key.
  const rowKeys: string[] = (() => {
    const seen = new Map<string, number>();
    return rows.map((r) => {
      const base = `${r.patient_pseudonym}|${r.eye}|${r.observation_date}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      return n === 1 ? base : `${base}|#${n}`;
    });
  })();

  const handleExport = () => {
    const headers = VISUS_COL_KEYS.map((k) => t(k));
    const csvRows = rows.map((r) => [
      r.patient_pseudonym,
      r.eye.toUpperCase(),
      r.observation_date,
      String(r.days_since_baseline),
      String(r.treatment_index),
      r.visus_logmar.toFixed(3),
      String(r.visus_snellen_numerator),
      String(r.visus_snellen_denominator),
    ]);
    downloadCsv(headers, csvRows, datedFilename('outcomes-cohort', 'csv'));
  };

  // Row-count parity invariant (D-26): flattenToRows count must equal
  // aggregate.od.summary.measurementCount + aggregate.os.summary.measurementCount.
  const parityExpected =
    aggregate.od.summary.measurementCount + aggregate.os.summary.measurementCount;

  return (
    <details
      data-testid="outcomes-data-preview"
      className="mt-8 bg-white rounded-xl border border-gray-200"
    >
      <summary className="cursor-pointer text-sm font-medium text-gray-700 px-5 py-3 flex items-center gap-2">
        <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
        {t('outcomesPreviewToggleOpen')}
      </summary>

      <div className="px-5 pb-5">
        <div className="flex items-center justify-between py-3">
          <p className="text-xs text-gray-500">
            {t('outcomesPreviewCaption').replace('{rows}', String(rowCount))}
          </p>
          <button
            type="button"
            onClick={handleExport}
            aria-label={t('outcomesPreviewExportCsv')}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
          >
            <Download className="w-4 h-4" />
            {t('outcomesPreviewExportCsv')}
          </button>
        </div>

        {/* Parity invariant surface: exposes row-count and aggregate-count for
            future regression detection (data-* attrs, hidden element). */}
        <div
          data-testid="outcomes-preview-parity"
          data-row-count={rowCount}
          data-aggregate-count={parityExpected}
          hidden
        />

        <div className="max-h-96 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {VISUS_COL_KEYS.map((key) => (
                  <th
                    key={key}
                    className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2 whitespace-nowrap"
                  >
                    {t(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => (
                <tr
                  key={rowKeys[i]}
                  data-row-key={rowKeys[i]}
                  className="text-sm hover:bg-gray-50"
                >
                  <td className="px-3 py-2">{r.patient_pseudonym}</td>
                  <td className="px-3 py-2">
                    {t(r.eye === 'od' ? 'outcomesPreviewEyeOd' : 'outcomesPreviewEyeOs')}
                  </td>
                  <td className="px-3 py-2">{r.observation_date}</td>
                  <td className="px-3 py-2">{r.days_since_baseline}</td>
                  <td className="px-3 py-2">{r.treatment_index}</td>
                  <td className="px-3 py-2">{fmt(r.visus_logmar)}</td>
                  <td className="px-3 py-2">{r.visus_snellen_numerator}</td>
                  <td className="px-3 py-2">{r.visus_snellen_denominator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}
