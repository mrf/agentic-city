import { create } from 'zustand';

export interface CoverageSnapshot {
  ts: number;
  aggregate: number;          // -1 if no coverage data
  files: Record<string, number>; // filepath → ratio
}

export type DeltaDirection = 'up' | 'down' | 'stable';

export interface CoverageDelta {
  value: number;              // current − previous (e.g. +0.05 = +5pp)
  direction: DeltaDirection;
}

/** Threshold below which a change is treated as stable (0.1pp). */
const STABLE_THRESHOLD = 0.001;

/**
 * Computes the aggregate coverage delta between the last two snapshots.
 * Returns null when there are fewer than two snapshots or when either
 * snapshot has unknown coverage (aggregate === -1).
 */
export function computeAggregateDelta(snapshots: CoverageSnapshot[]): CoverageDelta | null {
  if (snapshots.length < 2) return null;
  const prev = snapshots[snapshots.length - 2];
  const curr = snapshots[snapshots.length - 1];
  if (prev.aggregate < 0 || curr.aggregate < 0) return null;
  const value = curr.aggregate - prev.aggregate;
  return { value, direction: deltaDirection(value) };
}

/**
 * Computes the per-file coverage delta between the last two snapshots.
 * Returns null when there are fewer than two snapshots or when fileId is
 * not present in both snapshots.
 */
export function computeFileDelta(snapshots: CoverageSnapshot[], fileId: string): CoverageDelta | null {
  if (snapshots.length < 2) return null;
  const prev = snapshots[snapshots.length - 2];
  const curr = snapshots[snapshots.length - 1];
  const prevCov = prev.files[fileId];
  const currCov = curr.files[fileId];
  if (prevCov === undefined || currCov === undefined) return null;
  const value = currCov - prevCov;
  return { value, direction: deltaDirection(value) };
}

function deltaDirection(value: number): DeltaDirection {
  if (Math.abs(value) < STABLE_THRESHOLD) return 'stable';
  return value > 0 ? 'up' : 'down';
}

interface CoverageHistoryStore {
  snapshots: CoverageSnapshot[];
  loading: boolean;
  fetch: () => Promise<void>;
}

export const useCoverageHistoryStore = create<CoverageHistoryStore>((set) => ({
  snapshots: [],
  loading: false,
  fetch: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/coverage/history');
      if (!res.ok) return;
      const data = (await res.json()) as { snapshots: CoverageSnapshot[] };
      set({ snapshots: data.snapshots ?? [] });
    } finally {
      set({ loading: false });
    }
  },
}));
