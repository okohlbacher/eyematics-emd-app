import {
  Activity,
  Building2,
  Clock,
  ScanEye,
  Users,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { getCenterShorthand } from '../services/fhirLoader';
import { getDateLocale } from '../utils/dateFormat';

export default function LandingPage() {
  const { loading, centers, cases } = useData();
  const { displayName } = useAuth();
  const { locale, t } = useLanguage();


  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">{t('dataLoading')}</div>
      </div>
    );
  }

  const totalPatients = cases.length;
  const totalObservations = cases.reduce(
    (sum, c) => sum + c.observations.length,
    0
  );
  const totalOctImages = cases.reduce(
    (sum, c) =>
      sum +
      c.imagingStudies.reduce(
        (s2, study) =>
          s2 +
          (study.series ?? []).reduce(
            (s3, series) => s3 + (series.instance?.length ?? 0),
            0
          ),
        0
      ),
    0
  );

  return (
    <div className="p-8">
      {/* Header with logo */}
      <div className="mb-8 flex items-center gap-6">
        <img
          src="/eyematics-logo.png"
          alt="EyeMatics"
          className="h-20 w-auto"
        />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('welcome')}, {displayName}
          </h1>
          <p className="text-gray-500 mt-1">
            {t('landingSubtitle')}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          icon={Building2}
          label={t('connectedCenters')}
          value={centers.length}
          color="blue"
        />
        <SummaryCard
          icon={Users}
          label={t('pseudonymizedCases')}
          value={totalPatients}
          color="green"
        />
        <SummaryCard
          icon={Activity}
          label={t('totalMeasurements')}
          value={totalObservations}
          color="purple"
        />
        <SummaryCard
          icon={ScanEye}
          label={t('octImages')}
          value={totalOctImages}
          color="cyan"
        />
      </div>

      {/* Centers table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('centersAndLocations')}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {t('centersSubtitle')}
          </p>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('center')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('location')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                {t('cases')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                {t('adminUsersCount')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                {t('lastUpdate')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {centers.map((center) => {
              const shorthand = getCenterShorthand(center.id, center.name);
              const usersAtCenter = 0; // user counts loaded server-side in AdminPage
              return (
                <tr key={center.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-500" />
                      <span className="font-medium text-gray-900">
                        {center.name}
                      </span>
                      <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {shorthand}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {center.city}, {center.state}
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    {center.patientCount}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600">
                    {usersAtCenter}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 text-sm text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      {center.lastUpdated
                        ? new Date(center.lastUpdated).toLocaleString(getDateLocale(locale), {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
    cyan: 'bg-cyan-50 text-cyan-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
