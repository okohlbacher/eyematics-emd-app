/** Shared chart tooltip for doc-quality charts (M-07: deduplicated). */

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  /** M12 (v1.18): accepted for API symmetry with the case-detail charts; the
   *  tooltip restyles via Tailwind `dark:` classes (it renders into the DOM
   *  under <html class="dark">, so the classes apply — no SVG colour injection
   *  needed here, unlike the axes/grid). */
  isDark?: boolean;
}

export function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm">
      <div className="font-semibold text-gray-800 dark:text-gray-100 mb-2">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span>{entry.name}:</span>
          <span className="font-medium">{Math.round(entry.value)}%</span>
        </div>
      ))}
    </div>
  );
}
