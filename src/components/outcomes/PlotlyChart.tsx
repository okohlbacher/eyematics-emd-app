/**
 * PlotlyChart — thin WS-1 (v1.17) wrapper around plotly.js-dist-min.
 *
 * Replaces the v1.16 Recharts ComposedChart + canvas-scatter for the heavy cohort
 * Verläufe panels. Plotly's `scattergl` (WebGL) draws thousands of points to ONE
 * canvas with no DOM-node wall, fixing the perf cliff (the old SVG scatter emitted
 * ~13.5k empty <g> nodes and the canvas overlay was never sized).
 *
 * Lazy load: plotly is imported INSIDE an effect (`await import(...)`) so it never
 * lands in the synchronous bundle / SSR / test path.
 *
 * jsdom / test compatibility (CRITICAL): Plotly needs a real WebGL (or 2D) context,
 * which jsdom does not provide. The 1291-test suite runs in jsdom, so the wrapper
 * feature-detects (`plotlyRenderable()`) and, when unavailable, renders a lightweight
 * testable fallback supplied by the caller. The caller (OutcomesPanel) uses that
 * fallback to emit the data-testids the rewritten tests assert against. Net: no
 * Plotly code ever executes in jsdom.
 */
import { useEffect, useRef } from 'react';

import { plotlyRenderable } from './plotlyRenderable';
import type { PlotlyClickHandler, PlotlyData, PlotlyHoverHandler, PlotlyLayout } from './plotlyTypes';

interface PlotlyChartProps {
  data: PlotlyData[];
  layout: PlotlyLayout;
  /** Plotly config (modebar, responsive, dragmode helpers). */
  config?: Record<string, unknown>;
  /** Fired on plotly_click — receives the Plotly event payload. */
  onPointClick?: PlotlyClickHandler;
  onHover?: PlotlyHoverHandler;
  onUnhover?: () => void;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Rendered instead of the live Plotly div when Plotly cannot render (jsdom/SSR).
   * The caller supplies the testable DOM here.
   */
  fallback?: React.ReactNode;
  /** data-testid for the live Plotly container (browser path). */
  testId?: string;
}

type PlotlyModule = {
  react: (el: HTMLElement, data: unknown, layout: unknown, config: unknown) => Promise<unknown>;
  purge: (el: HTMLElement) => void;
  Plots: { resize: (el: HTMLElement) => void };
};

export default function PlotlyChart({
  data,
  layout,
  config,
  onPointClick,
  onHover,
  onUnhover,
  className,
  style,
  fallback,
  testId,
}: PlotlyChartProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  // Latest handlers in refs so the Plotly event listeners (attached once per redraw)
  // always call the current callback without re-binding. Synced in an effect (not in
  // the render body) so we never write a ref during render.
  const clickRef = useRef(onPointClick);
  const hoverRef = useRef(onHover);
  const unhoverRef = useRef(onUnhover);
  useEffect(() => {
    clickRef.current = onPointClick;
    hoverRef.current = onHover;
    unhoverRef.current = onUnhover;
  }, [onPointClick, onHover, onUnhover]);

  const renderable = plotlyRenderable();

  // Lazy-load Plotly + (re)draw on data/layout change. Only runs in the browser path.
  useEffect(() => {
    if (!renderable) return;
    const el = elRef.current;
    if (!el) return;
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let plotly: PlotlyModule | null = null;

    void (async () => {
      const mod = (await import('plotly.js-dist-min')) as unknown as { default: PlotlyModule };
      const Plotly = mod.default;
      if (disposed || !elRef.current) return;
      plotly = Plotly;
      await Plotly.react(el, data, layout, {
        responsive: true,
        displaylogo: false,
        ...(config ?? {}),
      });
      if (disposed) return;

      const elev = el as unknown as {
        on: (ev: string, cb: (e: unknown) => void) => void;
        removeAllListeners?: (ev: string) => void;
      };
      elev.removeAllListeners?.('plotly_click');
      elev.removeAllListeners?.('plotly_hover');
      elev.removeAllListeners?.('plotly_unhover');
      elev.on('plotly_click', (e) => clickRef.current?.(e));
      elev.on('plotly_hover', (e) => hoverRef.current?.(e));
      elev.on('plotly_unhover', () => unhoverRef.current?.());

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (!disposed && elRef.current) plotly?.Plots.resize(el);
        });
        resizeObserver.observe(el);
      }
    })();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      // `el` is captured from this effect run (the node we drew into) — use it rather
      // than elRef.current, which may have changed by cleanup time.
      if (plotly) plotly.purge(el);
    };
  }, [data, layout, config, renderable]);

  if (!renderable) {
    return <>{fallback}</>;
  }
  return <div ref={elRef} data-testid={testId} className={className} style={style} />;
}
