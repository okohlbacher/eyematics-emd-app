/**
 * Z0-P13: visible hint directly above the Verläufe charts on how to open a single case.
 * The text follows the actual layer state (Q38): per-patient curves or scatter points shown → click hint;
 * both hidden → how to show them. Compare mode has no drill-down from the chart (Q12 b) → Q39 text.
 */
import type { TranslationKey } from '../../i18n/translations';

export default function DrillDownHint({
  layers,
  isCrossMode,
  className,
  t,
}: {
  layers: { perPatient: boolean; scatter: boolean };
  isCrossMode: boolean;
  className: string;
  t: (key: TranslationKey) => string;
}) {
  let key: TranslationKey = 'outcomesDrillDownHintLayersOff';
  if (isCrossMode) key = 'outcomesTooltipCompareClickHint';
  else if (layers.perPatient || layers.scatter) key = 'outcomesDrillDownHintVisible';
  return (
    <p data-testid="outcomes-drilldown-hint" className={`${className} text-sm text-gray-600 dark:text-gray-300`}>
      {t(key)}
    </p>
  );
}
