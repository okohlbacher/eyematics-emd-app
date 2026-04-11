import { AlertCircle, Eye, Globe, Info } from 'lucide-react';
import { useEffect,useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [error, setError] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [provider, setProvider] = useState<'local' | 'keycloak'>('local');
  const [showKeycloakInfo, setShowKeycloakInfo] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { locale, setLocale, t } = useLanguage();

  useEffect(() => {
    fetch('/api/auth/config')
      .then((r) => r.json() as Promise<{ twoFactorEnabled: boolean; provider?: string }>)
      .then((cfg) => {
        setProvider(cfg.provider === 'keycloak' ? 'keycloak' : 'local');
      })
      .catch(() => {/* default local on error */});
  }, []);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError(t('loginErrorEmpty'));
      return;
    }
    const result = await login(username, password);
    if (result.ok) {
      navigate('/');
    } else if (result.error === 'otp_required') {
      // Server determined 2FA is required — proceed to OTP step
      if (result.challengeToken) {
        setChallengeToken(result.challengeToken);
      }
      setStep('otp');
      setError('');
    } else if (result.error === 'account_locked') {
      // F-10: server-side rate limiting is the sole enforcement
      setError(t('loginErrorTooMany'));
    } else if (result.error === 'invalid_credentials') {
      // Generic message — do not distinguish user_not_found from wrong_password (prevents enumeration)
      setError(t('loginErrorWrongPassword'));
    } else {
      setError(t('loginErrorFailed'));
    }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) {
      setError(t('loginErrorOtp'));
      return;
    }
    const result = await login(username, password, otp, challengeToken);
    if (result.ok) {
      navigate('/');
    } else if (result.error === 'invalid_otp') {
      // N01.08: On OTP failure, return to password step immediately
      setStep('credentials');
      setOtp('');
      setChallengeToken('');
      setError(t('loginErrorInvalidOtp'));
    } else if (result.error === 'account_locked') {
      setError(t('loginErrorTooMany'));
    } else {
      setError(t('loginErrorFailed'));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Eye className="w-10 h-10 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('loginTitle')}</h1>
            <p className="text-sm text-gray-500">
              {provider === 'keycloak' ? t('loginKeycloakSubtitle') : t('loginSubtitle')}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {provider === 'keycloak' ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowKeycloakInfo(true)}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-500"
            >
              {t('loginKeycloakButton')}
            </button>
            {showKeycloakInfo && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">{t('loginKeycloakInfoTitle')}</span>
                    {' '}
                    {t('loginKeycloakInfoBody')}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : step === 'credentials' ? (
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
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              {t('loginContinue')}
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
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              {t('loginSubmit')}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('credentials');
                setError('');
              }}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
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
