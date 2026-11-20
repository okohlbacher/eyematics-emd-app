/**
 * Z0-P23: the "Kohorten vergleichen" button — the same control on Aggregiert, Verläufe and in the case view.
 */
import { GitCompare } from 'lucide-react';

export default function CompareCohortsButton({
  label,
  onClick,
  expanded,
  controls,
}: {
  label: string;
  onClick: () => void;
  expanded?: boolean;
  controls?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
      onClick={onClick}
    >
      <GitCompare className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}
