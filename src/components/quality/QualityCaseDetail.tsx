import {
  AlertCircle,
  ArrowUpRight,
  Ban,
  Check,
  CheckCheck,
  CheckCircle2,
  Circle,
  Flag,
  Image as ImageIcon,
  RotateCcw,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { pickCoding } from '../../../shared/fhirQueries';
import { resolveQualityParams } from '../../../shared/qualityParams';
import {
  CRITICAL_CRT_THRESHOLD,
  CRITICAL_VISUS_THRESHOLD,
  VISUS_JUMP_THRESHOLD,
} from '../../config/clinicalThresholds';
import { useLanguage } from '../../context/LanguageContext';
import {
  getAge,
  getObservationsByCode,
  LOINC_CRT,
  LOINC_VISUS,
  SNOMED_IVI,
} from '../../services/fhirLoader';
import { getCachedDisplay } from '../../services/terminology';
import type { PatientCase, QualityFlag } from '../../types/fhir';
import OctViewer from '../OctViewer';
import InfoTooltip from '../primitives/InfoTooltip';
import type { TherapyStatusEntry } from './QualityCaseList';

/**
 * Sentinel errorType values written when a reviewer confirms a value or marks it
 * corrected-upstream from the inline measurements list (C1). They are wire/DB
 * strings (NOT user-facing labels) and stay verbatim per D-05 — the existing
 * server already requires a non-empty errorType, so a positive verdict reuses
 * the same quality-flag store/endpoint with no new persistence path.
 */
export const CONFIRMED_ERROR_TYPE = 'confirmed';
export const CORRECTED_ERROR_TYPE = 'corrected';

/** Derived per-row review verdict shown in the Status cell. */
type RowVerdict = 'open' | 'confirmed' | 'anomalous' | 'missing' | 'resolved';

interface ReviewRow {
  /** Stable parameter key used to associate flags ("Display (YYYY-MM-DD)" or bare param for missing). */
  paramKey: string;
  /** Display name of the parameter (without the date suffix). */
  label: string;
  /** ISO date string (empty for synthetic missing rows). */
  date: string;
  /** Rendered value cell content. */
  value: string;
  /** Anomaly/missing reason, if any (relocated inline from the old amber card). */
  reason?: string;
  /** True for synthetic missing-data rows (no observation behind them). */
  missing: boolean;
  /** True when the system flagged this row as anomalous (threshold/jump). */
  anomalous: boolean;
}

export interface QualityCaseDetailProps {
  selectedCase: PatientCase;
  caseFlags: QualityFlag[];
  therapyStatus: TherapyStatusEntry | undefined;
  isExcluded: boolean;
  isReviewed: boolean;
  dateFmt: string;
  /** When set, only the listed quality-check keys run for this case (resolveQualityParams fallback: all). */
  activeQualityParams?: string[];
  onMarkReviewed: (caseId: string) => void;
  onExclude: (caseId: string) => void;
  onNavigateToCase: (caseId: string) => void;
  onOpenFlagDialog: (parameter: string, value: string) => void;
  /** Confirm a row as correct → persists a QualityFlag (acknowledged, errorType "confirmed"). */
  onConfirmRow: (caseId: string, parameter: string, value: string) => void;
  /** Revert a row's verdict back to "open" (deletes the flag, returns the row to needs-review). */
  onResetRow: (caseId: string, parameter: string) => void;
}

const PILL_BASE =
  'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium';

export default function QualityCaseDetail({
  selectedCase,
  caseFlags,
  therapyStatus,
  isExcluded,
  isReviewed,
  dateFmt,
  activeQualityParams,
  onMarkReviewed,
  onExclude,
  onNavigateToCase,
  onOpenFlagDialog,
  onConfirmRow,
  onResetRow,
}: QualityCaseDetailProps) {
  const { locale, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'values' | 'oct'>('values');
  const [filter, setFilter] = useState<'all' | 'anomalies' | 'open'>('all');

  // Derive OCT images the same way useCaseData does on the patient detail page,
  // stripping any leading directory segment from the FHIR instance title.
  const octImages = useMemo(
    () =>
      (selectedCase.imagingStudies ?? []).flatMap((study) =>
        (study.series ?? []).flatMap((s) =>
          (s.instance ?? []).map((inst) => ({
            title: study.description ?? 'OCT',
            date: study.started?.substring(0, 10) ?? '',
            path: `/api/fhir/images/${(inst.title ?? '').replace(/^.*\//, '')}`,
          })),
        ),
      ),
    [selectedCase],
  );

  // Anomaly + missing-data derivation (N03.05, EMDREQ-QUAL-004). "auffällig"/"fehlt"
  // are DERIVED display states (D-05) — they key off observation values and presence,
  // never off a stored wire enum. activeQualityParams gates which checks run; undefined
  // ⇒ resolveQualityParams fallback (all six).
  //   - Value anomalies are keyed by the observation's *own* id, so they attach to the
  //     exact row regardless of how the parameter is displayed (real data renders
  //     "Visual acuity"/"Central retinal thickness", not the literals "Visus"/"CRT").
  //   - Missing items become synthetic rows; their parameter key keeps the existing
  //     literal ("Visus"/"CRT"/"IVOM") so a flag/confirm/correct on a missing item
  //     persists and re-associates the same way the prior anomaly card did.
  const { anomalyByObsId, missingItems } = useMemo(() => {
    const byObs = new Map<string, string>(); // observation.id → reason
    const missing: Array<{ parameter: string; reason: string }> = [];
    const activeKeys = new Set(resolveQualityParams(activeQualityParams));

    const visObs = getObservationsByCode(selectedCase.observations, LOINC_VISUS);
    const crtObs = getObservationsByCode(selectedCase.observations, LOINC_CRT);
    const injections = selectedCase.procedures.filter((p) =>
      p.code.coding.some((c) => c.code === SNOMED_IVI),
    );

    if (activeKeys.has('missingVisus') && visObs.length === 0)
      missing.push({ parameter: 'Visus', reason: t('missingVisus') });
    if (activeKeys.has('missingCrt') && crtObs.length === 0)
      missing.push({ parameter: 'CRT', reason: t('missingCrt') });
    if (activeKeys.has('missingInjections') && injections.length === 0)
      missing.push({ parameter: 'IVOM', reason: t('missingInjections') });

    if (activeKeys.has('crtCritical')) {
      crtObs.forEach((o) => {
        const v = o.valueQuantity?.value;
        if (v != null && v > CRITICAL_CRT_THRESHOLD()) byObs.set(o.id, t('crtAnomaly'));
      });
    }
    if (activeKeys.has('visusCritical')) {
      visObs.forEach((o) => {
        const v = o.valueQuantity?.value;
        if (v != null && v < CRITICAL_VISUS_THRESHOLD()) byObs.set(o.id, t('visusAnomaly'));
      });
    }
    if (activeKeys.has('visusJump')) {
      for (let i = 1; i < visObs.length; i++) {
        const prev = visObs[i - 1].valueQuantity?.value ?? 0;
        const curr = visObs[i].valueQuantity?.value ?? 0;
        if (Math.abs(curr - prev) > VISUS_JUMP_THRESHOLD()) byObs.set(visObs[i].id, t('visusJump'));
      }
    }
    return { anomalyByObsId: byObs, missingItems: missing };
  }, [selectedCase, activeQualityParams, t]);

  // Unified review-row model: every observation becomes a row, plus a synthetic
  // row for each MISSING parameter so missing data is visible inline (NF point 2).
  const rows = useMemo<ReviewRow[]>(() => {
    const result: ReviewRow[] = [];

    selectedCase.observations.forEach((obs) => {
      const label = obs.code.coding[0]?.display ?? '';
      const date = obs.effectiveDateTime?.substring(0, 10) ?? '';
      const paramKey = `${label} (${date})`;
      const reason = anomalyByObsId.get(obs.id);
      result.push({
        paramKey,
        label,
        date,
        value: `${obs.valueQuantity?.value ?? ''} ${obs.valueQuantity?.unit ?? ''}`.trim(),
        reason,
        missing: false,
        anomalous: reason != null,
      });
    });

    // Synthetic rows for missing parameters (keyed by literal param: 'Visus'/'CRT'/'IVOM').
    missingItems.forEach((m) => {
      result.push({
        paramKey: m.parameter,
        label: m.parameter,
        date: '',
        value: '—',
        reason: m.reason,
        missing: true,
        anomalous: true,
      });
    });

    return result;
  }, [selectedCase, anomalyByObsId, missingItems]);

  // Resolve the current verdict of a row from its flag (if any) + derived anomaly.
  const verdictOf = (row: ReviewRow, flag: QualityFlag | undefined): RowVerdict => {
    if (flag?.status === 'acknowledged') return 'confirmed';
    if (flag?.status === 'resolved') return 'resolved';
    // No positive verdict yet → anomaly/missing surfaces as the derived state.
    if (row.missing) return 'missing';
    if (row.anomalous) return 'anomalous';
    return 'open';
  };

  const flagFor = (paramKey: string) => caseFlags.find((f) => f.parameter === paramKey);

  // Counts for the filter chips + progress.
  const counts = useMemo(() => {
    let anomalies = 0;
    let open = 0;
    let judged = 0;
    rows.forEach((row) => {
      const v = verdictOf(row, flagFor(row.paramKey));
      if (v === 'anomalous' || v === 'missing') anomalies++;
      if (v === 'open' || v === 'anomalous' || v === 'missing') open++;
      if (v === 'confirmed' || v === 'resolved') judged++;
    });
    return { all: rows.length, anomalies, open, judged };
  }, [rows, caseFlags]); // eslint-disable-line react-hooks/exhaustive-deps -- verdictOf/flagFor close over caseFlags

  const visibleRows = rows.filter((row) => {
    if (filter === 'all') return true;
    const v = verdictOf(row, flagFor(row.paramKey));
    if (filter === 'anomalies') return v === 'anomalous' || v === 'missing';
    return v === 'open' || v === 'anomalous' || v === 'missing';
  });

  // Bulk confirm: ONLY rows that are non-anomalous, non-missing, AND un-judged
  // (verdict 'open'), respecting the current filter (D-07). Skips anomalies/missing
  // (need an explicit verdict) and already-judged rows.
  const handleBulkConfirm = () => {
    visibleRows.forEach((row) => {
      if (verdictOf(row, flagFor(row.paramKey)) === 'open') {
        onConfirmRow(selectedCase.id, row.paramKey, row.value);
      }
    });
  };

  const statusPill = (verdict: RowVerdict) => {
    switch (verdict) {
      case 'confirmed':
        return (
          <span className={`${PILL_BASE} bg-green-50 text-green-700`} aria-label={`${t('status')}: ${t('statusConfirmed')}`}>
            <Check className="w-3 h-3" /> {t('statusConfirmed')}
          </span>
        );
      case 'resolved':
        return (
          <span className={`${PILL_BASE} bg-blue-50 text-blue-700`} aria-label={`${t('status')}: ${t('statusResolved')}`}>
            <ArrowUpRight className="w-3 h-3" /> {t('statusResolved')}
          </span>
        );
      case 'anomalous':
        return (
          <span className={`${PILL_BASE} bg-amber-50 text-amber-600`} aria-label={`${t('status')}: ${t('statusAnomalous')}`}>
            <AlertCircle className="w-3 h-3" /> {t('statusAnomalous')}
          </span>
        );
      case 'missing':
        return (
          <span className={`${PILL_BASE} bg-amber-50 text-amber-600 border border-dashed border-amber-200`} aria-label={`${t('status')}: ${t('statusMissing')}`}>
            <AlertCircle className="w-3 h-3" /> {t('statusMissing')}
          </span>
        );
      default:
        return (
          <span className={`${PILL_BASE} bg-gray-100 text-gray-600`} aria-label={`${t('status')}: ${t('statusOpen')}`}>
            <Circle className="w-3 h-3" /> {t('statusOpen')}
          </span>
        );
    }
  };

  const rowActions = (row: ReviewRow, verdict: RowVerdict) => {
    const subj = `${row.label} ${row.date}`.trim();
    // Already judged → single reset.
    if (verdict === 'confirmed' || verdict === 'resolved') {
      return (
        <button
          onClick={() => onResetRow(selectedCase.id, row.paramKey)}
          aria-label={`${t('resetStatus')} ${subj}`}
          title={t('resetStatus')}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      );
    }
    return (
      <div className="inline-flex items-center gap-1.5">
        {/* Missing rows cannot be "confirmed correct" — only corrected upstream or flagged. */}
        {!row.missing && (
          <button
            onClick={() => onConfirmRow(selectedCase.id, row.paramKey, row.value)}
            aria-label={`${t('confirmValue')} ${subj}`}
            title={t('confirmValue')}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-green-200 text-green-700 hover:bg-green-50"
          >
            <Check className="w-3.5 h-3.5" /> {t('confirmValue')}
          </button>
        )}
        {/* J6b: the "Behoben" (corrected-upstream) action was removed — the site
            is not planning to access the Quellsystem, so a reviewer can no longer
            SET resolved. The wire `resolved` status + CORRECTED_ERROR_TYPE sentinel
            stay untouched (D-05); pre-existing resolved rows still render below. */}
        <button
          onClick={() => onOpenFlagDialog(row.paramKey, row.value)}
          aria-label={`${t('reportError')} ${subj}`}
          title={t('reportError')}
          className="inline-flex items-center px-2 py-1 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
        >
          <Flag className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  // Read-only audit log entries for Card B (who/when/what per flag).
  const logVerb = (flag: QualityFlag): string => {
    if (flag.status === 'acknowledged') return t('logConfirmed');
    if (flag.status === 'resolved') return t('logCorrectedUpstream');
    return t('logFlagged');
  };

  // I6a (v1.14-p2): the reviewer's reported errorType note is preserved across a
  // confirm (status-only update), but previously only rendered while the flag was
  // still 'open'. Surface the real note for acknowledged/resolved rows too — and
  // suppress the CONFIRMED_ERROR_TYPE / CORRECTED_ERROR_TYPE sentinels (which are
  // wire/DB markers a verdict writes, NOT user notes) so they never display as a
  // fake annotation. Returns null when there is no displayable note.
  const displayNote = (flag: QualityFlag | undefined): string | null => {
    const note = flag?.errorType?.trim();
    if (!note) return null;
    if (note === CONFIRMED_ERROR_TYPE || note === CORRECTED_ERROR_TYPE) return null;
    return note;
  };

  return (
    <div className="space-y-4">
      {/* Header strip — condensed meta + case-level actions (no duplicate approve control). */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">{selectedCase.pseudonym}</h3>
            {isExcluded && (
              <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs font-medium flex items-center gap-1">
                <Ban className="w-3 h-3" /> {t('excludedCase')}
              </span>
            )}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {t('reviewProgress')}:{' '}
            <span className="font-semibold text-green-700 dark:text-green-400">{counts.judged}</span> / {counts.all}{' '}
            {t('reviewProgressJudged')}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
          <span><span className="font-medium text-gray-900 dark:text-white">{getAge(selectedCase.birthDate)}</span> {t('age')}</span>
          <span>
            {t('diagnosis')}:{' '}
            <span className="font-medium text-gray-900 dark:text-white">
              {selectedCase.conditions
                .map((c) => {
                  const { system, code } = pickCoding(c);
                  return getCachedDisplay(system, code, locale);
                })
                .join(', ')}
            </span>
          </span>
          <span>{t('center')}: <span className="font-medium text-gray-900 dark:text-white">{selectedCase.centerName}</span></span>
          <span>
            {t('therapyDiscontinuation')}:{' '}
            {therapyStatus?.status === 'breaker' ? (
              <span className="font-medium text-red-600">{t('therapyBreaker')} ({therapyStatus.gapDays}d)</span>
            ) : therapyStatus?.status === 'interrupter' ? (
              <span className="font-medium text-amber-600">{t('therapyInterrupter')} ({therapyStatus.gapDays}d)</span>
            ) : (
              <span className="font-medium text-green-600">{t('therapyActive')}</span>
            )}
          </span>
          <span>{t('totalMeasurements')}: <span className="font-medium text-gray-900 dark:text-white">{selectedCase.observations.length}</span></span>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onExclude(selectedCase.id)}
            className={`px-3 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 ${
              isExcluded
                ? 'border-green-200 text-green-700 hover:bg-green-50'
                : 'border-red-200 text-red-700 hover:bg-red-50'
            }`}
          >
            {isExcluded ? (
              <><CheckCheck className="w-3.5 h-3.5" /> {t('includeInAnalysis')}</>
            ) : (
              <><Ban className="w-3.5 h-3.5" /> {t('excludeFromAnalysis')}</>
            )}
          </button>
          <button
            onClick={() => onNavigateToCase(selectedCase.id)}
            className="text-sm text-blue-600 hover:underline"
          >
            {t('fullCaseView')}
          </button>
        </div>
      </div>

      {/* Card A — the single review surface: inline per-row confirm/correct/flag. */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 mb-4">
          <button
            onClick={() => setActiveTab('values')}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'values'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {t('valuesToReview')}
          </button>
          <button
            onClick={() => setActiveTab('oct')}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${
              activeTab === 'oct'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            {t('octTitle')}
            {octImages.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {octImages.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'values' ? (
          <>
            {/* Filter chips — the old amber card's anomaly count survives as "Nur auffällige (n)". */}
            <div role="group" aria-label={t('status')} className="flex items-center gap-2 mb-3">
              {([
                ['all', t('filterAll'), counts.all],
                ['anomalies', t('filterOnlyAnomalies'), counts.anomalies],
                ['open', t('filterOnlyOpen'), counts.open],
              ] as const).map(([key, label, count]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  aria-pressed={filter === key}
                  className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                    filter === key
                      ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                  }`}
                >
                  {label} <span className="opacity-70">{count}</span>
                </button>
              ))}
            </div>

            {/* J6a: table-fixed + an explicit colgroup pins the Status and Aktion
                columns to stable widths. The status/annotation pills now live in a
                dedicated fixed-width column, so changing a row's status (open →
                bestätigt → auffällig, etc.) never re-sizes the column and the action
                buttons never shift. Parameter takes the remaining flexible width. */}
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col />
                <col className="w-24" />
                <col className="w-24" />
                <col className="w-36" />
                <col className="w-48" />
              </colgroup>
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{t('parameter')}</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{t('date')}</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">{t('value')}</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{t('status')}</th>
                  <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">{t('action')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const flag = flagFor(row.paramKey);
                  const verdict = verdictOf(row, flag);
                  // I6a: real (non-sentinel) reviewer note, shown regardless of status.
                  const note = displayNote(flag);
                  const highlight = verdict === 'anomalous' || verdict === 'missing';
                  return (
                    <tr key={row.paramKey} className={highlight ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}>
                      <td className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 align-top">{row.label}</td>
                      <td className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 align-top">{row.date || '—'}</td>
                      <td className={`px-3 py-2 border-t border-gray-100 dark:border-gray-700 text-right font-mono align-top ${verdict === 'resolved' ? 'line-through text-gray-400' : ''}`}>
                        {row.value || '—'}
                      </td>
                      {/* J6a: fixed-width status column — left-aligned + nowrap so a
                          longer/shorter pill never changes the column width. */}
                      <td className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 text-left align-top whitespace-nowrap">{statusPill(verdict)}</td>
                      <td className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 text-center align-top whitespace-nowrap">{rowActions(row, verdict)}</td>
                      {/* Inline reason sub-row + corrected-upstream note (amber card relocated, NF point 2). */}
                      {(row.reason || verdict === 'resolved' || note) && (
                        <td colSpan={5} className="px-3 pb-2 pt-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {row.reason && (
                              <span className={`inline-flex items-center gap-1 text-xs rounded-md px-2 py-0.5 border ${
                                row.missing
                                  ? 'text-red-600 bg-red-50 border-red-200'
                                  : 'text-amber-800 bg-amber-50 border-amber-200'
                              }`}>
                                <AlertCircle className="w-3 h-3" />
                                {row.missing ? t('statusMissing') : t('statusAnomalous')}: {row.reason}
                              </span>
                            )}
                            {/* I6a: show the real reviewer note for open AND
                                acknowledged/resolved rows; sentinels are suppressed
                                by displayNote so a confirmed clean row shows nothing. */}
                            {note && (
                              <span className="inline-flex items-center gap-1 text-xs rounded-md px-2 py-0.5 border text-red-600 bg-red-50 border-red-200">
                                <Flag className="w-3 h-3" /> {note}
                              </span>
                            )}
                            {verdict === 'resolved' && (
                              <span className="text-xs italic text-gray-500 dark:text-gray-400">{t('correctedUpstreamNote')}</span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleBulkConfirm}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-green-200 text-green-700 hover:bg-green-50"
              >
                <CheckCheck className="w-3.5 h-3.5" /> {t('confirmAllVisible')}
              </button>
            </div>

            {/* Status legend with definition tooltips (NF point 3). */}
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 text-xs">
              <span className="inline-flex items-center gap-1">{statusPill('open')}<InfoTooltip text={t('tipStatusOpen')} /></span>
              <span className="inline-flex items-center gap-1">{statusPill('confirmed')}<InfoTooltip text={t('tipStatusConfirmed')} /></span>
              <span className="inline-flex items-center gap-1">{statusPill('anomalous')}<InfoTooltip text={t('tipStatusAnomalous')} /></span>
              {/* J6b: no "Behoben"/resolved legend entry — the action was removed,
                  so resolved is no longer a status a reviewer can set. Existing
                  resolved rows still render their pill inline (kept in statusPill). */}
            </div>
          </>
        ) : (
          <OctViewer images={octImages} />
        )}
      </div>

      {/* Card B — collapsed case status + read-only audit log (no second editor). */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <details>
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              {t('caseStatusAndLog')}
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs font-medium">
                {caseFlags.length} {t('reviewLogEntries')}
              </span>
            </span>
          </summary>
          <div className="mt-4">
            <div className="mb-4">
              <button
                onClick={() => onMarkReviewed(selectedCase.id)}
                className={`px-3 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 ${
                  isReviewed
                    ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                    : 'border-green-200 text-green-700 hover:bg-green-50'
                }`}
              >
                {isReviewed ? (
                  <><Circle className="w-3.5 h-3.5" /> {t('unmarkReviewed')}</>
                ) : (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> {t('markAsReviewed')}</>
                )}
              </button>
            </div>
            {caseFlags.length > 0 && (
              <div className="space-y-1.5 text-xs">
                {caseFlags.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <span className="dark:text-gray-200">
                      <span className="font-medium">{f.parameter}</span> — {logVerb(f)}
                      {/* I6a: include the real reviewer note in the read-only audit
                          log too, suppressing the confirmed/corrected sentinels. */}
                      {displayNote(f) && (
                        <span className="text-gray-600 dark:text-gray-300"> · {displayNote(f)}</span>
                      )}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {t('reportedBy')} {f.flaggedBy} · {new Date(f.flaggedAt).toLocaleDateString(dateFmt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs italic text-gray-500 dark:text-gray-400">{t('reviewLogReadonlyNote')}</p>
          </div>
        </details>
      </div>
    </div>
  );
}
