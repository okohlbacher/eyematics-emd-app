/**
 * K2 (v1.16-A): canvas rendering for the heavy scatter layer.
 *
 * Performance crux (4th round). The dominant cost on a settings toggle / compare
 * render was Recharts building SVG for the scatter cloud: the capped 1,500 points ×
 * two <circle> nodes (hit halo + dot) × three panels = ~9,000 DOM nodes, each via a
 * per-point custom `shape` callback. The SVG node count is the wall a worker cannot
 * help (rendering is main-thread). We draw the same points onto a SINGLE <canvas>
 * (one DOM node, O(n) imperative fills) instead — eliminating the node-count wall —
 * and do hover/click hit-testing against a plain point buffer (nearest-point within
 * a pixel radius), preserving the imperative highlight + tooltip + drill-down.
 *
 * Feature detection: a 2D context is REQUIRED. In jsdom (no `canvas` package) and
 * SSR `getContext('2d')` returns null → the caller falls back to the existing SVG
 * <Scatter> shape path, so tests and non-canvas environments are unaffected
 * (constraint: "canvas must feature-detect … fall back so tests don't break").
 */

/** A scatter point with its resolved pixel position (filled by the Recharts shape). */
export interface CanvasScatterPoint {
  cx: number;
  cy: number;
  patientId?: string;
  x?: number;
  y?: number;
}

/** True when a real 2D canvas context can be obtained (browser, not jsdom/SSR). */
export function canvasContextAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return typeof c.getContext === 'function' && c.getContext('2d') != null;
  } catch {
    return false;
  }
}

/**
 * Repaint the whole scatter cloud onto `canvas`, sized to `width`×`height` CSS px and
 * scaled for `dpr` (devicePixelRatio) so points stay crisp on HiDPI displays.
 * `highlightId`, when set, draws that patient's dot enlarged (the imperative hover
 * highlight, now a cheap single-point overdraw instead of an SVG attribute mutation).
 */
export function drawScatter(
  canvas: HTMLCanvasElement,
  points: readonly CanvasScatterPoint[],
  opts: {
    width: number;
    height: number;
    dpr: number;
    color: string;
    fillOpacity: number;
    highlightId?: string | null;
  },
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height, dpr, color, fillOpacity, highlightId } = opts;
  // Size the backing store for DPR; CSS size stays width×height (set by the caller).
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  for (const p of points) {
    if (!Number.isFinite(p.cx) || !Number.isFinite(p.cy)) continue;
    const isHi = highlightId != null && p.patientId === highlightId;
    ctx.globalAlpha = isHi ? 1 : fillOpacity;
    ctx.beginPath();
    ctx.arc(p.cx, p.cy, isHi ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    if (isHi) {
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * Nearest-point hit-test: returns the point closest to (px, py) within `radius`
 * pixels, or null. Replaces the SVG r=10 transparent hit halo. Linear scan over the
 * capped (≤1,500) buffer — trivially fast at hover frequency.
 */
export function hitTestScatter(
  points: readonly CanvasScatterPoint[],
  px: number,
  py: number,
  radius = 10,
): CanvasScatterPoint | null {
  let best: CanvasScatterPoint | null = null;
  let bestD2 = radius * radius;
  for (const p of points) {
    if (!Number.isFinite(p.cx) || !Number.isFinite(p.cy)) continue;
    const dx = p.cx - px;
    const dy = p.cy - py;
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestD2) {
      bestD2 = d2;
      best = p;
    }
  }
  return best;
}
