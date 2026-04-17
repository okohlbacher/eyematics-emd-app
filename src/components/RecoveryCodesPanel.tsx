import { useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface RecoveryCodesPanelProps {
  codes: string[];
  token: string;
}

/**
 * SEC-04 + SEC-05: Recovery codes display panel.
 *
 * Shows all 10 recovery codes once after successful TOTP enrollment.
 * Provides copy-all and download-as-txt actions.
 * Blocks Continue until the user checks "I have saved my recovery codes".
 * Continue calls completeTotpEnroll(token) to activate the session JWT.
 */
export default function RecoveryCodesPanel({ codes, token }: RecoveryCodesPanelProps) {
  const { completeTotpEnroll } = useAuth();
  const { t } = useLanguage();

  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyAll = () => {
    void navigator.clipboard.writeText(codes.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([codes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleContinue = () => {
    completeTotpEnroll(token);
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 my-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">
        {t('totpRecoveryCodesTitle')}
      </h2>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800 mb-3">
        {t('totpRecoveryCodesWarning')}
      </div>

      {/* Code grid */}
      <div className="grid grid-cols-2 gap-2" role="list">
        {codes.map((code) => (
          <code
            key={code}
            role="listitem"
            className="text-sm font-mono font-medium bg-white border border-gray-200 rounded px-2 py-1 text-center text-gray-800"
          >
            {code}
          </code>
        ))}
      </div>

      {/* Action row */}
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={handleCopyAll}
          className="text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-3 py-1"
        >
          {copied ? t('copied') : t('totpCopyAllCodes')}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-3 py-1"
        >
          {t('totpDownloadCodes')}
        </button>
      </div>

      {/* Checkbox gate */}
      <div className="flex items-start gap-2 mt-4">
        <input
          type="checkbox"
          id="saved-codes"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="mt-0.5"
        />
        <label htmlFor="saved-codes" className="text-sm text-gray-700">
          {t('totpSavedCodesCheckbox')}
        </label>
      </div>

      {/* Continue button */}
      <button
        type="button"
        onClick={handleContinue}
        disabled={!saved}
        aria-disabled={!saved ? 'true' : 'false'}
        className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 mt-4"
      >
        {t('totpEnrollDone')}
      </button>
    </div>
  );
}
