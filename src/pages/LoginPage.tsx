import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Eye, AlertCircle, Globe } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const { locale, setLocale, t } = useLanguage();

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError(t('loginErrorEmpty'));
      return;
    }

    setLoading(true);
    setError('');

    const result = await login(username, password);

    setLoading(false);

    if (result.ok) {
      navigate('/');
      return;
    }

    if (result.needsOtp && result.challengeToken) {
      setChallengeToken(result.challengeToken);
      setStep('otp');
      return;
    }

    // Map server error codes to i18n messages
    if (result.error === 'account_locked') {
      setError(t('loginErrorTooMany'));
    } else if (result.error === 'network_error') {
      setError(t('loginErrorFailed'));
    } else {
      // Generic: covers 'Invalid credentials' and other 401 messages
      setError(t('loginErrorWrongPassword'));
    }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) {
      setError(t('loginErrorOtp'));
      return;
    }

    setLoading(true);
    setError('');

    const result = await verifyOtp(challengeToken, otp);

    setLoading(false);

    if (result.ok) {
      navigate('/');
      return;
    }

    // N01.08: On OTP failure, return to credentials step immediately
    setStep('credentials');
    setOtp('');
    setChallengeToken('');

    if (result.error === 'account_locked') {
      setError(t('loginErrorTooMany'));
    } else if (result.error === 'network_error') {
      setError(t('loginErrorFailed'));
    } else {
      setError(t('loginErrorInvalidOtp'));
    }
  };

  // If server says 2FA is off, skip OTP step: credentials form goes straight to login
  // (handled by server returning { token } directly — login() resolves ok:true)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Eye className="w-10 h-10 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('loginTitle')}</h1>
            <p className="text-sm text-gray-500">{t('loginSubtitle')}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {step === 'credentials' ? (
          <form onSubmit={handleCredentials} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('loginUsername')}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder={t('loginUsernamePlaceholder')}
                autoFocus
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('loginPassword')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder={t('loginPasswordPlaceholder')}
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? '...' : t('loginContinue')}
            </button>
            <p className="text-xs text-gray-400 text-center mt-4">
              {t('loginDemoHint')}
            </p>
          </form>
        ) : (
          <form onSubmit={handleOtp} className="space-y-4">
            <p className="text-sm text-gray-600 mb-2">
              {t('login2faTitle')}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('loginOtpLabel')}
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none tracking-widest text-center text-lg"
                placeholder="123456"
                maxLength={6}
                autoFocus
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? '...' : t('loginSubmit')}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setStep('credentials');
                setError('');
                setChallengeToken('');
                setOtp('');
              }}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-60"
            >
              {t('back')}
            </button>
          </form>
        )}

        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setLocale(locale === 'de' ? 'en' : 'de')}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            {locale === 'de' ? 'English' : 'Deutsch'}
          </button>
        </div>
      </div>
    </div>
  );
}
