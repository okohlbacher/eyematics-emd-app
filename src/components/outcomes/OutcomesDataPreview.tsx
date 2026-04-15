/**
 * OutcomesDataPreview — collapsible data preview with CSV export (OUTCOME-08 / D-27..D-30).
 *
 * Design decisions (09-CONTEXT.md locked decision 3):
 *   - flattenToRows() lives HERE, not in cohortTrajectory.ts (frozen from Phase 8).
 *   - Does NOT call computeCohortTrajectory a second time.
 *   - Imports only pure helpers from cohortTrajectory.ts: decimalToLogmar, decimalToSnellen, eyeOf.
 *   - Uses native <details> element (no React state for open/closed — D-27 "no-JS" requirement).
 *   - CSV columns: D-28 order, no center_id (D-30).
 */
import { ChevronRight, Download } from 'lucide-react';

import { LOINC_VISUS, SNOMED_IVI } from '../../services/fhirLoader';
import type { PatientCase } from '../../types/fhir';
import {
  decimalToLogmar,
  decimalToSnellen,
  eyeOf,
  type TrajectoryResult,
} from '../../utils/cohortTrajectory';
import { datedFilename, downloadCsv } from '../../utils/download';
import type { TranslationKey } from '../../i18n/translations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  cases: PatientCase[];
  aggregate: TrajectoryResult;
  t: (key: TranslationKey) => string;
  locale: 'de' | 'en';
}

interface Row {
  patient_pseudonym: string;
  eye: 'od' | 'os';
  observation_date: string;         // ISO YYYY-MM-DD
  days_since_baseline: number;      // always computed, independent of current axisMode
  treatment_index: number;          // always computed, independent of current axisMode
  visus_logmar: number;
  visus_snellen_numerator: number;
  visus_snellen_denominator: number;
}

// ---------------------------------------------------------------------------
// flattenToRows — local helper (locked decision 3: lives inside this file only)
//
// For each patient × eye × LOINC_VISUS observation:
//   - earliest LOINC_VISUS for (patient, eye) → baseline date
//   - days_since_baseline = days between observation.date and baseline
//   - treatment_index = count of SNOMED_IVI Procedures on (patient, eye) with date <= obs.date
//   - visus_logmar = decimalToLogmar(obs.valueQuantity.value)
//   - visus_snellen_* = decimalToSnellen(decimal)
// ---------------------------------------------------------------------------

function flattenToRows(cases: PatientCase[]): Row[] {
  const rows: Row[] = [];

  for (const pc of cases) {
    // Partition LOINC_VISUS observations by eye, sorted ascending by date.
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

    // Sort each eye's observations ascending by date.
    (['od', 'os'] as const).forEach((eye) =>
      visusByEye[eye].sort((a, b) => a.date.localeCompare(b.date)),
    );

    // Pre-collect IVI procedure dates by eye, sorted ascending.
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

    // Emit one row per (patient, eye, observation).
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
// Component
// ---------------------------------------------------------------------------

/** D-28 CSV column keys in exact order */
const CSV_COL_KEYS = [
  'outcomesPreviewColPseudonym',
  'outcomesPreviewColEye',
  'outcomesPreviewColDate',
  'outcomesPreviewColDaysSinceBaseline',
  'outcomesPreviewColTreatmentIndex',
  'outcomesPreviewColVisusLogmar',
  'outcomesPreviewColSnellenNum',
  'outcomesPreviewColSnellenDen',
] as const;

export default function OutcomesDataPreview({ cases, aggregate, t, locale }: Props) {
  const rows = flattenToRows(cases);
  const rowCount = rows.length;

  const fmt = (n: number, digits = 3) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n);

  const handleExport = () => {
    const headers = CSV_COL_KEYS.map((k) => t(k));
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
                {CSV_COL_KEYS.map((key) => (
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
                  key={`${r.patient_pseudonym}-${r.eye}-${r.observation_date}-${i}`}
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
