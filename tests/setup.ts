// v1.9 Phase 21 (D-03): Global BroadcastChannel shim for jsdom. Cross-instance single-process post semantics per MDN. Installed only if globalThis.BroadcastChannel is undefined so real browser envs and Node 18+ pass through untouched.

import { beforeEach } from 'vitest';

class MockBroadcastChannel {
  private static channels = new Map<string, Set<MockBroadcastChannel>>();
  private listeners: Array<(e: MessageEvent) => void> = [];
  private closed = false;
  readonly name: string;
  constructor(name: string) {
    this.name = name;
    const set = MockBroadcastChannel.channels.get(name) ?? new Set();
    set.add(this);
    MockBroadcastChannel.channels.set(name, set);
  }
  postMessage(data: unknown): void {
    if (this.closed) return;
    const peers = MockBroadcastChannel.channels.get(this.name);
    if (!peers) return;
    for (const peer of peers) {
      if (peer === this || peer.closed) continue;
      for (const fn of peer.listeners) fn({ data } as MessageEvent);
    }
  }
  addEventListener(type: 'message', fn: (e: MessageEvent) => void): void {
    if (type !== 'message') return;
    this.listeners.push(fn);
  }
  removeEventListener(type: 'message', fn: (e: MessageEvent) => void): void {
    if (type !== 'message') return;
    this.listeners = this.listeners.filter((l) => l !== fn);
  }
  close(): void {
    this.closed = true;
    MockBroadcastChannel.channels.get(this.name)?.delete(this);
  }
  static _reset(): void { MockBroadcastChannel.channels.clear(); }
}

if (typeof globalThis.BroadcastChannel === 'undefined') {
  (globalThis as unknown as { BroadcastChannel: typeof MockBroadcastChannel }).BroadcastChannel = MockBroadcastChannel;
}

// WS-1 (v1.17): PlotlyChart feature-detects a canvas context (plotlyRenderable). jsdom
// has no canvas backend, so getContext() logs a noisy "Not implemented" warning before
// returning null. Stub it to quietly return null in jsdom — the Plotly fallback path is
// exactly what we want under test (so OutcomesPanel renders its testable fallback DOM).
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];
}

beforeEach(() => {
  MockBroadcastChannel._reset();
  // J2 (v1.15-p4): the outcomes view persists explicit toggle choices in
  // sessionStorage (keyed per cohort). Clear it between tests so a persisted choice
  // from one test never leaks into another that renders the same cohort id.
  try { globalThis.sessionStorage?.clear(); } catch { /* node env — no sessionStorage */ }
});

export { MockBroadcastChannel };
