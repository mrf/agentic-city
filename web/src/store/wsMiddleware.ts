/**
 * WebSocket middleware — connects to the backend hub, handles state.full
 * snapshots and state.patch (RFC 6902) incremental updates, and auto-reconnects.
 *
 * Usage: call startWs() once at app mount, stopWs() on unmount / cleanup.
 */

import { useCityStore } from './cityStore';
import type { CityState } from './cityStore';

// ── Message types ─────────────────────────────────────────────────────────────

interface FullStateMsg {
  type: 'state.full';
  data: CityState;
}

interface JsonPatchOp {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
}

interface PatchMsg {
  type: 'state.patch';
  patches: JsonPatchOp[];
}

type WsMessage = FullStateMsg | PatchMsg;

// ── RFC 6902 JSON Patch applicator ────────────────────────────────────────────
// Supports add, remove, replace. The backend hub only generates these three.

/** Decode an RFC 6901 path string into an array of key segments. */
function parsePath(path: string): string[] {
  if (path === '' || path === '/') return [];
  // Strip leading '/' then split; unescape ~1 → '/' and ~0 → '~'
  return path
    .slice(1)
    .split('/')
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/** Immutably set value at the given path segments inside doc. */
function setAt(doc: unknown, segments: string[], value: unknown): unknown {
  if (segments.length === 0) return value;
  const [head, ...tail] = segments;

  if (Array.isArray(doc)) {
    const arr = doc.slice();
    if (head === '-') {
      // RFC 6902: '-' means append
      arr.push(tail.length === 0 ? value : setAt(undefined, tail, value));
    } else {
      const idx = Number(head);
      arr[idx] = setAt(arr[idx], tail, value);
    }
    return arr;
  }

  const obj = (doc ?? {}) as Record<string, unknown>;
  return { ...obj, [head]: setAt(obj[head], tail, value) };
}

/** Immutably remove the value at the given path segments inside doc. */
function removeAt(doc: unknown, segments: string[]): unknown {
  if (segments.length === 0) return doc;
  const [head, ...tail] = segments;

  if (Array.isArray(doc)) {
    const arr = doc.slice();
    if (tail.length === 0) {
      arr.splice(Number(head), 1);
    } else {
      arr[Number(head)] = removeAt(arr[Number(head)], tail);
    }
    return arr;
  }

  const obj = { ...(doc as Record<string, unknown>) };
  if (tail.length === 0) {
    delete obj[head];
  } else {
    obj[head] = removeAt(obj[head], tail);
  }
  return obj;
}

/** Apply a single RFC 6902 operation to doc, returning a new immutable doc. */
function applyOp(doc: unknown, op: JsonPatchOp): unknown {
  const segments = parsePath(op.path);
  switch (op.op) {
    case 'add':
    case 'replace':
      return setAt(doc, segments, op.value);
    case 'remove':
      return removeAt(doc, segments);
    default:
      return doc;
  }
}

/** Apply a sequence of RFC 6902 operations to doc in order. */
function applyPatches(doc: unknown, patches: JsonPatchOp[]): unknown {
  return patches.reduce(applyOp, doc);
}

// ── Connection status ─────────────────────────────────────────────────────────

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

type StatusCallback = (status: WsStatus) => void;

let currentStatus: WsStatus = 'disconnected';
const statusSubscribers = new Set<StatusCallback>();

function notifyStatus(status: WsStatus): void {
  currentStatus = status;
  for (const cb of statusSubscribers) {
    cb(status);
  }
}

/** Get the current WebSocket connection status. */
export function getWsStatus(): WsStatus {
  return currentStatus;
}

/** Subscribe to connection status changes. Returns an unsubscribe function. */
export function subscribeWsStatus(cb: StatusCallback): () => void {
  statusSubscribers.add(cb);
  return () => { statusSubscribers.delete(cb); };
}

// ── WebSocket connection ───────────────────────────────────────────────────────

const RECONNECT_DELAY_MS = 3_000;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let stopped = false;

function wsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

function handleMessage(raw: MessageEvent): void {
  let msg: WsMessage;
  try {
    msg = JSON.parse(raw.data as string) as WsMessage;
  } catch {
    return;
  }

  const store = useCityStore.getState();

  if (msg.type === 'state.full') {
    store.setCity(msg.data);
  } else if (msg.type === 'state.patch') {
    const next = applyPatches(store.city, msg.patches) as CityState;
    store.setCity(next);
  }
}

function connect(): void {
  if (stopped) return;
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

  ws = new WebSocket(wsUrl());
  notifyStatus('connecting');

  ws.onopen = () => {
    notifyStatus('connected');
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  ws.onmessage = handleMessage;

  ws.onclose = () => {
    ws = null;
    notifyStatus('disconnected');
    if (!stopped) {
      reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
    }
  };

  ws.onerror = () => {
    // onclose fires after onerror, so reconnect is handled there
  };
}

/**
 * Start the WebSocket connection and enable auto-reconnect.
 * Safe to call multiple times — a no-op if already connected.
 */
export function startWs(): void {
  stopped = false;
  connect();
}

/**
 * Stop the WebSocket connection and cancel any pending reconnect.
 * Call on app unmount or when the WS feed is no longer needed.
 */
export function stopWs(): void {
  stopped = true;
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  ws?.close();
  ws = null;
  notifyStatus('disconnected');
}
