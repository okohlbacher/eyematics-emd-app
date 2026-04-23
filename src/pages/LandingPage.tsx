import {
  Activity,
  ArrowRight,
  Building2,
  ChevronRight,
  Clock,
  Download,
  Plus,
  ScanEye,
  Users,
} from 'lucide-react';

import { Badge, Button, SectionHead, Tile } from '../components/primitives';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { getCenterShorthand } from '../services/fhirLoader';
import { getDateLocale } from '../utils/dateFormat';

const CENTRE_ACCENTS: Record<string, string> = {
  UKA: 'var(--color-teal)',
  UKC: 'var(--color-sage)',
  UKD: 'var(--color-indigo)',
  UKG: 'var(--color-amber)',
  UKL: 'var(--color-coral)',
  UKMZ: 'var(--color-teal)',
  UKT: 'var(--color-sage)',
};

export default function LandingPage() {
  const { loading, centers, cases } = useData();
  const { displayName } = useAuth();
  const { locale, t } = useLanguage();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[var(--color-ink-3)]">{t('dataLoading')}</div>
      </div>
    );
  }

  const totalPatients = cases.length;
  const totalObservations = cases.reduce((sum, c) => sum + c.observations.length, 0);
  const totalOctImages = cases.reduce(
    (sum, c) =>
      sum +
      c.imagingStudies.reduce(
        (s2, study) =>
          s2 + (study.series ?? []).reduce((s3, series) => s3 + (series.instance?.length ?? 0), 0),
        0,
      ),
    0,
  );

  const tonePairs = {
    teal: { bg: 'var(--color-teal-soft)', fg: 'var(--color-teal)' },
    sage: { bg: 'var(--color-sage-soft)', fg: 'var(--color-sage)' },
    indigo: { bg: 'var(--color-indigo-soft)', fg: 'var(--color-indigo)' },
    amber: { bg: 'var(--color-amber-soft)', fg: 'var(--color-amber)' },
  } as const;
  type Tone = keyof typeof tonePairs;

  const stats: Array<{
    label: string;
    value: string | number;
    tone: Tone;
    icon: typeof Building2;
    sub: string;
  }> = [
    {
      label: t('connectedCenters'),
      value: centers.length,
      tone: 'teal',
      icon: Building2,
      sub: `${centers.length} ${t('online')}`,
    },
    {
      label: t('pseudonymizedCases'),
      value: totalPatients,
      tone: 'sage',
      icon: Users,
      sub: t('fhirBundles'),
    },
    {
      label: t('totalMeasurements'),
      value: totalObservations.toLocaleString(locale),
      tone: 'indigo',
      icon: Activity,
      sub: t('loincObservations'),
    },
    {
      label: t('octImages'),
      value: totalOctImages.toLocaleString(locale),
      tone: 'amber',
      icon: ScanEye,
      sub: t('acrossModalities'),
    },
  ];

  return (
    <div className="min-h-full bg-[var(--color-canvas)]">
      {/* Page header */}
      <div className="px-8 pt-7 pb-5 flex items-end justify-between gap-6">
        <div>
          <div className="text-[11px] tracking-[0.14em] uppercase text-[var(--color-ink-3)] font-semibold mb-2">
            {t('clinicalDemonstrator')} ·{' '}
            {new Date().toLocaleDateString(getDateLocale(locale), {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </div>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.15] text-[var(--color-ink)] m-0">
            {t('welcome')}, {displayName}.
          </h1>
          <p className="text-[14px] text-[var(--color-ink-2)] mt-1.5 max-w-[720px]">
            {t('landingSubtitle')}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Button icon={<Plus className="w-3.5 h-3.5" />} variant="soft">
            {t('navCohort')}
          </Button>
          <Button icon={<Download className="w-3.5 h-3.5" />} variant="ghost">
            {t('export')}
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="px-8 grid grid-cols-1 md:grid-cols-4 gap-3.5">
        {stats.map((s) => {
          const Icon = s.icon;
          const pair = tonePairs[s.tone];
          return (
            <Tile key={s.label} className="p-[18px_18px_14px]">
              <div
                className="w-8 h-8 rounded-lg grid place-items-center"
                style={{ background: pair.bg }}
              >
                <Icon className="w-4 h-4" style={{ color: pair.fg }} />
              </div>
              <div className="text-[32px] font-semibold tracking-[-0.03em] text-[var(--color-ink)] mt-3.5 font-data">
                {s.value}
              </div>
              <div className="flex justify-between items-center mt-1">
                <div className="text-[12px] text-[var(--color-ink-2)]">{s.label}</div>
                <div className="text-[11px] text-[var(--color-ink-3)]">{s.sub}</div>
              </div>
            </Tile>
          );
        })}
      </div>

      {/* Centres + Right rail */}
      <div
        className="px-8 py-[18px] pb-8 grid gap-3.5"
        style={{ gridTemplateColumns: '2fr 1fr' }}
      >
        <Tile>
          <SectionHead
            title={t('centersAndLocations')}
            sub={t('centersSubtitle')}
            right={
              <Badge tone="sage">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-sage)] mr-1" />
                {t('allLive')}
              </Badge>
            }
          />
          <div>
            {centers.map((center, i) => {
              const shorthand = getCenterShorthand(center.id, center.name);
              const accent = CENTRE_ACCENTS[shorthand] ?? 'var(--color-teal)';
              return (
                <div
                  key={center.id}
                  className="grid items-center gap-3.5 px-5 py-3.5 cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors"
                  style={{
                    gridTemplateColumns: '36px 1fr 90px 110px 16px',
                    borderBottom:
                      i < centers.length - 1 ? '1px solid var(--color-line)' : 'none',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-[10px] grid place-items-center font-bold text-[11px] tracking-wider font-data"
                    style={{ border: `1.5px solid ${accent}`, color: accent }}
                  >
                    {shorthand}
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold text-[var(--color-ink)]">
                      {center.name}
                    </div>
                    <div className="text-[12px] text-[var(--color-ink-3)]">
                      {center.city}, {center.state}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.06em] text-[var(--color-ink-3)] font-semibold">
                      {t('cases')}
                    </div>
                    <div className="text-[15px] font-semibold text-[var(--color-ink)] font-data">
                      {center.patientCount}
                    </div>
                  </div>
                  <div className="text-[11px] text-[var(--color-ink-3)] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {center.lastUpdated
                      ? new Date(center.lastUpdated).toLocaleDateString(getDateLocale(locale), {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                        })
                      : '—'}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--color-ink-3)]" />
                </div>
              );
            })}
          </div>
        </Tile>

        {/* Right rail: Jump back in + Attention */}
        <div className="flex flex-col gap-3.5">
          <Tile className="p-[18px]">
            <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--color-ink-3)] mb-3.5">
              {t('jumpBackIn')}
            </div>
            {[
              {
                k: t('navCohort'),
                title: 'AMD · female · 70+',
                sub: '43 cases · opened recently',
                icon: Users,
                tone: 'teal' as const,
              },
              {
                k: t('case'),
                title: 'PSN-UKA-0023',
                sub: '12 visits · Aflibercept',
                icon: ScanEye,
                tone: 'indigo' as const,
              },
            ].map((r, i, arr) => {
              const Icon = r.icon;
              const tones = {
                teal: { bg: 'var(--color-teal-soft)', fg: 'var(--color-teal)' },
                indigo: { bg: 'var(--color-indigo-soft)', fg: 'var(--color-indigo)' },
                amber: { bg: 'var(--color-amber-soft)', fg: 'var(--color-amber)' },
              } as const;
              const pair = tones[r.tone];
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 py-2.5 cursor-pointer"
                  style={{
                    borderBottom: i < arr.length - 1 ? '1px solid var(--color-line)' : 'none',
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-lg grid place-items-center"
                    style={{ background: pair.bg, color: pair.fg }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-ink-3)] font-semibold">
                      {r.k}
                    </div>
                    <div className="text-[13px] font-semibold text-[var(--color-ink)]">
                      {r.title}
                    </div>
                    <div className="text-[11px] text-[var(--color-ink-3)]">{r.sub}</div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--color-ink-3)]" />
                </div>
              );
            })}
          </Tile>

          <Tile className="p-[18px]">
            <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--color-ink-3)] mb-3.5">
              {t('attentionNeeded')}
            </div>
            <div className="flex items-start gap-2.5 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-coral)] mt-2 shrink-0" />
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-[var(--color-ink)]">
                  {t('attentionTherapyBreakers')}
                </div>
                <div className="text-[11px] text-[var(--color-ink-3)] mt-0.5">
                  {t('attentionTherapyBreakersSub')}
                </div>
              </div>
              <Button variant="ghost" size="sm">
                {t('review')}
              </Button>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-amber)] mt-2 shrink-0" />
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-[var(--color-ink)]">
                  {t('attentionImplausibleCrt')}
                </div>
                <div className="text-[11px] text-[var(--color-ink-3)] mt-0.5">
                  {t('attentionImplausibleCrtSub')}
                </div>
              </div>
              <Button variant="ghost" size="sm">
                {t('review')}
              </Button>
            </div>
          </Tile>
        </div>
      </div>
    </div>
  );
}
