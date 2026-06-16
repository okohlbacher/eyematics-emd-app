/**
 * Feature-detect for the Plotly render path (WS-1 / v1.17).
 *
 * Kept in its own module so PlotlyChart.tsx exports ONLY a component (fast-refresh
 * rule) while the detector stays unit-testable.
 *
 * True only in a browser with a usable WebGL/2D canvas context. False in jsdom/SSR
 * (no context) → PlotlyChart renders its caller-supplied fallback. Guarded + try/catch
 * so a throwing `getContext` (some headless envs) is treated as "not renderable".
 */
export function plotlyRenderable(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    if (typeof c.getContext !== 'function') return false;
    const gl =
      c.getContext('webgl') ??
      c.getContext('experimental-webgl') ??
      c.getContext('2d');
    return gl != null;
  } catch {
    return false;
  }
}
