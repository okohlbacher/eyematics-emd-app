/**
 * Feature-detect for the Plotly render path (WS-1 / v1.17).
 *
 * Kept in its own module so PlotlyChart.tsx exports ONLY a component (fast-refresh
 * rule) while the detector stays unit-testable.
 *
 * True only in a browser with a usable WebGL/2D canvas context. False in jsdom/SSR
 * (no context) → PlotlyChart renders its caller-supplied fallback. Guarded + try/catch
 * so a throwing `getContext` (some headless envs) is treated as "not renderable".
 *
 * v1.20.2: probed ONCE per page. PlotlyChart calls this on every render, and each probe
 * used to create a real WebGL context — six layer toggles left ~80 throwaway contexts and
 * Chrome's "Too many active WebGL contexts" warning. The probe context is also released
 * right away so it never holds one of the browser's ~16 context slots.
 */
let cached: boolean | undefined;

export function plotlyRenderable(): boolean {
  cached ??= probe();
  return cached;
}

function probe(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    if (typeof c.getContext !== 'function') return false;
    const gl = c.getContext('webgl') ?? c.getContext('experimental-webgl');
    if (gl) {
      (gl as WebGLRenderingContext).getExtension?.('WEBGL_lose_context')?.loseContext();
      return true;
    }
    return c.getContext('2d') != null;
  } catch {
    return false;
  }
}
