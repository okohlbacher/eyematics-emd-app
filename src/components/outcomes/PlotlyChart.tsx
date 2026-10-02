/**
 * PlotlyChart — thin WS-1 (v1.17) wrapper around plotly.js-strict-dist-min.
 *
 * v1.20.1: the STRICT bundle is required, not plotly.js-dist-min. The regular bundle's
 * WebGL layer (regl) compiles its draw calls with `new Function`, which the production
 * CSP (`script-src 'self'`, helmet in server/index.ts) blocks — Plotly then reports
 * "WebGL is not supported by your browser" for every scattergl trace. The strict build
 * ships that code precompiled. Dev (Vite, no CSP) never shows the difference.
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
  /**
   * M1 (v1.18 WS-A): imperative restyle handle. PlotlyChart assigns
   * `{ restyle }` here once Plotly has drawn, so the caller can emphasise/restore a
   * SINGLE trace (e.g. bump line width on hover) via `Plotly.restyle` — never a full
   * redraw. Null between draws / in the jsdom fallback.
   */
  handleRef?: React.MutableRefObject<PlotlyImperativeHandle | null>;
}

/** Imperative handle exposed by PlotlyChart for cheap single-trace restyles. */
export interface PlotlyImperativeHandle {
  /** Restyle one (or more) traces in place — thin wrapper over Plotly.restyle. */
  restyle: (update: Record<string, unknown>, traceIndices: number[]) => void;
}

type PlotlyModule = {
  react: (el: HTMLElement, data: unknown, layout: unknown, config: unknown) => Promise<unknown>;
  purge: (el: HTMLElement) => void;
  restyle: (el: HTMLElement, update: Record<string, unknown>, traceIndices?: number[]) => Promise<unknown>;
  Plots: { resize: (el: HTMLElement) => void };
};

/** The lazily imported Plotly module (a singleton once loaded) — used by the unmount purge. */
let loadedPlotly: PlotlyModule | null = null;

// v1.20.2: Plotly swaps its WebGL canvases on a full replot (trace count changes, e.g. a
// layer toggle) and on purge, but never releases the old contexts — they stay "active"
// until GC, and browsers keep only ~16 ("Too many active WebGL contexts"). Release them
// as soon as Plotly has detached them. No match if Plotly renames the classes → no-op.
const glCanvases = (el: HTMLElement) => [...el.querySelectorAll<HTMLCanvasElement>('canvas.gl-canvas')];
const releaseGl = (c: HTMLCanvasElement) => c.getContext('webgl')?.getExtension('WEBGL_lose_context')?.loseContext();

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
  handleRef,
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
      const mod = (await import('plotly.js-strict-dist-min')) as unknown as { default: PlotlyModule };
      const Plotly = mod.default;
      loadedPlotly = Plotly;
      if (disposed || !elRef.current) return;
      plotly = Plotly;
      const previousGl = glCanvases(el);
      await Plotly.react(el, data, layout, {
        responsive: true,
        displaylogo: false,
        ...(config ?? {}),
      });
      for (const c of previousGl) if (!c.isConnected) releaseGl(c);
      if (disposed) return;

      const elev = el as unknown as {
        on: (ev: string, cb: (e: unknown) => void) => void;
        removeAllListeners?: (ev: string) => void;
        __emdListenersBound?: boolean;
      };
      // HIGH-1 (review): the graph div is normally an EventEmitter, so we clear the
      // three listeners before re-adding them on each redraw. Do NOT optional-chain
      // that away — if removeAllListeners is ever absent (Plotly major bump / partial
      // bundle), silently skipping it would STACK a new listener on every redraw.
      // Fall back to a one-time bind in that case so listeners can never accumulate.
      if (typeof elev.removeAllListeners === 'function') {
        elev.removeAllListeners('plotly_click');
        elev.removeAllListeners('plotly_hover');
        elev.removeAllListeners('plotly_unhover');
        elev.on('plotly_click', (e) => clickRef.current?.(e));
        elev.on('plotly_hover', (e) => hoverRef.current?.(e));
        elev.on('plotly_unhover', () => unhoverRef.current?.());
      } else if (!elev.__emdListenersBound) {
        elev.__emdListenersBound = true;
        elev.on('plotly_click', (e) => clickRef.current?.(e));
        elev.on('plotly_hover', (e) => hoverRef.current?.(e));
        elev.on('plotly_unhover', () => unhoverRef.current?.());
      }

      // M1 (v1.18 WS-A): publish the imperative restyle handle now that Plotly has
      // drawn into `el`. Single-trace restyle only (caller bumps one line's width on
      // hover) — never a relayout/redraw.
      if (handleRef) {
        handleRef.current = {
          restyle: (update, traceIndices) => {
            if (disposed || !elRef.current) return;
            void Plotly.restyle(el, update, traceIndices);
          },
        };
      }

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (!disposed && elRef.current) plotly?.Plots.resize(el);
        });
        resizeObserver.observe(el);
      }
    })().catch((err) => {
      // HIGH-2 (review): a Plotly.react rejection (bad trace shape, or WebGL context
      // loss/exhaustion — realistic with 3 panels remounting on cohort/metric switches)
      // would otherwise be an unhandled rejection and a silently blank panel. Surface it.
      if (!disposed) console.error('[PlotlyChart] render failed', err);
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      // M1: drop the imperative handle so a stale restyle can't target a purged div.
      if (handleRef) handleRef.current = null;
      // No purge here: the next run's Plotly.react updates the SAME graph in place.
    };
  }, [data, layout, config, renderable, handleRef]);

  // v1.20.2: purge only on unmount. Purging on every data/layout change discarded
  // Plotly.react's diff (full redraw per layer toggle) and re-created each chart's
  // WebGL contexts every time — the stale ones lingered until GC ("Too many active WebGL
  // contexts"). `el` is captured at mount: the div keeps its identity for the lifetime.
  useEffect(() => {
    const el = elRef.current;
    return () => {
      if (!el || !loadedPlotly) return;
      const gl = glCanvases(el);
      loadedPlotly.purge(el);
      gl.forEach(releaseGl);
    };
  }, []);

  if (!renderable) {
    return <>{fallback}</>;
  }
  return <div ref={elRef} data-testid={testId} className={className} style={style} />;
}
