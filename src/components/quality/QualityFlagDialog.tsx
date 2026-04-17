import { useLanguage } from '../../context/LanguageContext';

export interface FlagDialogState {
  parameter: string;
  value: string;
}

export interface QualityFlagDialogProps {
  flagDialog: FlagDialogState;
  errorType: string;
  onErrorTypeChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

type ErrorTypeValue = 'Unplausibel' | 'Fehlend' | 'Duplikat' | 'Formatfehler' | 'Sonstiger Fehler';

export default function QualityFlagDialog({
  flagDialog,
  errorType,
  onErrorTypeChange,
  onSave,
  onCancel,
}: QualityFlagDialogProps) {
  const { t } = useLanguage();

  const errorTypes = [
    { value: 'Unplausibel', label: t('errorImplausible') },
    { value: 'Fehlend', label: t('errorMissing') },
    { value: 'Duplikat', label: t('errorDuplicate') },
    { value: 'Formatfehler', label: t('errorFormat') },
    { value: 'Sonstiger Fehler', label: t('errorOther') },
  ] satisfies Array<{ value: ErrorTypeValue; label: string }>;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h3 className="font-semibold text-gray-900 mb-4">{t('flagErrorTitle')}</h3>
        <p className="text-sm text-gray-500 mb-4">
          {t('parameter')}: <span className="font-medium">{flagDialog.parameter}</span>
          <br />
          {t('value')}: <span className="font-medium">{flagDialog.value}</span>
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('errorType')}
          </label>
          <select
            value={errorType}
            onChange={(e) => onErrorTypeChange(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">{t('selectErrorType')}</option>
            {errorTypes.map((et) => (
              <option key={et.value} value={et.value}>
                {et.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
          >
            {t('cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={!errorType}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {t('reportError')}
          </button>
        </div>
      </div>
    </div>
  );
}
