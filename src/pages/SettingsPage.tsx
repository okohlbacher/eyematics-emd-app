import { CheckCircle, Download, Loader2, RotateCcw, Save, Server, Settings as SettingsIcon, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { MessageSquarePlus } from 'lucide-react';
import { useEffect,useState } from 'react';

import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import {
  type DataSourceType,
  testBlazeConnection,
} from '../services/dataSource';
import { invalidateBundleCache } from '../services/fhirLoader';
import { deleteAllIssues, exportIssuesFull, getIssueCount } from '../services/issueService';
import {
  exportSettingsYaml,
  loadSettings,
  resetSettings,
  updateSettings,
} from '../services/settingsService';
import { downloadYaml } from '../utils/download';

type ConnectionStatus = 'idle' | 'testing' | 'ok' | 'failed';

export default function SettingsPage() {
  const { t } = useLanguage();
  const { reloadData } = useData();

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [interrupterDays, setInterrupterDays] = useState(120);
  const [breakerDays, setBreakerDays] = useState(365);
  const [savedBanner, setSavedBanner] = useState(false);
  const [validationError, setValidationError] = useState(false);

  // Data source state
  const [dataSourceType, setDataSourceType] = useState<DataSourceType>('local');
  const [blazeUrl, setBlazeUrl] = useState('http://localhost:8080/fhir');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [connectionDetail, setConnectionDetail] = useState('');
  const [issueCount, setIssueCount] = useState(0);

  useEffect(() => {
    // Load issue count from server
    getIssueCount().then(setIssueCount).catch(() => {});
    // Load settings from YAML + localStorage on mount
    loadSettings().then((s) => {
      setTwoFactorEnabled(s.twoFactorEnabled);
      setInterrupterDays(s.therapyInterrupterDays);
      setBreakerDays(s.therapyBreakerDays);
      setDataSourceType(s.dataSource.type);
      setBlazeUrl(s.dataSource.blazeUrl);
    });
  }, []);

  const handleDeleteAllIssues = async () => {
    const msg = t('feedbackDeleteConfirm').replace('{0}', String(issueCount));
    if (!window.confirm(msg)) return;
    await deleteAllIssues();
    setIssueCount(0);
  };

  const validate = (interrupter: number, breaker: number): boolean => {
    return interrupter > 0 && breaker > 0 && interrupter < breaker;
  };

  const showSaved = () => {
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 3000);
  };

  const handleSave = () => {
    if (!validate(interrupterDays, breakerDays)) {
      setValidationError(true);
      return;
    }
    setValidationError(false);
    updateSettings({
      twoFactorEnabled,
      therapyInterrupterDays: interrupterDays,
      therapyBreakerDays: breakerDays,
      dataSource: { type: dataSourceType, blazeUrl },
    });
    showSaved();
  };

  const handleReset = async () => {
    const defaults = await resetSettings();
    setTwoFactorEnabled(defaults.twoFactorEnabled);
    setInterrupterDays(defaults.therapyInterrupterDays);
    setBreakerDays(defaults.therapyBreakerDays);
    setDataSourceType(defaults.dataSource.type);
    setBlazeUrl(defaults.dataSource.blazeUrl);
    setValidationError(false);
    showSaved();
  };

  const handleInterrupterChange = (value: string) => {
    const parsed = parseInt(value, 10);
    setInterrupterDays(isNaN(parsed) ? 0 : parsed);
    setValidationError(false);
  };

  const handleBreakerChange = (value: string) => {
    const parsed = parseInt(value, 10);
    setBreakerDays(isNaN(parsed) ? 0 : parsed);
    setValidationError(false);
  };

  const handleTwoFactorToggle = () => {
    const next = !twoFactorEnabled;
    setTwoFactorEnabled(next);
    updateSettings({ twoFactorEnabled: next });
    showSaved();
  };

  const handleDataSourceTypeChange = (type: DataSourceType) => {
    setDataSourceType(type);
    setConnectionStatus('idle');
    setConnectionDetail('');
    updateSettings({ dataSource: { type, blazeUrl: type === 'blaze' ? blazeUrl : '' } });
    invalidateBundleCache();
    reloadData();
  };

  const handleBlazeUrlChange = (url: string) => {
    setBlazeUrl(url);
    setConnectionStatus('idle');
    setConnectionDetail('');
  };

  const handleBlazeUrlCommit = () => {
    updateSettings({ dataSource: { type: 'blaze', blazeUrl } });
    invalidateBundleCache();
    reloadData();
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setConnectionDetail('');
    try {
      const detail = await testBlazeConnection(blazeUrl);
      setConnectionStatus('ok');
      setConnectionDetail(detail);
    } catch (err) {
      setConnectionStatus('failed');
      setConnectionDetail(err instanceof Error ? err.message : String(err));
    }
  };

  const handleExportYaml = () => {
    const yamlStr = exportSettingsYaml();
    downloadYaml(yamlStr, 'settings.yaml');
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-gray-500" />
            {t('settingsTitle')}
          </h1>
          <p className="text-gray-500 mt-1">{t('settingsSubtitle')}</p>
        </div>
        <button
          onClick={handleExportYaml}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Download className="w-4 h-4" />
          {t('settingsExportYaml')}
        </button>
      </div>

      {/* Success banner */}
      {savedBanner && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm font-medium">
          <Save className="w-4 h-4 shrink-0" />
          {t('settingsSaved')}
        </div>
      )}

      {/* Two-Factor Authentication */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-gray-500" />
          {t('settings2faTitle')}
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">{t('settings2faLabel')}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('settings2faHint')}</p>
          </div>
          <button
            onClick={handleTwoFactorToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
              twoFactorEnabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
            role="switch"
            aria-checked={twoFactorEnabled}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {!twoFactorEnabled && (
          <p className="text-xs text-amber-600 font-medium">
            {t('settings2faWarning')}
          </p>
        )}
      </div>

      {/* Therapy Discontinuation Thresholds */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
        <h2 className="text-lg font-semibold text-gray-900">{t('settingsTherapy')}</h2>

        {/* Therapy Interrupter */}
        <div className="space-y-1.5">
          <label htmlFor="interrupter-days" className="block text-sm font-medium text-gray-700">
            {t('settingsInterrupterDays')}
            <span className="ml-1 font-mono text-blue-600">(t)</span>
          </label>
          <input
            id="interrupter-days"
            type="number"
            min={1}
            value={interrupterDays}
            onChange={(e) => handleInterrupterChange(e.target.value)}
            className={`w-full max-w-xs border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              validationError ? 'border-red-400 bg-red-50' : 'border-gray-300'
            }`}
          />
          <p className="text-xs text-gray-500">{t('settingsInterrupterHint')}</p>
        </div>

        {/* Therapy Breaker */}
        <div className="space-y-1.5">
          <label htmlFor="breaker-days" className="block text-sm font-medium text-gray-700">
            {t('settingsBreakerDays')}
            <span className="ml-1 font-mono text-blue-600">(t&apos;)</span>
          </label>
          <input
            id="breaker-days"
            type="number"
            min={1}
            value={breakerDays}
            onChange={(e) => handleBreakerChange(e.target.value)}
            className={`w-full max-w-xs border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              validationError ? 'border-red-400 bg-red-50' : 'border-gray-300'
            }`}
          />
          <p className="text-xs text-gray-500">{t('settingsBreakerHint')}</p>
        </div>

        {validationError && (
          <p className="text-sm text-red-600 font-medium">{t('settingsValidationError')}</p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
          >
            <Save className="w-4 h-4" />
            {t('save')}
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            {t('settingsReset')}
          </button>
        </div>
      </div>

      {/* Data Source */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Server className="w-5 h-5 text-gray-500" />
          {t('settingsDataSource')}
        </h2>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="data-source-type"
              value="local"
              checked={dataSourceType === 'local'}
              onChange={() => handleDataSourceTypeChange('local')}
              className="accent-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">{t('settingsDataSourceLocal')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="data-source-type"
              value="blaze"
              checked={dataSourceType === 'blaze'}
              onChange={() => handleDataSourceTypeChange('blaze')}
              className="accent-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">{t('settingsDataSourceBlaze')}</span>
          </label>
        </div>

        {dataSourceType === 'blaze' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="blaze-url" className="block text-sm font-medium text-gray-700">
                {t('settingsDataSourceUrl')}
              </label>
              <input
                id="blaze-url"
                type="url"
                value={blazeUrl}
                onChange={(e) => handleBlazeUrlChange(e.target.value)}
                onBlur={handleBlazeUrlCommit}
                placeholder="http://localhost:8080/fhir"
                className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => { void handleTestConnection(); }}
                disabled={connectionStatus === 'testing'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {connectionStatus === 'testing' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Server className="w-4 h-4" />
                )}
                {t('settingsTestConnection')}
              </button>
              {connectionStatus === 'ok' && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  {t('settingsConnectionOk')}
                  {connectionDetail && <span className="font-normal text-green-600 ml-1">— {connectionDetail}</span>}
                </span>
              )}
              {connectionStatus === 'failed' && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-700">
                  <XCircle className="w-4 h-4 shrink-0" />
                  {t('settingsConnectionFailed')}
                  {connectionDetail && <span className="font-normal text-red-600 ml-1">— {connectionDetail}</span>}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reported Issues Export */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquarePlus className="w-5 h-5 text-amber-500" />
          {t('feedbackExport')}
        </h2>
        <p className="text-sm text-gray-500">
          {t('feedbackCount').replace('{0}', String(issueCount))}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={exportIssuesFull}
            disabled={issueCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            {t('feedbackExport')}
          </button>
          <button
            onClick={handleDeleteAllIssues}
            disabled={issueCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {t('feedbackDeleteAll')}
          </button>
        </div>
      </div>

      {/* Settings file hint */}
      <p className="text-xs text-gray-400 text-center">
        {t('settingsFileHint')}
      </p>
    </div>
  );
}
