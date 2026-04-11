/** Cohort builder page — EMDREQ-KOH-001 to KOH-007, EMDREQ-QUAL-009/010 (filters, saved searches, therapy discontinuation). */
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  Play,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { useMemo,useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import {
  applyFilters,
  getAge,
  getDiagnosisFullText,
  getDiagnosisLabel,
  getLatestObservation,
  LOINC_CRT,
  LOINC_VISUS,
  SNOMED_AMD,
  SNOMED_DR,
} from '../services/fhirLoader';
import type { CohortFilter, SavedSearch } from '../types/fhir';
import { formatDate } from '../utils/dateFormat';
import { datedFilename,downloadCsv, downloadJson } from '../utils/download';

type SortField = 'date' | 'name';

export default function CohortBuilderPage() {
  const { activeCases, centers, savedSearches, addSavedSearch, removeSavedSearch } =
    useData();
  const navigate = useNavigate();
  const { locale, t } = useLanguage();

  const [filters, setFilters] = useState<CohortFilter>({});
  const [showSaved, setShowSaved] = useState(false);
  const [saveName, setSaveName] = useState('');

  const [savedSort, setSavedSort] = useState<SortField>('date');

  // Text state for visus inputs (allows typing decimals with comma or dot)
  const [visusMinText, setVisusMinText] = useState('');
  const [visusMaxText, setVisusMaxText] = useState('');

  const filteredCases = useMemo(() => applyFilters(activeCases, filters), [activeCases, filters]);

  const handleSave = () => {
    if (!saveName.trim()) return;
    const s: SavedSearch = {
      id: crypto.randomUUID(),
      name: saveName.trim(),
      createdAt: new Date().toISOString(),
      filters: { ...filters },
    };
    addSavedSearch(s);
    setSaveName('');
  };

  const handleLoadSearch = (s: SavedSearch) => {
    setFilters(s.filters);
    setShowSaved(false);
  };

  // K08 N08.01: Dataset download
  const handleExportCsv = () => {
    const headers = ['Pseudonym', 'Gender', 'Age', 'Diagnosis', 'Visus', 'CRT (µm)', 'Center'];
    const rows = filteredCases.map((c) => {
      const latestVisus = getLatestObservation(c.observations, LOINC_VISUS);
      const latestCrt = getLatestObservation(c.observations, LOINC_CRT);
      const diagCodes = c.conditions.flatMap((cond) => cond.code.coding.map((cd) => cd.code));
      return [
        c.pseudonym,
        c.gender,
        String(getAge(c.birthDate)),
        diagCodes.map((code) => getDiagnosisLabel(code, locale)).join('; '),
        latestVisus?.valueQuantity?.value?.toFixed(2) ?? '',
        String(latestCrt?.valueQuantity?.value ?? ''),
        c.centerName,
      ];
    });
    downloadCsv(headers, rows, datedFilename('cohort-export', 'csv'));
  };

  const handleExportJson = () => {
    const data = filteredCases.map((c) => ({
      pseudonym: c.pseudonym,
      gender: c.gender,
      birthDate: c.birthDate,
      centerId: c.centerId,
      centerName: c.centerName,
      conditions: c.conditions,
      observations: c.observations,
      procedures: c.procedures,
      medications: c.medications,
    }));
    downloadJson(data, datedFilename('cohort-export', 'json'));
  };

  const diagnoses = [
    { code: SNOMED_AMD, label: t('diagnosisAMD') },
    { code: SNOMED_DR, label: t('diagnosisDR') },
  ];

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('cohortTitle')}</h1>
          <p className="text-gray-500 mt-1">
            {t('cohortSubtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowSaved(!showSaved)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <Search className="w-4 h-4" />
          {t('savedSearches')} ({savedSearches.length})
          {showSaved ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
      </div>

      {/* Saved searches panel */}
      {showSaved && savedSearches.length > 0 && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              {t('savedSearchDefs')}
            </h3>
            <button
              onClick={() => setSavedSort(savedSort === 'date' ? 'name' : 'date')}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
              title={savedSort === 'date' ? t('sortByName') : t('sortByDate')}
            >
              <ArrowUpDown className="w-3 h-3" />
              {savedSort === 'date' ? t('sortByDate') : t('sortByName')}
            </button>
          </div>
          <div className="space-y-2">
            {[...savedSearches]
              .sort((a, b) =>
                savedSort === 'name'
                  ? a.name.localeCompare(b.name)
                  : b.createdAt.localeCompare(a.createdAt)
              )
              .map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(s.createdAt, locale)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleLoadSearch(s)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                    title={t('execute')}
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeSavedSearch(s.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                    title={t('delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Filter panel */}
        <div className="col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              {t('filterCriteria')}
            </h3>

            {/* Diagnosis */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('diagnosis')}
              </label>
              {diagnoses.map((d) => (
                <label
                  key={d.code}
                  className="flex items-center gap-2 mb-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={filters.diagnosis?.includes(d.code) ?? false}
                    onChange={(e) => {
                      const current = filters.diagnosis ?? [];
                      setFilters({
                        ...filters,
                        diagnosis: e.target.checked
                          ? [...current, d.code]
                          : current.filter((c) => c !== d.code),
                      });
                    }}
                    className="rounded border-gray-300"
                  />
                  {d.label}
                </label>
              ))}
            </div>

            {/* Gender */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('gender')}
              </label>
              {['female', 'male'].map((g) => (
                <label
                  key={g}
                  className="flex items-center gap-2 mb-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={filters.gender?.includes(g) ?? false}
                    onChange={(e) => {
                      const current = filters.gender ?? [];
                      setFilters({
                        ...filters,
                        gender: e.target.checked
                          ? [...current, g]
                          : current.filter((c) => c !== g),
                      });
                    }}
                    className="rounded border-gray-300"
                  />
                  {g === 'female' ? t('female') : t('male')}
                </label>
              ))}
            </div>

            {/* Centers */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('centers')}
              </label>
              {centers.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 mb-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={filters.centers?.includes(c.id) ?? false}
                    onChange={(e) => {
                      const current = filters.centers ?? [];
                      setFilters({
                        ...filters,
                        centers: e.target.checked
                          ? [...current, c.id]
                          : current.filter((x) => x !== c.id),
                      });
                    }}
                    className="rounded border-gray-300"
                  />
                  {c.name}
                </label>
              ))}
            </div>

            {/* Age range */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('ageYears')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.ageRange?.[0] ?? ''}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      ageRange: [
                        Number(e.target.value) || 0,
                        filters.ageRange?.[1] ?? 120,
                      ],
                    })
                  }
                  className="w-20 px-2 py-1.5 border rounded text-sm"
                />
                <span className="text-gray-400">—</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.ageRange?.[1] ?? ''}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      ageRange: [
                        filters.ageRange?.[0] ?? 0,
                        Number(e.target.value) || 120,
                      ],
                    })
                  }
                  className="w-20 px-2 py-1.5 border rounded text-sm"
                />
              </div>
            </div>

            {/* Visus range */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('visusDecimal')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,0"
                  value={visusMinText}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setVisusMinText(raw);
                    if (raw === '' || raw === '.' || raw === ',') {
                      setFilters((f) => { const { visusRange: _, ...rest } = f; return rest; });
                      return;
                    }
                    const v = parseFloat(raw.replace(',', '.'));
                    if (!isNaN(v)) {
                      setFilters((f) => ({ ...f, visusRange: [v, f.visusRange?.[1] ?? 2] }));
                    }
                  }}
                  className="w-20 px-2 py-1.5 border rounded text-sm"
                />
                <span className="text-gray-400">—</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="1,0"
                  value={visusMaxText}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setVisusMaxText(raw);
                    if (raw === '' || raw === '.' || raw === ',') {
                      setFilters((f) => { const { visusRange: _, ...rest } = f; return rest; });
                      return;
                    }
                    const v = parseFloat(raw.replace(',', '.'));
                    if (!isNaN(v)) {
                      setFilters((f) => ({ ...f, visusRange: [f.visusRange?.[0] ?? 0, v] }));
                    }
                  }}
                  className="w-20 px-2 py-1.5 border rounded text-sm"
                />
              </div>
            </div>

            {/* CRT range */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('retinalThickness')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.crtRange?.[0] ?? ''}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      crtRange: [
                        Number(e.target.value) || 0,
                        filters.crtRange?.[1] ?? 800,
                      ],
                    })
                  }
                  className="w-20 px-2 py-1.5 border rounded text-sm"
                />
                <span className="text-gray-400">—</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.crtRange?.[1] ?? ''}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      crtRange: [
                        filters.crtRange?.[0] ?? 0,
                        Number(e.target.value) || 800,
                      ],
                    })
                  }
                  className="w-20 px-2 py-1.5 border rounded text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setFilters({})}
                className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {t('reset')}
              </button>
            </div>

            {/* Save search */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t('searchNamePlaceholder')}
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm"
                />
                <button
                  onClick={handleSave}
                  disabled={!saveName.trim()}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  {t('save')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="col-span-8">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {t('cohortCases')}: {filteredCases.length} {t('cases')}
                </h3>
                <p className="text-sm text-gray-500">
                  {t('of')} {activeCases.length} {t('totalCases')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* K08 N08.01: Dataset download */}
                <button
                  onClick={handleExportCsv}
                  disabled={filteredCases.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  title={t('downloadCsv')}
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>
                <button
                  onClick={handleExportJson}
                  disabled={filteredCases.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  title={t('downloadJson')}
                >
                  <Download className="w-4 h-4" />
                  JSON
                </button>
                <button
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.set('filters', JSON.stringify(filters));
                    navigate(`/analysis?${params.toString()}`);
                  }}
                  disabled={filteredCases.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {t('analyzeCohort')}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('pseudonym')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('gender')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t('age')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('diagnosis')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t('visus')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      CRT (µm)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('center')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCases.map((c) => {
                    const latestVisus = getLatestObservation(
                      c.observations,
                      LOINC_VISUS
                    );
                    const latestCrt = getLatestObservation(
                      c.observations,
                      LOINC_CRT
                    );
                    const diagCodes = c.conditions.flatMap((cond) =>
                      cond.code.coding.map((cd) => cd.code)
                    );
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-blue-50 cursor-pointer"
                        onClick={() => navigate(`/case/${c.id}`)}
                      >
                        <td className="px-4 py-3 font-mono text-sm text-blue-600">
                          {c.pseudonym}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {c.gender === 'female' ? t('femaleShort') : t('maleShort')}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {getAge(c.birthDate)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {diagCodes.map((code, i) => (
                            <span key={code} title={getDiagnosisFullText(code, locale)} className="cursor-help border-b border-dotted border-gray-400">
                              {i > 0 ? ', ' : ''}{getDiagnosisLabel(code, locale)}
                            </span>
                          ))}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono">
                          {latestVisus?.valueQuantity?.value?.toFixed(2) ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono">
                          {latestCrt?.valueQuantity?.value ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {c.centerName}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
