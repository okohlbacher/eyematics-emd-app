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

beforeEach(() => { MockBroadcastChannel._reset(); });

export { MockBroadcastChannel };
