/** v1.17 WS-3 (L11b): theme-aware chart colours for the case-detail charts.
 *
 *  Recharts cannot read Tailwind `dark:` classes — its SVG axis/grid/legend
 *  colours must be passed explicitly. This helper mirrors the inline palette
 *  used in OutcomesPanel so every case-detail chart restyles under dark mode.
 *  Read the effective theme via useThemeSafe() (test-safe) and pass `isDark`. */
export interface CaseChartColors {
  grid: string;
  axisTick: string;
  axisLabel: string;
  legend: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipHeading: string;
}

export function caseChartColors(isDark: boolean): CaseChartColors {
  return {
    grid: isDark ? '#374151' : '#e5e7eb', // gray-700 / gray-200
    axisTick: isDark ? '#9ca3af' : '#6b7280', // gray-400 / gray-500
    axisLabel: isDark ? '#d1d5db' : '#374151', // gray-300 / gray-700
    legend: isDark ? '#d1d5db' : '#374151',
    tooltipBg: isDark ? '#1f2937' : '#ffffff', // gray-800 / white
    tooltipBorder: isDark ? '#374151' : '#e5e7eb',
    tooltipText: isDark ? '#d1d5db' : '#4b5563', // gray-300 / gray-600
    tooltipHeading: isDark ? '#f3f4f6' : '#374151', // gray-100 / gray-700
  };
}

/** Cohort IQR band fill opacity — kept in one place so the legend swatch (L4b)
 *  can reproduce the exact rendered band colour. */
export const IQR_FILL_OPACITY = 0.15;
