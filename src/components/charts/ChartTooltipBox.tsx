/**
 * Z0-P23: the one tooltip box of the analysis charts — one heading line with the x-axis value, then one row per value
 * in the form "<Bezeichnung>: <Wert>". Used by Aggregiert, Verläufe and the case view.
 */
import { useThemeSafe } from '../../context/ThemeContext';
import { caseChartColors } from '../case-detail/chartTheme';

export interface ChartTooltipRow {
  key: string;
  label: string;
  value: string;
  color?: string;
}

export default function ChartTooltipBox({ heading, rows }: { heading: string; rows: ChartTooltipRow[] }) {
  const { effectiveTheme } = useThemeSafe();
  const colors = caseChartColors(effectiveTheme === 'dark');
  return (
    <div
      data-testid="chart-tooltip"
      className="rounded-lg shadow-lg px-3 py-2 text-xs border"
      style={{ background: colors.tooltipBg, borderColor: colors.tooltipBorder }}
    >
      <div data-tooltip-heading className="font-semibold mb-1" style={{ color: colors.tooltipHeading }}>
        {heading}
      </div>
      {rows.map((r) => (
        <div key={r.key} data-tooltip-row style={{ color: colors.tooltipText }}>
          <span style={r.color ? { color: r.color } : undefined}>{r.label}</span>: {r.value}
        </div>
      ))}
    </div>
  );
}
