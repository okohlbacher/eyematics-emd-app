import {
Activity,
AlertTriangle, BarChart3, ClipboardCheck,   FileText, Globe,   Home, LogOut, Settings, Shield,
Users, } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { QUALITY_ROLES, useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import FeedbackButton from './FeedbackButton';
import { BrandMark } from './primitives';
import { ThemeToggle } from './ThemeToggle';

export default function Layout() {
  const { user, logout, inactivityWarning } = useAuth();
  const navigate = useNavigate();
  const { locale, setLocale, t } = useLanguage();

  const research = [
    { to: '/', label: t('navHome'), icon: Home, end: true },
    { to: '/cohort', label: t('navCohort'), icon: Users },
    { to: '/analysis', label: t('navAnalysis'), icon: BarChart3 },
    { to: '/quality', label: t('navQuality'), icon: ClipboardCheck },
    ...(user?.role && QUALITY_ROLES.includes(user.role)
      ? [{ to: '/doc-quality', label: t('navDocQuality'), icon: Activity }]
      : []),
  ];
  const admin = user?.role === 'admin'
    ? [
        { to: '/audit', label: t('navAudit'), icon: FileText },
        { to: '/admin', label: t('navAdmin'), icon: Shield },
        { to: '/settings', label: t('navSettings'), icon: Settings },
      ]
    : [];

  const initials = (user?.username ?? '').slice(0, 2).toUpperCase();

  const NavItem = ({
    to, label, icon: Icon, end,
  }: { to: string; label: string; icon: typeof Home; end?: boolean }) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors
         ${isActive
           ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] font-semibold'
           : 'text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]'}`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded bg-[var(--color-teal)]" />
          )}
          <Icon
            className="w-4 h-4"
            strokeWidth={1.75}
            style={{ color: isActive ? 'var(--color-teal)' : 'var(--color-ink-2)' }}
          />
          {label}
        </>
      )}
    </NavLink>
  );

  return (
    <div className="flex h-screen bg-[var(--color-canvas)]">
      {inactivityWarning && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-[var(--color-amber)] text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {t('inactivityWarning')}
        </div>
      )}

      {/* Sidebar — light, hairline-bordered */}
      <aside className="shrink-0 bg-[var(--color-surface)] border-r border-[var(--color-line)] flex flex-col" style={{ width: 232 }}>
        {/* Brand */}
        <div className="px-4 py-4 flex items-center gap-3 border-b border-[var(--color-line)]">
          <BrandMark size={26} />
          <div>
            <div className="text-[14px] font-bold leading-none tracking-[-0.01em] text-[var(--color-ink)]">EyeMatics</div>
            <div className="text-[10px] tracking-[0.1em] uppercase text-[var(--color-ink-3)] mt-1">
              {t('clinicalDemonstrator')}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2.5">
          <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[var(--color-ink-3)] px-2.5 pb-2">
            {t('navGroupResearch')}
          </div>
          <div className="flex flex-col gap-0.5">
            {research.map((it) => <NavItem key={it.to} {...it} />)}
          </div>

          {admin.length > 0 && (
            <>
              <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[var(--color-ink-3)] px-2.5 pt-4 pb-2">
                {t('navGroupAdmin')}
              </div>
              <div className="flex flex-col gap-0.5">
                {admin.map((it) => <NavItem key={it.to} {...it} />)}
              </div>
            </>
          )}
        </nav>

        {/* Language + theme + user */}
        <div className="border-t border-[var(--color-line)] p-2.5">
          <button
            onClick={() => setLocale(locale === 'de' ? 'en' : 'de')}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[11px] text-[var(--color-ink-3)] hover:text-[var(--color-ink)] rounded-md hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            {locale === 'de' ? 'English' : 'Deutsch'}
          </button>
          <ThemeToggle />

          <div className="mt-2 flex items-center gap-2.5 px-2 py-1.5">
            <div
              className="w-7 h-7 rounded-full grid place-items-center text-[11px] font-bold"
              style={{ background: 'var(--color-teal-soft)', color: 'var(--color-teal-ink)' }}
            >
              {initials || 'NA'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-[var(--color-ink)] truncate">
                {user?.username}
              </div>
              <div className="text-[10px] text-[var(--color-ink-3)] capitalize">{user?.role}</div>
            </div>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="p-1.5 text-[var(--color-ink-3)] hover:text-[var(--color-ink)] transition-colors"
              title={t('navLogout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      <FeedbackButton />
    </div>
  );
}
