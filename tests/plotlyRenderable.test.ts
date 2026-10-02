// @vitest-environment jsdom
/**
 * v1.20.2 — the WebGL probe behind PlotlyChart runs once per page and releases its
 * context (PlotlyChart calls plotlyRenderable() on every render; each probe used to
 * allocate a live WebGL context).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('plotlyRenderable', () => {
  it('probes once and releases the WebGL probe context', async () => {
    const loseContext = vi.fn();
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ getExtension: () => ({ loseContext }) } as unknown as WebGLRenderingContext);
    const { plotlyRenderable } = await import('../src/components/outcomes/plotlyRenderable');

    expect(plotlyRenderable()).toBe(true);
    expect(plotlyRenderable()).toBe(true);
    expect(getContext).toHaveBeenCalledTimes(1);
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('stays false without a canvas context (jsdom → test fallback path)', async () => {
    const { plotlyRenderable } = await import('../src/components/outcomes/plotlyRenderable');
    expect(plotlyRenderable()).toBe(false);
  });
});
