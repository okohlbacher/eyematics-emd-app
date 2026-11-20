/**
 * Z0-P23: legend of the analysis charts as plain DOM — one entry per series with a colour swatch. The class names
 * `legend` / `legendtext` are the hooks of the Verläufe legend (Z0-P05, Z0-P22) and are kept for every view.
 */
export interface ChartLegendEntry {
  key: string;
  label: string;
  color: string;
  /** 'line' draws a line glyph; 'rect' a filled swatch (default). */
  glyph?: 'line' | 'rect';
  opacity?: number;
}

export default function ChartLegend({ entries, ariaLabel }: { entries: ChartLegendEntry[]; ariaLabel?: string }) {
  if (entries.length === 0) return null;
  return (
    <ul
      aria-label={ariaLabel}
      className="legend flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-700 dark:text-gray-300 mt-2"
    >
      {entries.map((e) => (
        <li key={e.key} className="traces flex items-center gap-1.5">
          <span
            aria-hidden="true"
            data-legend-swatch
            className="inline-block shrink-0"
            style={
              e.glyph === 'line'
                ? { width: 14, height: 3, backgroundColor: e.color, opacity: e.opacity }
                : { width: 12, height: 12, borderRadius: 2, backgroundColor: e.color, opacity: e.opacity }
            }
          />
          <span className="legendtext">{e.label}</span>
        </li>
      ))}
    </ul>
  );
}
