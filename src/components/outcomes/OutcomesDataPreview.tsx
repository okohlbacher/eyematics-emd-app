/**
 * OutcomesDataPreview — collapsible data preview with CSV export (OUTCOME-08 / D-27..D-30).
 *
 * Design decisions (09-CONTEXT.md locked decision 3, superseded by F-08 Phase 36):
 *   - Measurement-series flatteners now live in shared/cohortTrajectory.ts
 *     (flattenVisusRows / flattenCrtRows) so the CSV path reuses trajectory
 *     ingest logic instead of duplicating it. This component consumes them.
 *   - Does NOT call computeCohortTrajectory a second time.
 *   - Uses native <details> element (no React state for open/closed — D-27 "no-JS" requirement).
 *   - CSV columns: D-28 order, no center_id (D-30).
 *
 * Phase 13 / METRIC-05: activeMetric prop switches flattener + CSV columns + filename.
 *
 * Phase 36 / F-11: the four metric branches (each with its own <details>, header,
 * export button, table head, and table body) are collapsed into a single
 * config-driven shell. Each metric declares its columns (header key, CSV value,
 * rendered cell), export label, filename, and row key. The visus metric additionally
 * declares the D-26 parity surface and the CRREV-02 per-row `data-row-key`.
 */
import { ChevronRight, Download } from 'lucide-react';
import type { ReactNode } from 'react';

import { flattenCrtRows, flattenVisusRows } from '../../../shared/cohortTrajectory';
import { flattenIntervalRows } from '../../../shared/intervalMetric';
import { projectResponderRows } from '../../../shared/responderMetric';
import type { TranslationKey } from '../../i18n/translations';
import type { PatientCase } from '../../types/fhir';
import { type TrajectoryResult } from '../../utils/cohortTrajectory';
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

type Translate = (key: TranslationKey) => string;

/** A single column: header translation key, the CSV string value, and the rendered cell. */
interface ColumnDef<R> {
  headerKey: TranslationKey;
  csv: (row: R) => string;
  cell: (row: R) => ReactNode;
}

/** Resolved per-metric table configuration. */
interface MetricConfig<R> {
  rows: readonly R[];
  columns: ReadonlyArray<ColumnDef<R>>;
  exportLabelKey: TranslationKey;
  filenameBase: string;
  rowKey: (row: R, index: number) => string;
  /** When present, render the D-26 parity surface + CRREV-02 `data-row-key` attr (visus only). */
  parity?: { rowCount: number; aggregateCount: number };
}

/**
 * Type-erasing wrapper: builds a concretely-typed MetricConfig<R> (so the column
 * getters are checked against the real row shape) and widens it to the renderable
 * MetricConfig<unknown>. The cast is sound because every getter only ever receives
 * rows from the same `rows` array.
 */
function buildConfig<R>(cfg: MetricConfig<R>): MetricConfig<unknown> {
  return cfg as unknown as MetricConfig<unknown>;
}

// ---------------------------------------------------------------------------
// Eye cell helper (shared by every metric column set)
// ---------------------------------------------------------------------------

function eyeCell(t: Translate, eye: 'od' | 'os'): string {
  return t(eye === 'od' ? 'outcomesPreviewEyeOd' : 'outcomesPreviewEyeOs');
}

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
  // Resolve the active metric's config. Each branch preserves the exact prior
  // column order, CSV values, rendered cells, filename, export label, and key.
  // ---------------------------------------------------------------------------
  const config = ((): MetricConfig<unknown> => {
    if (activeMetric === 'crt') {
      return buildConfig({
        rows: flattenCrtRows(cases),
        columns: [
          { headerKey: 'outcomesPreviewColPseudonym', csv: (r) => r.patient_pseudonym, cell: (r) => r.patient_pseudonym },
          { headerKey: 'outcomesPreviewColEye', csv: (r) => r.eye.toUpperCase(), cell: (r) => eyeCell(t, r.eye) },
          { headerKey: 'outcomesPreviewColDate', csv: (r) => r.observation_date, cell: (r) => r.observation_date },
          { headerKey: 'metricsPreviewColCrtUm', csv: (r) => String(r.crt_um), cell: (r) => fmt(r.crt_um, 0) },
          { headerKey: 'metricsPreviewColCrtDeltaUm', csv: (r) => String(r.crt_delta_um), cell: (r) => fmt(r.crt_delta_um, 0) },
        ],
        exportLabelKey: 'metricsPreviewExportCsvCrt',
        filenameBase: 'outcomes-crt',
        rowKey: (r, i) => `${r.patient_pseudonym}|${r.eye}|${r.observation_date}|${i}`,
      });
    }

    if (activeMetric === 'interval') {
      return buildConfig({
        rows: flattenIntervalRows(cases),
        columns: [
          { headerKey: 'outcomesPreviewColPseudonym', csv: (r) => r.patient_pseudonym, cell: (r) => r.patient_pseudonym },
          { headerKey: 'outcomesPreviewColEye', csv: (r) => r.eye.toUpperCase(), cell: (r) => eyeCell(t, r.eye) },
          { headerKey: 'metricsPreviewColGapIndex', csv: (r) => String(r.gap_index), cell: (r) => r.gap_index },
          { headerKey: 'metricsPreviewColGapDays', csv: (r) => String(r.gap_days), cell: (r) => r.gap_days },
          { headerKey: 'metricsPreviewColProcedureDate', csv: (r) => r.procedure_date, cell: (r) => r.procedure_date },
        ],
        exportLabelKey: 'metricsPreviewExportCsvInterval',
        filenameBase: 'outcomes-intervals',
        rowKey: (r, i) => `${r.patient_pseudonym}|${r.eye}|${i}`,
      });
    }

    if (activeMetric === 'responder') {
      return buildConfig({
        rows: projectResponderRows(cases, thresholdLetters),
        columns: [
          { headerKey: 'outcomesPreviewColPseudonym', csv: (r) => r.patient_pseudonym, cell: (r) => r.patient_pseudonym },
          { headerKey: 'outcomesPreviewColEye', csv: (r) => r.eye.toUpperCase(), cell: (r) => eyeCell(t, r.eye) },
          { headerKey: 'metricsPreviewColBucket', csv: (r) => r.bucket, cell: (r) => r.bucket },
          { headerKey: 'metricsPreviewColDeltaVisusLetters', csv: (r) => String(r.delta_visus_letters), cell: (r) => r.delta_visus_letters },
          { headerKey: 'metricsPreviewColMeasurementDate', csv: (r) => r.measurement_date, cell: (r) => r.measurement_date },
        ],
        exportLabelKey: 'metricsPreviewExportCsvResponder',
        filenameBase: 'outcomes-responder',
        rowKey: (r, i) => `${r.patient_pseudonym}|${r.eye}|${i}`,
      });
    }

    // Default: visus. Carries the D-26 parity surface and CRREV-02 row keys.
    const visusRows = flattenVisusRows(cases);
    // CRREV-02: stable composite row keys — pure function of row identity,
    // not array index. Format: `${pseudo}|${eye}|${date}`; duplicate tuples
    // (multiple measurements same day) get a `|#N` suffix (N≥2) so every
    // rendered row has a unique, reorder-invariant key.
    const seen = new Map<string, number>();
    const visusKeys = visusRows.map((r) => {
      const base = `${r.patient_pseudonym}|${r.eye}|${r.observation_date}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      return n === 1 ? base : `${base}|#${n}`;
    });
    return buildConfig({
      rows: visusRows,
      columns: [
        { headerKey: 'outcomesPreviewColPseudonym', csv: (r) => r.patient_pseudonym, cell: (r) => r.patient_pseudonym },
        { headerKey: 'outcomesPreviewColEye', csv: (r) => r.eye.toUpperCase(), cell: (r) => eyeCell(t, r.eye) },
        { headerKey: 'outcomesPreviewColDate', csv: (r) => r.observation_date, cell: (r) => r.observation_date },
        { headerKey: 'outcomesPreviewColDaysSinceBaseline', csv: (r) => String(r.days_since_baseline), cell: (r) => r.days_since_baseline },
        { headerKey: 'outcomesPreviewColTreatmentIndex', csv: (r) => String(r.treatment_index), cell: (r) => r.treatment_index },
        { headerKey: 'outcomesPreviewColVisusLogmar', csv: (r) => r.visus_logmar.toFixed(3), cell: (r) => fmt(r.visus_logmar) },
        { headerKey: 'outcomesPreviewColSnellenNum', csv: (r) => String(r.visus_snellen_numerator), cell: (r) => r.visus_snellen_numerator },
        { headerKey: 'outcomesPreviewColSnellenDen', csv: (r) => String(r.visus_snellen_denominator), cell: (r) => r.visus_snellen_denominator },
      ],
      exportLabelKey: 'outcomesPreviewExportCsv',
      filenameBase: 'outcomes-cohort',
      rowKey: (_r, i) => visusKeys[i],
      // Row-count parity invariant (D-26): flattenToRows count must equal
      // aggregate.od.summary.measurementCount + aggregate.os.summary.measurementCount.
      parity: {
        rowCount: visusRows.length,
        aggregateCount:
          aggregate.od.summary.measurementCount + aggregate.os.summary.measurementCount,
      },
    });
  })();

  const { rows, columns, exportLabelKey, filenameBase, rowKey, parity } = config;
  const rowCount = rows.length;

  const handleExport = () => {
    const headers = columns.map((c) => t(c.headerKey));
    const csvRows = rows.map((r) => columns.map((c) => c.csv(r)));
    downloadCsv(headers, csvRows, datedFilename(filenameBase, 'csv'));
  };

  return (
    <details
      data-testid="outcomes-data-preview"
      className="mt-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
    >
      <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200 px-5 py-3 flex items-center gap-2">
        <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
        {t('outcomesPreviewToggleOpen')}
      </summary>

      <div className="px-5 pb-5">
        <div className="flex items-center justify-between py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('outcomesPreviewCaption').replace('{rows}', String(rowCount))}
          </p>
          <button
            type="button"
            onClick={handleExport}
            aria-label={t(exportLabelKey)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
          >
            <Download className="w-4 h-4" />
            {t(exportLabelKey)}
          </button>
        </div>

        {parity && (
          // Parity invariant surface: exposes row-count and aggregate-count for
          // future regression detection (data-* attrs, hidden element).
          <div
            data-testid="outcomes-preview-parity"
            data-row-count={parity.rowCount}
            data-aggregate-count={parity.aggregateCount}
            hidden
          />
        )}

        <div className="max-h-96 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/40">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.headerKey}
                    className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3 py-2 whitespace-nowrap"
                  >
                    {t(c.headerKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
              {rows.map((r, i) => {
                const key = rowKey(r, i);
                return (
                  <tr
                    key={key}
                    {...(parity ? { 'data-row-key': key } : {})}
                    className="text-sm hover:bg-gray-50 dark:hover:bg-gray-700/40"
                  >
                    {columns.map((c, ci) => (
                      <td key={`${key}|c${ci}`} className="px-3 py-2">
                        {c.cell(r)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}
