import {
  Activity,
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  FileText,
  Globe,
  Home,
  LogOut,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import FeedbackButton from './FeedbackButton';

export default function Layout() {
  const { user, logout, inactivityWarning } = useAuth();
  const navigate = useNavigate();
  const { locale, setLocale, t } = useLanguage();

  const navItems = [
    { to: '/', label: t('navHome'), icon: Home },
    { to: '/cohort', label: t('navCohort'), icon: Users },
    { to: '/analysis', label: t('navAnalysis'), icon: BarChart3 },
    { to: '/quality', label: t('navQuality'), icon: ClipboardCheck },
    { to: '/doc-quality', label: t('navDocQuality'), icon: Activity },
    { to: '/audit', label: t('navAudit'), icon: FileText },
    ...(user?.role === 'admin'
      ? [
          { to: '/admin', label: t('navAdmin'), icon: Shield },
          { to: '/settings', label: t('navSettings'), icon: Settings },
        ]
      : []),
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Inactivity warning (EMDREQ-USM-008) */}
      {inactivityWarning && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {t('inactivityWarning')}
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 text-white flex flex-col">
        <div className="p-4 border-b border-slate-700 bg-white rounded-b-lg mx-2 mt-2 mb-2">
          <img
            src="/eyematics-logo.png"
            alt="EyeMatics"
            className="h-10 w-auto mb-1"
          />
          <p className="text-xs text-slate-500">
            {t('clinicalDemonstrator')}
          </p>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-slate-700 text-white border-r-2 border-blue-400'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-2 border-t border-slate-700">
          <button
            onClick={() => setLocale(locale === 'de' ? 'en' : 'de')}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-slate-400 hover:text-white transition-colors rounded hover:bg-slate-700/50"
          >
            <Globe className="w-3.5 h-3.5" />
            {locale === 'de' ? 'English' : 'Deutsch'}
          </button>
        </div>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="text-slate-300">{user?.username}</p>
              <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-white transition-colors"
              title={t('navLogout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Issue reporting button */}
      <FeedbackButton />
    </div>
  );
}
