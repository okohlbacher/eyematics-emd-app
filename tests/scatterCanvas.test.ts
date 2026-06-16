// @vitest-environment jsdom
/**
 * K2 (v1.16-A) — canvas scatter helpers.
 *
 * The heavy scatter layer renders to a single <canvas> in the browser instead of
 * ~2 SVG circles per point. These tests cover the environment feature-detect (which
 * gates the whole canvas path) and the nearest-point hit-test that replaces the SVG
 * hit halo for hover/click. drawScatter needs a real 2D context (browser only) so it
 * is not exercised here — in jsdom getContext('2d') is null and the component falls
 * back to the SVG path (covered by the existing OutcomesPanel scatter tests).
 */
import { describe, expect, it } from 'vitest';

import {
  canvasContextAvailable,
  type CanvasScatterPoint,
  hitTestScatter,
} from '../src/components/outcomes/scatterCanvas';

describe('scatterCanvas — feature detect', () => {
  it('canvasContextAvailable() is false in jsdom (no canvas package) → SVG fallback', () => {
    // jsdom has no 2D context without the optional `canvas` package, so the panel
    // keeps the SVG <Scatter> shape path and the existing tests stay valid.
    expect(canvasContextAvailable()).toBe(false);
  });
});

describe('scatterCanvas — hitTestScatter (nearest-point)', () => {
  const points: CanvasScatterPoint[] = [
    { cx: 10, cy: 10, patientId: 'PSN-1', x: 1, y: 0.5 },
    { cx: 50, cy: 50, patientId: 'PSN-2', x: 5, y: 0.6 },
    { cx: 200, cy: 200, patientId: 'PSN-3', x: 9, y: 0.7 },
  ];

  it('returns the point within the radius nearest the cursor', () => {
    const hit = hitTestScatter(points, 12, 11);
    expect(hit?.patientId).toBe('PSN-1');
  });

  it('returns null when no point is within the radius', () => {
    expect(hitTestScatter(points, 1000, 1000)).toBeNull();
  });

  it('picks the closest when two are within range', () => {
    // Cursor at (48,49): nearest is PSN-2 at (50,50).
    const hit = hitTestScatter(points, 48, 49);
    expect(hit?.patientId).toBe('PSN-2');
  });

  it('honours a custom radius', () => {
    // (60,60) is ~14px from PSN-2 — outside default 10, inside 20.
    expect(hitTestScatter(points, 60, 60)).toBeNull();
    expect(hitTestScatter(points, 60, 60, 20)?.patientId).toBe('PSN-2');
  });

  it('skips points with non-finite coordinates', () => {
    const bad: CanvasScatterPoint[] = [{ cx: NaN, cy: NaN, patientId: 'X' }];
    expect(hitTestScatter(bad, 0, 0)).toBeNull();
  });
});
