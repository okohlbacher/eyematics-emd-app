/** Case detail page — EMDREQ-FALL-001 to FALL-006 (single case analysis, clinical parameters, cohort comparison). */
import { ArrowLeft, Syringe, TrendingDown, TrendingUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate,useParams } from 'react-router-dom';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

  const patientCase = cases.find((c) => c.id === caseId);
  const dateFmt = getDateLocale(locale);

  const {
    cohortAvgVisus,
    cohortAvgCrt,
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
    combinedData,
    visusDistribution,
    crtDistribution,
    visusCrtScatter,
    baselineData,
    totalEncounters,
    hasCriticalValues,
    criticalCrtCount,
    criticalVisusCount,
    criticalIopCount,
    octImages,
    encounterTimeline,
    iopData,
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
          <VisusCrtChart
            combinedData={combinedData}
            cohortAvgVisus={cohortAvgVisus}
            cohortAvgCrt={cohortAvgCrt}
            highlightDate={highlightDate}
            dateFmt={dateFmt}
            locale={locale}
            t={t}
            visusObs={visusObs}
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
              {injections.map((inj, i) => (
                <div key={inj.id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm">
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
                </div>
              ))}
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
            <LineChart data={baselineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} label={{ value: '%', position: 'insideLeft', fontSize: 11 }} />
              <Tooltip formatter={(v: unknown) => typeof v === 'number' ? `${v}%` : String(v)} />
              <Legend />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="visusChange" stroke="#10b981" name="Visus %" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="crtChange" stroke="#8b5cf6" name="CRT %" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* N05.31/N05.32: Value distribution histograms + N05.35: Parameter correlation */}
      {(visusObs.length > 2 || crtObs.length > 2) && (
        <DistributionCharts
          visusDistribution={visusDistribution}
          crtDistribution={crtDistribution}
          visusCrtScatter={visusCrtScatter}
          t={t}
        />
      )}

      {/* Clinical parameters row: IOP + Refraction + HbA1c */}
      <ClinicalParametersRow
        iopObs={iopObs}
        iopData={iopData}
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
