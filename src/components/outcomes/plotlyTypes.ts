/**
 * Minimal local Plotly typings (WS-1 / v1.17).
 *
 * We deliberately keep these narrow rather than leaning on the full @types/plotly.js
 * surface: the OutcomesPanel only builds a handful of trace/layout shapes, and the
 * lazy `import('plotly.js-dist-min')` is typed structurally where it is used. Keeping
 * the public wrapper props on small interfaces avoids dragging the heavy Plotly type
 * graph into every consumer.
 */

/** A single Plotly trace (scattergl / scatter line / filled band). Loosely typed. */
export interface PlotlyData {
  type?: string;
  mode?: string;
  x?: Array<number | string>;
  y?: Array<number | null>;
  name?: string;
  /** Per-point custom payload — we stash the patient pseudonym here for drill-down. */
  customdata?: unknown[];
  text?: string[];
  hovertemplate?: string;
  hoverinfo?: string;
  marker?: Record<string, unknown>;
  line?: Record<string, unknown>;
  fill?: string;
  fillcolor?: string;
  showlegend?: boolean;
  legendgroup?: string;
  opacity?: number;
  [key: string]: unknown;
}

export interface PlotlyLayout {
  [key: string]: unknown;
}

/** Plotly click/hover event payload (the subset we read). */
export interface PlotlyMouseEvent {
  points?: Array<{
    x?: number | string;
    y?: number | null;
    customdata?: unknown;
    data?: { name?: string };
    pointIndex?: number;
    curveNumber?: number;
    event?: MouseEvent;
  }>;
  event?: MouseEvent;
}

export type PlotlyClickHandler = (e: unknown) => void;
export type PlotlyHoverHandler = (e: unknown) => void;
