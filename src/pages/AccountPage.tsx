import { AlertCircle, CheckCircle2, KeyRound, Lock, ShieldCheck, ShieldOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { authFetch } from '../services/authHeaders';

interface TotpStatus {
  totpEnabled: boolean;
  recoveryCodesRemaining: number;
}

interface EnrollResponse {
  otpauth: string;
  qrDataUrl: string;
  recoveryCodes: string[];
}

export default function AccountPage() {
  const { user, displayName } = useAuth();
  const { t } = useLanguage();

  // ---- Password change ----
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  // ---- TOTP ----
  const [totpStatus, setTotpStatus] = useState<TotpStatus | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollResponse | null>(null);
  const [enrollOtp, setEnrollOtp] = useState('');
  const [disableOtp, setDisableOtp] = useState('');
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const resp = await authFetch('/api/auth/totp/status');
      if (resp.ok) setTotpStatus(await resp.json() as TotpStatus);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  // Auto-clear success banners after 30s for safety (do not display new password forever).
  useEffect(() => {
    if (!pwSuccess) return;
    const tm = setTimeout(() => setPwSuccess(false), 30_000);
    return () => clearTimeout(tm);
  }, [pwSuccess]);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (!currentPassword || !newPassword) {
      setPwError(t('accountPwBothRequired'));
      return;
    }
    if (newPassword.length < 8) {
      setPwError(t('accountPwTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError(t('accountPwMismatch'));
      return;
    }

    setPwBusy(true);
    try {
      const resp = await authFetch('/api/auth/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (resp.ok) {
        setPwSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const err = await resp.json().catch(() => ({ error: '' })) as { error?: string };
        setPwError(err.error || t('accountPwFailed'));
      }
    } catch (err) {
      setPwError(err instanceof Error ? err.message : t('accountPwFailed'));
    } finally {
      setPwBusy(false);
    }
  }

  async function handleEnrollStart() {
    setTotpError(null);
    setTotpBusy(true);
    try {
      const resp = await authFetch('/api/auth/totp/enroll', { method: 'POST' });
      if (resp.ok) {
        setEnrollment(await resp.json() as EnrollResponse);
      } else {
        const err = await resp.json().catch(() => ({ error: '' })) as { error?: string };
        setTotpError(err.error || t('accountTotpFailed'));
      }
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : t('accountTotpFailed'));
    } finally {
      setTotpBusy(false);
    }
  }

  async function handleEnrollConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(enrollOtp.trim())) {
      setTotpError(t('accountTotpInvalidCode'));
      return;
    }
    setTotpError(null);
    setTotpBusy(true);
    try {
      const resp = await authFetch('/api/auth/totp/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: enrollOtp.trim() }),
      });
      if (resp.ok) {
        setEnrollment(null);
        setEnrollOtp('');
        await loadStatus();
      } else {
        const err = await resp.json().catch(() => ({ error: '' })) as { error?: string };
        setTotpError(err.error || t('accountTotpInvalidCode'));
      }
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : t('accountTotpFailed'));
    } finally {
      setTotpBusy(false);
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    if (!disableOtp.trim()) {
      setTotpError(t('accountTotpInvalidCode'));
      return;
    }
    setTotpError(null);
    setTotpBusy(true);
    try {
      const resp = await authFetch('/api/auth/totp/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: disableOtp.trim() }),
      });
      if (resp.ok) {
        setDisableOtp('');
        await loadStatus();
      } else {
        const err = await resp.json().catch(() => ({ error: '' })) as { error?: string };
        setTotpError(err.error || t('accountTotpFailed'));
      }
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : t('accountTotpFailed'));
    } finally {
      setTotpBusy(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
          {t('accountTitle')}
        </h1>
        <p className="text-sm text-[var(--color-ink-2)] mt-1">
          {displayName} · <span className="capitalize">{user?.role}</span>
        </p>
      </div>

      {/* Change password */}
      <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-line)] p-5">
        <h2 className="font-semibold text-[var(--color-ink)] mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          {t('accountChangePassword')}
        </h2>

        {pwSuccess && (
          <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
            <p className="text-sm text-green-800 dark:text-green-200">{t('accountPwSuccess')}</p>
          </div>
        )}
        {pwError && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">{pwError}</p>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-3 max-w-md">
          <label className="block">
            <span className="text-xs text-[var(--color-ink-2)] font-medium">{t('accountCurrentPassword')}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-teal)]"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-ink-2)] font-medium">{t('accountNewPassword')}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-teal)]"
            />
            <span className="text-[11px] text-[var(--color-ink-3)] mt-1 block">{t('accountPwMinLength')}</span>
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-ink-2)] font-medium">{t('accountConfirmPassword')}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-teal)]"
            />
          </label>
          <button
            type="submit"
            disabled={pwBusy}
            className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {pwBusy ? t('accountSaving') : t('accountChangePassword')}
          </button>
        </form>
      </section>

      {/* TOTP */}
      <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-line)] p-5">
        <h2 className="font-semibold text-[var(--color-ink)] mb-4 flex items-center gap-2">
          <KeyRound className="w-4 h-4" />
          {t('accountTotpTitle')}
        </h2>

        {totpError && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">{totpError}</p>
          </div>
        )}

        {totpStatus === null ? (
          <p className="text-sm text-[var(--color-ink-3)]">{t('dataLoading')}</p>
        ) : totpStatus.totpEnabled ? (
          <>
            <div className="mb-4 flex items-center gap-2 text-sm">
              <ShieldCheck className="w-4 h-4 text-green-600" />
              <span className="text-[var(--color-ink)]">{t('accountTotpEnabled')}</span>
              <span className="text-[var(--color-ink-3)]">
                · {t('accountTotpRecoveryRemaining').replace('{0}', String(totpStatus.recoveryCodesRemaining))}
              </span>
            </div>
            <form onSubmit={handleDisable} className="flex items-end gap-2 max-w-md">
              <label className="flex-1">
                <span className="text-xs text-[var(--color-ink-2)] font-medium">{t('accountTotpDisablePrompt')}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={disableOtp}
                  onChange={(e) => setDisableOtp(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-teal)] font-mono"
                />
              </label>
              <button
                type="submit"
                disabled={totpBusy}
                className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
              >
                <ShieldOff className="w-3.5 h-3.5" />
                {t('accountTotpDisable')}
              </button>
            </form>
          </>
        ) : enrollment ? (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-ink-2)]">{t('accountTotpScanQr')}</p>
            <img src={enrollment.qrDataUrl} alt="TOTP QR code" width={200} height={200} className="border border-[var(--color-line)] rounded-md" />
            <details className="text-xs text-[var(--color-ink-3)]">
              <summary className="cursor-pointer">{t('accountTotpManualEntry')}</summary>
              <code className="block mt-1 p-2 bg-[var(--color-surface-2)] rounded break-all">{enrollment.otpauth}</code>
            </details>
            <div>
              <p className="text-sm font-medium text-[var(--color-ink)]">{t('accountTotpRecoveryCodes')}</p>
              <p className="text-xs text-[var(--color-ink-3)] mb-2">{t('accountTotpRecoveryHint')}</p>
              <div className="grid grid-cols-2 gap-2 max-w-sm">
                {enrollment.recoveryCodes.map((c) => (
                  <code key={c} className="font-mono text-xs px-2 py-1 bg-[var(--color-surface-2)] rounded">{c}</code>
                ))}
              </div>
            </div>
            <form onSubmit={handleEnrollConfirm} className="flex items-end gap-2 max-w-md">
              <label className="flex-1">
                <span className="text-xs text-[var(--color-ink-2)] font-medium">{t('accountTotpConfirmPrompt')}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  value={enrollOtp}
                  onChange={(e) => setEnrollOtp(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-teal)] font-mono"
                />
              </label>
              <button
                type="submit"
                disabled={totpBusy}
                className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {t('accountTotpConfirm')}
              </button>
            </form>
          </div>
        ) : (
          <>
            <p className="text-sm text-[var(--color-ink-2)] mb-3">{t('accountTotpNotEnabled')}</p>
            <button
              onClick={() => void handleEnrollStart()}
              disabled={totpBusy}
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {t('accountTotpEnable')}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
