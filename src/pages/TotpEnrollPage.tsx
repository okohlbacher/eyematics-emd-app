import { useEffect, useState } from 'react';

import { Shield } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import RecoveryCodesPanel from '../components/RecoveryCodesPanel';

type Phase = 'loading' | 'scan' | 'recovery';

/**
 * SEC-04: Full-page TOTP enrollment interstitial.
 *
 * Rendered by App.tsx when requiresTotpEnrollment is true, BEFORE the router.
 * No nav, no sidebar, no route access — user cannot bypass this page.
 * On successful confirmation, transitions to RecoveryCodesPanel.
 * Only after the "I have saved" checkbox + Continue does AuthContext activate the session.
 */
export default function TotpEnrollPage() {
  const { startTotpEnroll, confirmTotpEnroll } = useAuth();
  const { t } = useLanguage();

  const [phase, setPhase] = useState<Phase>('loading');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Recovery phase data
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [sessionToken, setSessionToken] = useState('');

  // Step 1: fetch QR code on mount
  useEffect(() => {
    let cancelled = false;

    startTotpEnroll().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setQrDataUrl(result.qrDataUrl);
        setManualKey(result.manualKey);
        setPhase('scan');
      } else {
        setError(t('totpEnrollErrorGeneric'));
        setPhase('scan'); // show form even on error so user sees the error
      }
    });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await confirmTotpEnroll(otp);
    setLoading(false);

    if (result.ok) {
      setRecoveryCodes(result.recoveryCodes);
      setSessionToken(result.token);
      setPhase('recovery');
    } else {
      const errKey = result.error === 'token_expired' || result.error === 'jwt expired'
        ? 'totpEnrollErrorExpired'
        : result.error === 'invalid_otp' || result.error === 'confirm_failed'
          ? 'totpEnrollErrorInvalid'
          : 'totpEnrollErrorGeneric';
      setError(t(errKey));
    }
  };

  if (phase === 'recovery') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl font-semibold text-gray-900">{t('totpEnrollTitle')}</h1>
          </div>
          <RecoveryCodesPanel codes={recoveryCodes} token={sessionToken} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-amber-500" />
          <h1 className="text-xl font-semibold text-gray-900">{t('totpEnrollTitle')}</h1>
        </div>
        <p className="text-sm text-gray-600 mb-6">{t('totpEnrollSubtitle')}</p>

        {/* QR code area */}
        {phase === 'loading' ? (
          <div className="w-40 h-40 mx-auto my-4 flex items-center justify-center bg-gray-100 rounded">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt={t('totpEnrollQrAlt')}
                className="w-40 h-40 mx-auto my-4"
              />
            )}

            {/* Manual key collapsible */}
            <details className="mb-4">
              <summary className="text-sm text-blue-600 cursor-pointer select-none">
                {t('totpEnrollManualKey')}
              </summary>
              <code className="block text-sm font-mono font-medium bg-gray-100 rounded px-2 py-1 break-all mt-2">
                {manualKey}
              </code>
            </details>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="totp-otp"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t('totpEnrollCodeLabel')}
            </label>
            <input
              id="totp-otp"
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('totpEnrollCodePlaceholder')}
              maxLength={9}
              inputMode="numeric"
              autoFocus
              aria-label={t('totpEnrollCodeLabel')}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || phase === 'loading'}
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Activating…' : t('totpEnrollSubmit')}
          </button>
        </form>
      </div>
    </div>
  );
}
