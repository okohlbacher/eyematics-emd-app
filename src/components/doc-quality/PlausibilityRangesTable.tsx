/**
 * Plausibility ranges reference table — J5a.
 *
 * The plausibility bounds are GLOBAL (admin-configured in settings.yaml, same
 * across all centres). This component is the single render of that table, read
 * from `getSettings().plausibility` (NOT hardcoded), reused by both the main
 * Dokumentationsqualität view (collapsible, collapsed by default) and the
 * per-centre detail panel (always-open).
 */
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { useLanguage } from '../../context/LanguageContext';
import {
  LOINC_CRT,
  LOINC_IOP,
  LOINC_VISUS,
} from '../../services/fhirLoader';
import { getSettings } from '../../services/settingsService';

interface RangeRow {
  parameter: string;
  range: string;
  loinc: string;
}

function buildRows(): RangeRow[] {
  // Single source of truth: settings.yaml plausibility config (CFG-02).
  const p = getSettings().plausibility ?? {
    visusMin: 0,
    visusMax: 2.0,
    crtMin: 100,
    crtMax: 800,
    iopMin: 5,
    iopMax: 40,
  };
  return [
    { parameter: 'Visus', range: `${p.visusMin} – ${p.visusMax}`, loinc: LOINC_VISUS },
    { parameter: 'CRT', range: `${p.crtMin} – ${p.crtMax} µm`, loinc: LOINC_CRT },
    { parameter: 'IOP', range: `${p.iopMin} – ${p.iopMax} mmHg`, loinc: LOINC_IOP },
  ];
}

function RangesTable() {
  const { t } = useLanguage();
  const rows = buildRows();
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-100">
          <th className="text-left px-3 py-2 font-medium text-gray-600">
            {t('docQualityParameter')}
          </th>
          <th className="text-left px-3 py-2 font-medium text-gray-600">
            {t('docQualityRange')}
          </th>
          <th className="text-left px-3 py-2 font-medium text-gray-600">LOINC</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.map((r) => (
          <tr key={r.parameter}>
            <td className="px-3 py-2 text-gray-800">{r.parameter}</td>
            <td className="px-3 py-2 text-gray-600">{r.range}</td>
            <td className="px-3 py-2 text-gray-400 font-mono text-xs">{r.loinc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface PlausibilityRangesTableProps {
  /** When true, wrap the table in a collapsible <details> collapsed by default (main view, J5a). */
  collapsible?: boolean;
}

export function PlausibilityRangesTable({ collapsible = false }: PlausibilityRangesTableProps): ReactNode {
  const { t } = useLanguage();

  if (collapsible) {
    return (
      <details
        data-testid="plausibility-ranges-table"
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
      >
        <summary className="cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-200 px-4 py-3 flex items-center gap-2 list-none">
          <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
          {t('docQualityPlausibilityRanges')}
        </summary>
        <div className="px-4 pb-4">
          <RangesTable />
        </div>
      </details>
    );
  }

  return (
    <div
      data-testid="plausibility-ranges-table"
      className="bg-white rounded-xl border border-gray-200 p-4"
    >
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        {t('docQualityPlausibilityRanges')}
      </h3>
      <RangesTable />
    </div>
  );
}
