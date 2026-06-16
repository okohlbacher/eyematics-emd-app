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
import ClinicalParametersRow from '../components/case-detail/ClinicalParametersRow';
import DistributionCharts from '../components/case-detail/DistributionCharts';
import MedicationCard from '../components/case-detail/MedicationCard';
import PatientHeader from '../components/case-detail/PatientHeader';
import VisusCrtChart from '../components/case-detail/VisusCrtChart';
import OctViewer from '../components/OctViewer';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { useCaseData } from '../hooks/useCaseData';
import { SNOMED_EYE_RIGHT } from '../services/fhirLoader';
import { getDateLocale } from '../utils/dateFormat';

export default function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { cases } = useData();
  const navigate = useNavigate();
  const { locale, t } = useLanguage();

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

  const patientCase = cases.find((c) => c.id === caseId);
  const dateFmt = getDateLocale(locale);

  const {
    cohortAvgVisus,
    cohortAvgCrt,
    combinedDataWithReference,
    hasInterpolatedPoints,
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
      />

      {/* Combined chart + injections row */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        <div className="col-span-8">
          {/* FALL-011: cohort reference overlay toggle */}
          <div className="flex justify-end mb-1">
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-3.5 h-3.5 cursor-pointer"
                checked={showCohortReference}
                onChange={(e) => setShowCohortReference(e.target.checked)}
                aria-label={t('cohortReferenceToggle')}
              />
              {t('cohortReferenceToggle')}
            </label>
          </div>
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
            hasInterpolatedPoints={hasInterpolatedPoints}
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
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            {/* K3c (revert of v1.15-p5): calendar-date X axis. J3d: cohort
                change-from-baseline overlay (median + IQR), aggregated by relative
                time since each peer's own baseline but mapped onto the patient's
                dates upstream; gated on the same "Kohorten-Referenz anzeigen"
                toggle. ComposedChart so the IQR Areas render alongside the lines.
                K-bl2: each metric's %-change is now anchored to its OWN baseline. */}
            <ComposedChart data={baselineChangeWithReference}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => (d ? new Date(d).toLocaleDateString(dateFmt, { month: '2-digit', year: '2-digit' }) : '')}
                tick={{ fontSize: 10 }}
              />
              <YAxis tick={{ fontSize: 10 }} label={{ value: '%', position: 'insideLeft', fontSize: 11 }} />
              <Tooltip formatter={(v: unknown) => typeof v === 'number' ? `${v}%` : String(v)} />
              <Legend />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
              {/* FALL-003: synchronise event highlight on the calendar-date axis */}
              {highlightDate && (
                <ReferenceLine
                  x={highlightDate}
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  label={{ value: new Date(highlightDate).toLocaleDateString(dateFmt), position: 'top', fontSize: 10, fill: '#f59e0b' }}
                />
              )}
              {showCohortReference && (
                <>
                  <Area
                    type="monotone"
                    dataKey="visusChangeBand"
                    stroke="none"
                    fill="#10b981"
                    fillOpacity={0.12}
                    name={t('cohortReferenceBand')}
                    legendType="rect"
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="crtChangeBand"
                    stroke="none"
                    fill="#8b5cf6"
                    fillOpacity={0.12}
                    legendType="none"
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Line type="monotone" dataKey="visusChangeMedian" stroke="#6ee7b7" strokeWidth={1.5} strokeDasharray="4 3" name={t('cohortReferenceMedianChange')} dot={false} connectNulls />
                  <Line type="monotone" dataKey="crtChangeMedian" stroke="#c4b5fd" strokeWidth={1.5} strokeDasharray="4 3" legendType="none" dot={false} connectNulls />
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
