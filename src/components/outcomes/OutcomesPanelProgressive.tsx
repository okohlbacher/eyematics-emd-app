/**
 * J2 (v1.15-p4): shared bits for the progressive panel mount.
 *
 * PanelPlaceholder is the self-explanatory loading card shown in the slot of a
 * panel that has NOT mounted yet (so the user never sees a bare white card while
 * the staged Recharts build catches up). It carries a role=status so the loading
 * state is announced and assertable.
 */
import type { TranslationKey } from '../../i18n/translations';

// Stage the OD/OS/combined panels one at a time only above this client cohort
// size — matches the heavy-render threshold used elsewhere in the outcomes surface.
// Below it, all three mount at once (no perceptible flash).
export const PROGRESSIVE_PANEL_THRESHOLD_CASES = 50;

export function PanelPlaceholder({
  eye,
  titleKey,
  t,
}: {
  eye: 'od' | 'os' | 'combined';
  titleKey: TranslationKey;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div
      data-testid={`outcomes-panel-placeholder-${eye}`}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
    >
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t(titleKey)}</h3>
      <div className="h-80 flex items-center justify-center">
        <span
          role="status"
          aria-live="polite"
          className="text-sm text-gray-400 dark:text-gray-500 italic"
        >
          {t('outcomesClientComputingLabel')}
        </span>
      </div>
    </div>
  );
}
