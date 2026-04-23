import { Activity, Eye as EyeIcon, Users } from 'lucide-react';

import type { TrajectoryResult } from '../../utils/cohortTrajectory';

interface Props {
  aggregate: TrajectoryResult;
  t: (key: string) => string;
  locale: 'de' | 'en';
}

interface CardProps {
  testid: string;
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
}

function Card({ testid, icon: Icon, label, value, hint }: CardProps) {
  return (
    <div
      data-testid={testid}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
    >
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <Icon aria-hidden="true" className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        <span>{label}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold text-blue-600 dark:text-blue-400">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</div>}
    </div>
  );
}

export default function OutcomesSummaryCards({ aggregate, t, locale }: Props) {
  const fmt = (n: number) =>
    n >= 1000 ? new Intl.NumberFormat(locale).format(n) : String(n);

  const patients = aggregate.combined.summary.patientCount;
  const odCount = aggregate.od.summary.measurementCount;
  const osCount = aggregate.os.summary.measurementCount;
  const total = odCount + osCount;
  const odExcluded = aggregate.od.summary.excludedCount;
  const osExcluded = aggregate.os.summary.excludedCount;

  // For a cohort where an eye has 0 measurements, show excluded hint with
  // patient count (patients have no observation for that eye) rather than
  // only summary.excludedCount (which counts sparse/outlier exclusions).
  const osHint =
    osCount === 0 && patients > 0
      ? t('outcomesCardExcluded').replace('{count}', String(patients))
      : osExcluded > 0
        ? t('outcomesCardExcluded').replace('{count}', String(osExcluded))
        : undefined;

  const odHint =
    odCount === 0 && patients > 0
      ? t('outcomesCardExcluded').replace('{count}', String(patients))
      : odExcluded > 0
        ? t('outcomesCardExcluded').replace('{count}', String(odExcluded))
        : undefined;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
    >
      <Card
        testid="outcomes-card-patients"
        icon={Users}
        label={t('outcomesCardPatients')}
        value={fmt(patients)}
      />
      <Card
        testid="outcomes-card-total"
        icon={Activity}
        label={t('outcomesCardMeasurements')}
        value={fmt(total)}
      />
      <Card
        testid="outcomes-card-od"
        icon={EyeIcon}
        label={t('outcomesCardOdMeasurements')}
        value={fmt(odCount)}
        hint={odHint}
      />
      <Card
        testid="outcomes-card-os"
        icon={EyeIcon}
        label={t('outcomesCardOsMeasurements')}
        value={fmt(osCount)}
        hint={osHint}
      />
    </div>
  );
}
