/** Case detail page — EMDREQ-FALL-001 to FALL-006 (single case analysis, clinical parameters, cohort comparison). */
import { ArrowLeft, Syringe, TrendingDown, TrendingUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate,useParams } from 'react-router-dom';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import AnamnesisFindings from '../components/case-detail/AnamnesisFindings';
import { caseChartColors, IQR_FILL_OPACITY } from '../components/case-detail/chartTheme';
import ClinicalParametersRow from '../components/case-detail/ClinicalParametersRow';
import DistributionCharts from '../components/case-detail/DistributionCharts';
import MedicationCard from '../components/case-detail/MedicationCard';
import PatientHeader from '../components/case-detail/PatientHeader';
import VisusCrtChart from '../components/case-detail/VisusCrtChart';
import OctViewer from '../components/OctViewer';
import { InfoTooltip } from '../components/primitives';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { useThemeSafe } from '../context/ThemeContext';
import { useCaseData } from '../hooks/useCaseData';
import { SNOMED_EYE_RIGHT } from '../services/fhirLoader';
import { getDateLocale } from '../utils/dateFormat';

export default function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { cases } = useData();
  const navigate = useNavigate();
  const { locale, t } = useLanguage();
  // L11b: theme-aware chart colours for the inline baseline-change ComposedChart.
  const { effectiveTheme } = useThemeSafe();
  const chartColors = caseChartColors(effectiveTheme === 'dark');

  // Case view is audit-logged server-side via the /api/* requests
  const octViewerRef = useRef<HTMLDivElement>(null);
  const [octSelectedIdx, setOctSelectedIdx] = useState(0);
  const [highlightDate, setHighlightDate] = useState<string | null>(null);
  // K3d: the currently-highlighted injection date (temporary emphasis in the plot
  // + the Intravitreale Injektionen list). Independent of the visit highlight.
  const [highlightInjectionDate, setHighlightInjectionDate] = useState<string | null>(null);
  // FALL-011: cohort reference overlay toggle (off by default to avoid visual clutter)
  const [showCohortReference, setShowCohortReference] = useState(false);
  const toggleInjectionHighlight = (date: string) =>
    setHighlightInjectionDate((prev) => (prev === date ? null : date));

  // Review M1: highlight state is per-case — clear it when navigating to another
  // case so a highlighted visit/injection date from the previous patient can't leak
  // onto (or render an orphan line in) the next one. Reset during render on caseId
  // change (React-recommended over setState-in-effect) so the cleared state is used
  // in the same render and no cascading effect re-render occurs.
  const [prevCaseId, setPrevCaseId] = useState(caseId);
  if (caseId !== prevCaseId) {
    setPrevCaseId(caseId);
    setHighlightDate(null);
    setHighlightInjectionDate(null);
  }

  const patientCase = cases.find((c) => c.id === caseId);
  const dateFmt = getDateLocale(locale);

  const {
    cohortAvgVisus,
    cohortAvgCrt,
    combinedDataWithReference,
    visusObs,
    crtObs,
    iopObs,
    hba1cObs,
    injections,
    refractionObs,
    anteriorFindings,
    posteriorFindings,
    ophthalmicAnamnesis,
    nonOphthalmicAnamnesis,
    adverseEvents,
    primaryDiagnoses,
    treatmentIndication,
    eyeLaterality,
    diabetesCond,
    crtData,
    visusDistributionWithCohort,
    crtDistributionWithCohort,
    visusCrtScatter,
    cohortVisusCrtScatter,
    baselineData,
    baselineChangeWithReference,
    totalEncounters,
    hasCriticalValues,
    criticalCrtCount,
    criticalVisusCount,
    criticalIopCount,
    octImages,
    encounterTimeline,
    iopDataWithReference,
  } = useCaseData(patientCase, cases, locale, t);

  // L5 (consistency): switch the baseline-change chart to the relative axis only when
  // the cohort overlay is on AND reference rows actually exist — matching VisusCrtChart's
  // guard, so the two stacked charts never disagree (one on a relative axis with no band
  // while the other stays on calendar dates).
  const baselineRelativeAxis =
    showCohortReference &&
    baselineChangeWithReference.some(
      (r) => r.visusChangeMedian != null || r.visusChangeBand != null || r.crtChangeMedian != null || r.crtChangeBand != null,
    );

  // M5 (v1.18): unify the baseline-change legend with VisusCrtChart's custom
  // renderLegend — the IQR band swatch is drawn at the TRUE fill colour +
  // IQR_FILL_OPACITY (not an opaque rect), both the Visus and CRT IQR band entries
  // are shown, and everything else uses a line glyph. Mirrors VisusCrtChart so the
  // two stacked figures read identically.
  const renderBaselineLegend = (props: {
    payload?: ReadonlyArray<{ value?: unknown; color?: string; dataKey?: unknown }>;
  }) => {
    if (!Array.isArray(props.payload)) return null;
    return (
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs mt-1" style={{ color: chartColors.legend }}>
        {props.payload.map((entry, i) => {
          const key = String(entry.dataKey ?? '');
          const isBand = key === 'visusChangeBand' || key === 'crtChangeBand';
          return (
            <li key={`${key}-${i}`} className="flex items-center gap-1.5">
              {isBand ? (
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: 14,
                    height: 10,
                    background: entry.color,
                    opacity: IQR_FILL_OPACITY,
                    border: `1px solid ${entry.color}`,
                  }}
                />
              ) : (
                <span
                  aria-hidden
                  style={{ display: 'inline-block', width: 14, height: 0, borderTop: `2px solid ${entry.color}` }}
                />
              )}
              <span>{String(entry.value ?? '')}</span>
            </li>
          );
        })}
      </ul>
    );
  };

  const handleOctTimelineClick = (octIdx: number) => {
    setOctSelectedIdx(octIdx);
    octViewerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // --- Early return AFTER all hooks ---
  if (!patientCase) {
    return (
      <div className="p-8">
        <p className="text-gray-500 dark:text-gray-400">{t('caseNotFound')}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-blue-600 hover:underline">
          {t('back')}
        </button>
      </div>
    );
  }

  return (
    <div className="p-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> {t('back')}
      </button>

      {/* Patient header (EMDREQ-FALL-002) */}
      <PatientHeader
        pseudonym={patientCase.pseudonym}
        birthDate={patientCase.birthDate}
        gender={patientCase.gender}
        centerName={patientCase.centerName}
        eyeLaterality={eyeLaterality}
        totalEncounters={totalEncounters}
        primaryDiagnoses={primaryDiagnoses}
        treatmentIndication={treatmentIndication}
        adverseEvents={adverseEvents}
        hasCriticalValues={hasCriticalValues}
        criticalCrtCount={criticalCrtCount}
        criticalVisusCount={criticalVisusCount}
        criticalIopCount={criticalIopCount}
        encounterTimeline={encounterTimeline}
        dateFmt={dateFmt}
        locale={locale}
        t={t}
        highlightDate={highlightDate}
        onHighlightDate={setHighlightDate}
        onOctTimelineClick={handleOctTimelineClick}
        highlightInjectionDate={highlightInjectionDate}
        onInjectionClick={toggleInjectionHighlight}
        showCohortReference={showCohortReference}
        onToggleCohortReference={setShowCohortReference}
      />

      {/* Combined chart + injections row */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        <div className="col-span-8">
          {/* M4 (v1.18): the cohort-reference toggle now lives in the patient
              header — it governs ALL case-detail plots, so it is a prominent
              header-level control rather than sitting above one chart. */}
          <VisusCrtChart
            combinedData={combinedDataWithReference}
            cohortAvgVisus={cohortAvgVisus}
            cohortAvgCrt={cohortAvgCrt}
            highlightDate={highlightDate}
            dateFmt={dateFmt}
            locale={locale}
            t={t}
            visusObs={visusObs}
            showCohortReference={showCohortReference}
            injections={injections}
            highlightInjectionDate={highlightInjectionDate}
            onInjectionClick={toggleInjectionHighlight}
          />
        </div>

        <div className="col-span-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 overflow-y-auto" style={{ maxHeight: 380 }}>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Syringe className="w-4 h-4" />
            {t('intravitreal')} ({injections.length})
          </h3>
          {injections.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">{t('noInjections')}</p>
          ) : (
            <div className="space-y-2">
              {(() => {
                const primaryDrug = patientCase?.medications?.[0]?.medicationCodeableConcept?.coding?.[0]?.display;
                return injections.map((inj, i) => {
                  const injDate = inj.performedDateTime?.substring(0, 10) ?? '';
                  const active = !!injDate && highlightInjectionDate === injDate;
                  return (
                  <div
                    key={inj.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={active}
                    onClick={() => injDate && toggleInjectionHighlight(injDate)}
                    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && injDate) { e.preventDefault(); toggleInjectionHighlight(injDate); } }}
                    className={`flex items-center gap-3 p-2 rounded-lg text-sm cursor-pointer transition-colors ${
                      active
                        ? 'bg-amber-50 dark:bg-amber-900/30 ring-1 ring-amber-300'
                        : 'bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="whitespace-nowrap">
                      {inj.performedDateTime ? new Date(inj.performedDateTime).toLocaleDateString(dateFmt) : '\u2014'}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 truncate">{t('intravitralInjection')}</span>
                    {inj.bodySite?.[0] && (
                      <span className="text-xs px-1 py-0.5 bg-indigo-50 text-indigo-600 rounded ml-auto flex-shrink-0">
                        {inj.bodySite[0].coding?.[0]?.code === SNOMED_EYE_RIGHT ? 'OD' : 'OS'}
                      </span>
                    )}
                    {primaryDrug && (
                      <span className="text-xs px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded ml-1 flex-shrink-0 truncate max-w-[100px]" title={primaryDrug}>
                        {primaryDrug}
                      </span>
                    )}
                  </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Relative change from baseline (N05.27) */}
      {baselineData.length > 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            {baselineData[baselineData.length - 1]?.visusChange !== undefined &&
            baselineData[baselineData.length - 1].visusChange! >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600" />
            )}
            {t('baselineChange')}
            {/* K-bl1 + M13: explain the per-metric baseline change plot; when the
                cohort overlay is active, append the overlay note (IQR band +
                relative-time alignment), mirroring VisusCrtChart's L10 note. */}
            <InfoTooltip
              text={
                baselineRelativeAxis
                  ? `${t('baselineChangePlotInfo')} ${t('cohortOverlayInfoVisusCrt')}`
                  : t('baselineChangePlotInfo')
              }
            />
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            {/* L5: dynamic X axis tied to the cohort-overlay toggle — calendar-date
                axis when off, relative "Monate seit Erstvisite" axis when on, so the
                relative-time-aligned cohort change band shares the patient's axis.
                J3d: cohort change-from-baseline overlay (median + IQR), aggregated
                by relative time since each peer's own baseline. ComposedChart so the
                IQR Areas render alongside the lines. K-bl2: each metric's %-change
                is anchored to its OWN baseline. L11b: theme-aware chart colours. */}
            <ComposedChart data={baselineChangeWithReference}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              {baselineRelativeAxis ? (
                <XAxis
                  dataKey="relMonths"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(m: number) => String(m)}
                  tick={{ fontSize: 10, fill: chartColors.axisTick }}
                  stroke={chartColors.grid}
                  label={{ value: t('relativeMonthsAxisLabel'), position: 'insideBottom', offset: -2, fontSize: 10, fill: chartColors.axisLabel }}
                />
              ) : (
                <XAxis
                  dataKey="dateMs"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(ms: number) => (ms ? new Date(ms).toLocaleDateString(dateFmt, { month: '2-digit', year: '2-digit' }) : '')}
                  tick={{ fontSize: 10, fill: chartColors.axisTick }}
                  stroke={chartColors.grid}
                />
              )}
              <YAxis tick={{ fontSize: 10, fill: chartColors.axisTick }} stroke={chartColors.grid} label={{ value: '%', position: 'insideLeft', fontSize: 11, fill: chartColors.axisLabel }} />
              {/* L4c: custom tooltip whitelisting the measured changes + cohort
                  medians (numbers only) so the IQR band tuples (visusChangeBand /
                  crtChangeBand = [p25,p75]) never leak into the tooltip as raw
                  "12,14" strings — mirrors the VisusCrtChart tooltip. */}
              <Tooltip content={(props: {
                active?: boolean;
                payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown; color?: string; payload?: { date?: string; relMonths?: number } }>;
              }) => {
                if (!props.active || !Array.isArray(props.payload) || props.payload.length === 0) return null;
                const names: Record<string, string> = {
                  visusChange: 'Visus %',
                  crtChange: 'CRT %',
                  visusChangeMedian: t('cohortReferenceMedianChange'),
                  crtChangeMedian: t('cohortReferenceMedianChange'),
                };
                const rows: Array<{ key: string; name: string; color?: string; text: string }> = [];
                for (const e of props.payload) {
                  const key = String(e.dataKey ?? '');
                  if (typeof e.value !== 'number' || !(key in names)) continue;
                  rows.push({ key, name: names[key], color: e.color, text: `${e.value}%` });
                }
                if (rows.length === 0) return null;
                const ref = props.payload.find((e) => e.payload)?.payload;
                const label = baselineRelativeAxis
                  ? (ref?.relMonths != null ? `${ref.relMonths} ${t('relativeMonthsAxisLabel')}` : '')
                  : (ref?.date ? new Date(ref.date).toLocaleDateString(dateFmt) : '');
                return (
                  <div className="rounded-lg shadow-lg px-3 py-2 text-xs border" style={{ background: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder }}>
                    {label && <div className="font-semibold mb-1" style={{ color: chartColors.tooltipHeading }}>{label}</div>}
                    {rows.map((r) => (
                      <div key={r.key} style={{ color: chartColors.tooltipText }}>
                        <span style={{ color: r.color }}>{r.name}</span>: {r.text}
                      </div>
                    ))}
                  </div>
                );
              }} />
              {/* M5: unified custom legend (IQR band swatch at true fill colour). */}
              <Legend content={renderBaselineLegend} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
              {/* FALL-003 / L5 / M6: synchronise the event highlight on the active
                  axis — relMonths on the relative axis, epoch-ms on the linear
                  calendar-time axis. */}
              {highlightDate && (() => {
                const refRow = baselineChangeWithReference.find((r) => r.date === highlightDate);
                const hx = baselineRelativeAxis ? refRow?.relMonths : refRow?.dateMs;
                if (hx == null) return null;
                return (
                  <ReferenceLine
                    x={hx}
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    label={{ value: new Date(highlightDate).toLocaleDateString(dateFmt), position: 'top', fontSize: 10, fill: '#f59e0b' }}
                  />
                );
              })()}
              {showCohortReference && (
                <>
                  {/* M5: both IQR bands carry a name + legendType="rect" so the
                      unified legend shows a Visus AND a CRT band entry (the CRT
                      band was previously legendType="none"), and the fill opacity
                      matches VisusCrtChart (IQR_FILL_OPACITY) so the swatch is
                      faithful across both figures. */}
                  <Area
                    type="monotone"
                    dataKey="visusChangeBand"
                    stroke="none"
                    fill="#10b981"
                    fillOpacity={IQR_FILL_OPACITY}
                    name={t('cohortReferenceBandVisusChange')}
                    legendType="rect"
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="crtChangeBand"
                    stroke="none"
                    fill="#8b5cf6"
                    fillOpacity={IQR_FILL_OPACITY}
                    name={t('cohortReferenceBandCrtChange')}
                    legendType="rect"
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Line type="monotone" dataKey="visusChangeMedian" stroke="#6ee7b7" strokeWidth={1.5} strokeDasharray="4 3" name={t('cohortReferenceMedianVisusChange')} dot={false} connectNulls />
                  <Line type="monotone" dataKey="crtChangeMedian" stroke="#c4b5fd" strokeWidth={1.5} strokeDasharray="4 3" name={t('cohortReferenceMedianCrtChange')} dot={false} connectNulls />
                </>
              )}
              <Line type="monotone" dataKey="visusChange" stroke="#10b981" name="Visus %" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="crtChange" stroke="#8b5cf6" name="CRT %" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* N05.31/N05.32: Value distribution histograms + N05.35: Parameter correlation */}
      {(visusObs.length > 2 || crtObs.length > 2) && (
        <DistributionCharts
          visusDistribution={visusDistributionWithCohort}
          crtDistribution={crtDistributionWithCohort}
          visusCrtScatter={visusCrtScatter}
          cohortVisusCrtScatter={cohortVisusCrtScatter}
          showCohortReference={showCohortReference}
          t={t}
        />
      )}

      {/* Clinical parameters row: IOP + Refraction + HbA1c */}
      <ClinicalParametersRow
        iopObs={iopObs}
        iopData={iopDataWithReference}
        showCohortReference={showCohortReference}
        refractionObs={refractionObs}
        hba1cObs={hba1cObs}
        diabetesCond={diabetesCond}
        eyeLaterality={eyeLaterality}
        dateFmt={dateFmt}
        locale={locale}
        t={t}
      />

      {/* Anamnesis + Findings + Adverse Events */}
      <AnamnesisFindings
        ophthalmicAnamnesis={ophthalmicAnamnesis}
        nonOphthalmicAnamnesis={nonOphthalmicAnamnesis}
        anteriorFindings={anteriorFindings}
        posteriorFindings={posteriorFindings}
        adverseEvents={adverseEvents}
        dateFmt={dateFmt}
        locale={locale}
        t={t}
      />

      {/* Medication card (EMDREQ-FALL-004) */}
      <MedicationCard
        medications={patientCase.medications}
        dateFmt={dateFmt}
        t={t}
      />

      {/* OCT Viewer */}
      <div ref={octViewerRef}>
        <OctViewer
          images={octImages}
          crt={crtData.map((d) => ({ date: d.date, value: d.crt }))}
          controlledIdx={octSelectedIdx}
          onSelectIdx={setOctSelectedIdx}
        />
      </div>
    </div>
  );
}
