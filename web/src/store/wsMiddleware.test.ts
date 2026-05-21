/**
 * Tests for wsMiddleware: RFC 6902 JSON Patch applicator and WebSocket connect() guard.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyPatches } from './wsMiddleware';

// ── RFC 6902 patch applicator ─────────────────────────────────────────────────

describe('applyPatches — RFC 6902', () => {
  it('add at array index inserts before existing element (not overwrite)', () => {
    const doc = { agents: [{ id: 'a' }, { id: 'b' }] };
    const result = applyPatches(doc, [{ op: 'add', path: '/agents/0', value: { id: 'x' } }]) as typeof doc;
    expect(result.agents).toEqual([{ id: 'x' }, { id: 'a' }, { id: 'b' }]);
  });

  it('add at array index 1 inserts at correct position', () => {
    const doc = { agents: [{ id: 'a' }, { id: 'b' }] };
    const result = applyPatches(doc, [{ op: 'add', path: '/agents/1', value: { id: 'x' } }]) as typeof doc;
    expect(result.agents).toEqual([{ id: 'a' }, { id: 'x' }, { id: 'b' }]);
  });

  it('add with "-" appends to array', () => {
    const doc = { agents: [{ id: 'a' }] };
    const result = applyPatches(doc, [{ op: 'add', path: '/agents/-', value: { id: 'z' } }]) as typeof doc;
    expect(result.agents).toEqual([{ id: 'a' }, { id: 'z' }]);
  });

  it('replace at array index overwrites, does not insert', () => {
    const doc = { agents: [{ id: 'a' }, { id: 'b' }] };
    const result = applyPatches(doc, [{ op: 'replace', path: '/agents/0', value: { id: 'x' } }]) as typeof doc;
    expect(result.agents).toEqual([{ id: 'x' }, { id: 'b' }]);
  });

  it('add with nested path (tail > 0) traverses array index without inserting', () => {
    const doc = { agents: [{ id: 'a', name: 'Alice' }] };
    const result = applyPatches(doc, [{ op: 'add', path: '/agents/0/name', value: 'Bob' }]) as typeof doc;
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].name).toBe('Bob');
  });

  it('remove at array index splices the element out', () => {
    const doc = { agents: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
    const result = applyPatches(doc, [{ op: 'remove', path: '/agents/1' }]) as typeof doc;
    expect(result.agents).toEqual([{ id: 'a' }, { id: 'c' }]);
  });

  it('original doc is not mutated', () => {
    const agents = [{ id: 'a' }];
    const doc = { agents };
    applyPatches(doc, [{ op: 'add', path: '/agents/0', value: { id: 'x' } }]);
    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe('a');
  });
});

// ── Minimal WebSocket mock ────────────────────────────────────────────────────

const WS_CONNECTING = 0;
const WS_OPEN = 1;
const WS_CLOSING = 2;
const WS_CLOSED = 3;

class MockWebSocket {
  static CONNECTING = WS_CONNECTING;
  static OPEN = WS_OPEN;
  static CLOSING = WS_CLOSING;
  static CLOSED = WS_CLOSED;

  readyState: number = WS_CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: (() => void) | null = null;

  close(): void {
    this.readyState = WS_CLOSING;
  }

  /** Test helper: simulate the server accepting the connection. */
  simulateOpen(): void {
    this.readyState = WS_OPEN;
    this.onopen?.();
  }

  /** Test helper: simulate the connection closing (after close() or server drop). */
  simulateClose(): void {
    this.readyState = WS_CLOSED;
    this.onclose?.();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInstances(): MockWebSocket[] {
  return (MockWebSocket as unknown as { instances: MockWebSocket[] }).instances;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('wsMiddleware connect() guard', () => {
  beforeEach(async () => {
    // Reset the instance log on the mock class.
    (MockWebSocket as unknown as Record<string, unknown>).instances = [];

    // Stub browser globals needed by wsMiddleware.
    vi.stubGlobal('window', { location: { protocol: 'http:', host: 'localhost:8080' } });

    // Stub the global WebSocket with our mock, capturing each new instance.
    vi.stubGlobal('WebSocket', new Proxy(MockWebSocket, {
      construct(Target, args) {
        const inst = new Target(...args as []);
        ((Target as unknown as Record<string, unknown>).instances as MockWebSocket[]).push(inst);
        return inst;
      },
    }));

    // Import fresh module state for each test.
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('is a no-op when called while CONNECTING', async () => {
    const { startWs, stopWs } = await import('./wsMiddleware');
    try {
      startWs(); // creates socket 1, now CONNECTING
      startWs(); // should be a no-op
      startWs(); // should be a no-op

      expect(getInstances()).toHaveLength(1);
    } finally {
      stopWs();
    }
  });

  it('is a no-op when called while OPEN', async () => {
    const { startWs, stopWs } = await import('./wsMiddleware');
    try {
      startWs();
      const [sock] = getInstances();
      sock.simulateOpen();

      startWs(); // already OPEN — no-op
      startWs(); // already OPEN — no-op

      expect(getInstances()).toHaveLength(1);
    } finally {
      stopWs();
    }
  });

  it('detaches old handlers when called while CLOSING to prevent orphan socket', async () => {
    const { startWs, stopWs } = await import('./wsMiddleware');
    try {
      startWs();
      const [sock1] = getInstances();
      sock1.simulateOpen();

      // Drive sock1 into CLOSING state without firing onclose yet.
      sock1.readyState = WS_CLOSING;

      // Calling connect() again while CLOSING must create a new socket
      // and detach sock1's handlers so its deferred onclose cannot null out sock2.
      startWs();

      expect(getInstances()).toHaveLength(2);

      // sock1's onclose handler must have been detached.
      expect(sock1.onclose).toBeNull();

      // Firing the deferred close on sock1 must NOT affect the new socket.
      sock1.simulateClose(); // safe: onclose is null, no-op

      // The new socket is still alive and tracked.
      const [, sock2] = getInstances();
      expect(sock2.readyState).toBe(WS_CONNECTING);
    } finally {
      stopWs();
    }
  });

  it('does not schedule a reconnect when old CLOSING socket is detached', async () => {
    vi.useFakeTimers();
    const { startWs, stopWs } = await import('./wsMiddleware');
    try {
      startWs();
      const [sock1] = getInstances();
      sock1.simulateOpen();

      sock1.readyState = WS_CLOSING;
      startWs(); // detaches sock1, creates sock2

      // Manually trigger what would have been sock1's onclose — handlers are null,
      // so nothing fires. Advance timers to confirm no reconnect loop starts.
      vi.runAllTimers();

      // Still only 2 sockets (sock1 orphan detached, sock2 alive, no reconnect loop).
      expect(getInstances()).toHaveLength(2);
    } finally {
      stopWs();
      vi.useRealTimers();
    }
  });
});
