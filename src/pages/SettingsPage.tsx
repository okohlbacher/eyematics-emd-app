import { CheckCircle, Download, KeyRound, Loader2, RotateCcw, Save, Server, Settings as SettingsIcon, ShieldCheck,XCircle } from 'lucide-react';
import { MessageSquarePlus } from 'lucide-react';
import { useEffect,useState } from 'react';

import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { authFetch } from '../services/authHeaders';
import {
  type DataSourceType,
  testBlazeConnection,
} from '../services/dataSource';
import { invalidateBundleCache } from '../services/fhirLoader';
import { exportIssuesFull,getIssueCount } from '../services/issueService';
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState(false);

  // Per-user TOTP state (SEC-15)
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpQr, setTotpQr] = useState<string | null>(null);
  const [totpRecovery, setTotpRecovery] = useState<string[] | null>(null);
  const [totpOtp, setTotpOtp] = useState('');
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpError, setTotpError] = useState('');

  // Data source state
  const [dataSourceType, setDataSourceType] = useState<DataSourceType>('local');
  const [blazeUrl, setBlazeUrl] = useState('http://localhost:8080/fhir');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [connectionDetail, setConnectionDetail] = useState('');
  const [issueCount, setIssueCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Load issue count from server (fire-and-forget tolerated failure)
      try {
        const n = await getIssueCount();
        if (!cancelled) setIssueCount(n);
      } catch {
        /* ignore */
      }
      // Load settings from YAML + localStorage on mount
      try {
        const s = await loadSettings();
        if (cancelled) return;
        setTwoFactorEnabled(s.twoFactorEnabled);
        setInterrupterDays(s.therapyInterrupterDays);
        setBreakerDays(s.therapyBreakerDays);
        setDataSourceType(s.dataSource.type);
        setBlazeUrl(s.dataSource.blazeUrl);
      } catch {
        /* ignore — keep defaults */
      }
      // Load current per-user TOTP enrollment status
      try {
        const r = await authFetch('/api/auth/totp/status');
        const s = r.ok ? ((await r.json()) as { totpEnabled: boolean }) : null;
        if (!cancelled && s) setTotpEnabled(Boolean(s.totpEnabled));
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleTotpEnroll = async () => {
    setTotpBusy(true); setTotpError('');
    try {
      const r = await authFetch('/api/auth/totp/enroll', { method: 'POST' });
      if (!r.ok) { setTotpError(t('totpErrorGeneric')); return; }
      const body = await r.json() as { qrDataUrl: string; recoveryCodes: string[] };
      setTotpQr(body.qrDataUrl);
      setTotpRecovery(body.recoveryCodes);
      setTotpOtp('');
    } finally {
      setTotpBusy(false);
    }
  };

  const handleTotpConfirm = async () => {
    if (!/^\d{6}$/.test(totpOtp.trim())) { setTotpError(t('totpErrorInvalidOtp')); return; }
    setTotpBusy(true); setTotpError('');
    try {
      const r = await authFetch('/api/auth/totp/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: totpOtp.trim() }),
      });
      if (!r.ok) { setTotpError(t('totpErrorInvalidOtp')); return; }
      setTotpEnabled(true);
      setTotpQr(null);
      setTotpOtp('');
      showSaved();
    } finally {
      setTotpBusy(false);
    }
  };

  const handleTotpDisable = async () => {
    if (!totpOtp.trim()) { setTotpError(t('totpErrorNeedOtp')); return; }
    setTotpBusy(true); setTotpError('');
    try {
      const r = await authFetch('/api/auth/totp/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: totpOtp.trim() }),
      });
      if (!r.ok) { setTotpError(t('totpErrorInvalidOtp')); return; }
      setTotpEnabled(false);
      setTotpOtp('');
      setTotpRecovery(null);
      showSaved();
    } finally {
      setTotpBusy(false);
    }
  };

  const validate = (interrupter: number, breaker: number): boolean => {
    return interrupter > 0 && breaker > 0 && interrupter < breaker;
  };

  const showSaved = () => {
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 3000);
  };

  const handleSave = async () => {
    if (!validate(interrupterDays, breakerDays)) {
      setValidationError(true);
      return;
    }
    setValidationError(false);
    setSaveError(null);
    setSaving(true);
    try {
      await updateSettings({
        twoFactorEnabled,
        therapyInterrupterDays: interrupterDays,
        therapyBreakerDays: breakerDays,
        dataSource: { type: dataSourceType, blazeUrl },
      });
      showSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('settingsSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const defaults = await resetSettings();
      setTwoFactorEnabled(defaults.twoFactorEnabled);
      setInterrupterDays(defaults.therapyInterrupterDays);
      setBreakerDays(defaults.therapyBreakerDays);
      setDataSourceType(defaults.dataSource.type);
      setBlazeUrl(defaults.dataSource.blazeUrl);
      setValidationError(false);
      showSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('settingsSaveError'));
    } finally {
      setSaving(false);
    }
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

  const handleTwoFactorToggle = async () => {
    const next = !twoFactorEnabled;
    setTwoFactorEnabled(next);
    setSaveError(null);
    try {
      await updateSettings({ twoFactorEnabled: next });
      showSaved();
    } catch (err) {
      setTwoFactorEnabled(!next);
      setSaveError(err instanceof Error ? err.message : t('settingsSaveError'));
    }
  };

  const handleDataSourceTypeChange = async (type: DataSourceType) => {
    const previousType = dataSourceType;
    setDataSourceType(type);
    setConnectionStatus('idle');
    setConnectionDetail('');
    setSaveError(null);
    try {
      // Keep blazeUrl regardless of type — the server's validator requires a
      // non-empty blazeUrl (settingsApi.ts:71) even when type='local', and
      // emptying it would make persist fail silently and revert the toggle.
      await updateSettings({ dataSource: { type, blazeUrl } });
      invalidateBundleCache();
      reloadData();
      showSaved();
    } catch (err) {
      setDataSourceType(previousType);
      setSaveError(err instanceof Error ? err.message : t('settingsSaveError'));
    }
  };

  const handleBlazeUrlChange = (url: string) => {
    setBlazeUrl(url);
    setConnectionStatus('idle');
    setConnectionDetail('');
  };

  const handleBlazeUrlCommit = async () => {
    if (!blazeUrl.trim()) return;
    setSaveError(null);
    try {
      await updateSettings({ dataSource: { type: 'blaze', blazeUrl } });
      invalidateBundleCache();
      reloadData();
      showSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('settingsSaveError'));
    }
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            {t('settingsTitle')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('settingsSubtitle')}</p>
        </div>
        <button
          onClick={handleExportYaml}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600/50 transition-colors"
        >
          <Download className="w-4 h-4" />
          {t('settingsExportYaml')}
        </button>
      </div>

      {/* Success banner */}
      {savedBanner && (
        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 rounded-lg px-4 py-3 text-sm font-medium">
          <Save className="w-4 h-4 shrink-0" />
          {t('settingsSaved')}
        </div>
      )}

      {/* Error banner (H7) */}
      {saveError && (
        <div role="alert" className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-lg px-4 py-3 text-sm font-medium">
          {t('settingsSaveError')}: {saveError}
        </div>
      )}

      {/* Two-Factor Authentication */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          {t('settings2faTitle')}
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings2faLabel')}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('settings2faHint')}</p>
          </div>
          <button
            onClick={handleTwoFactorToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 ${
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

      {/* Per-user TOTP Authenticator (SEC-15 / Phase 15) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          {t('totpTitle')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {totpEnabled ? t('totpStatusActive') : t('totpStatusInactive')}
        </p>
        {totpError && (
          <p className="text-sm text-red-600 font-medium">{totpError}</p>
        )}

        {!totpEnabled && !totpQr && (
          <button
            onClick={() => { void handleTotpEnroll(); }}
            disabled={totpBusy}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <KeyRound className="w-4 h-4" />
            {t('totpEnroll')}
          </button>
        )}

        {totpQr && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-200">{t('totpScanHint')}</p>
            <img src={totpQr} alt="TOTP QR" className="w-48 h-48 border border-gray-200 dark:border-gray-700 rounded-lg" />
            {totpRecovery && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2">{t('totpRecoveryTitle')}</p>
                <ul className="grid grid-cols-2 gap-1 font-mono text-sm text-amber-900 dark:text-amber-200">
                  {totpRecovery.map((c) => (<li key={c}>{c}</li>))}
                </ul>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">{t('totpRecoveryWarning')}</p>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={totpOtp}
                onChange={(e) => setTotpOtp(e.target.value)}
                placeholder="123456"
                maxLength={6}
                className="w-32 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm font-mono text-center tracking-widest"
              />
              <button
                onClick={() => { void handleTotpConfirm(); }}
                disabled={totpBusy}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {t('totpConfirm')}
              </button>
            </div>
          </div>
        )}

        {totpEnabled && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={totpOtp}
              onChange={(e) => setTotpOtp(e.target.value)}
              placeholder={t('totpDisablePlaceholder')}
              className="w-48 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm font-mono tracking-widest"
            />
            <button
              onClick={() => { void handleTotpDisable(); }}
              disabled={totpBusy}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600/50 disabled:opacity-50"
            >
              {t('totpDisable')}
            </button>
          </div>
        )}
      </div>

      {/* Therapy Discontinuation Thresholds */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('settingsTherapy')}</h2>

        {/* Therapy Interrupter */}
        <div className="space-y-1.5">
          <label htmlFor="interrupter-days" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
              validationError ? 'border-red-400 bg-red-50' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
            }`}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('settingsInterrupterHint')}</p>
        </div>

        {/* Therapy Breaker */}
        <div className="space-y-1.5">
          <label htmlFor="breaker-days" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
              validationError ? 'border-red-400 bg-red-50' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
            }`}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('settingsBreakerHint')}</p>
        </div>

        {validationError && (
          <p className="text-sm text-red-600 font-medium">{t('settingsValidationError')}</p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {t('save')}
          </button>
          <button
            onClick={handleReset}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600/50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 dark:focus:ring-offset-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-4 h-4" />
            {t('settingsReset')}
          </button>
        </div>
      </div>

      {/* Data Source */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Server className="w-5 h-5 text-gray-500 dark:text-gray-400" />
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
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settingsDataSourceLocal')}</span>
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
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settingsDataSourceBlaze')}</span>
          </label>
        </div>

        {dataSourceType === 'blaze' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="blaze-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('settingsDataSourceUrl')}
              </label>
              <input
                id="blaze-url"
                type="url"
                value={blazeUrl}
                onChange={(e) => handleBlazeUrlChange(e.target.value)}
                onBlur={handleBlazeUrlCommit}
                placeholder="http://localhost:8080/fhir"
                className="w-full max-w-md border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => { void handleTestConnection(); }}
                disabled={connectionStatus === 'testing'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600/50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 dark:focus:ring-offset-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <MessageSquarePlus className="w-5 h-5 text-amber-500" />
          {t('feedbackExport')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('feedbackCount').replace('{0}', String(issueCount))}
        </p>
        <button
          onClick={exportIssuesFull}
          disabled={issueCount === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-4 h-4" />
          {t('feedbackExport')}
        </button>
      </div>

      {/* Settings file hint */}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
        {t('settingsFileHint')}
      </p>
    </div>
  );
}
