import { useState } from 'react';

import { Lock } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

/**
 * SEC-03: Full-page password change interstitial.
 *
 * Rendered by App.tsx when mustChangePassword is true, BEFORE the router.
 * No nav, no sidebar, no route access — user cannot bypass this page.
 * On success, AuthContext sets the new session token and the normal app renders.
 */
export default function PasswordChangePage() {
  const { pendingChangeToken, changePassword } = useAuth();
  const { t } = useLanguage();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirm) {
      setError(t('changePasswordMismatch'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('changePasswordTooShort'));
      return;
    }
    if (newPassword === 'changeme2025!') {
      setError(t('changePasswordDefaultForbidden'));
      return;
    }

    setLoading(true);
    const result = await changePassword(pendingChangeToken!, newPassword);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
    }
    // On success: AuthContext sets user + token → App.tsx re-renders to main content
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <Lock className="w-6 h-6 text-amber-500" />
          <h1 className="text-xl font-semibold text-gray-900">{t('changePasswordTitle')}</h1>
        </div>
        <p className="text-sm text-gray-600 mb-6">{t('changePasswordSubtitle')}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('changePasswordNewLabel')}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              minLength={8}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('changePasswordConfirmLabel')}
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '...' : t('changePasswordSubmit')}
          </button>
        </form>
      </div>
    </div>
  );
}
