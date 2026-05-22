import { describe, it, expect } from 'vitest';
import {
  computeAggregateDelta,
  computeFileDelta,
  type CoverageSnapshot,
} from './coverageHistoryStore';

const makeSnap = (ts: number, aggregate: number, files: Record<string, number> = {}): CoverageSnapshot => ({
  ts,
  aggregate,
  files,
});

describe('computeAggregateDelta', () => {
  it('returns null with fewer than 2 snapshots', () => {
    expect(computeAggregateDelta([])).toBeNull();
    expect(computeAggregateDelta([makeSnap(1, 0.5)])).toBeNull();
  });

  it('returns positive delta when coverage improved', () => {
    const snaps = [makeSnap(1, 0.5), makeSnap(2, 0.7)];
    const delta = computeAggregateDelta(snaps);
    expect(delta).not.toBeNull();
    expect(delta!.value).toBeCloseTo(0.2);
    expect(delta!.direction).toBe('up');
  });

  it('returns negative delta when coverage regressed', () => {
    const snaps = [makeSnap(1, 0.8), makeSnap(2, 0.6)];
    const delta = computeAggregateDelta(snaps);
    expect(delta).not.toBeNull();
    expect(delta!.value).toBeCloseTo(-0.2);
    expect(delta!.direction).toBe('down');
  });

  it('returns stable when delta is below threshold', () => {
    const snaps = [makeSnap(1, 0.7000), makeSnap(2, 0.7001)];
    const delta = computeAggregateDelta(snaps);
    expect(delta).not.toBeNull();
    expect(delta!.direction).toBe('stable');
  });

  it('uses last two snapshots regardless of slice length', () => {
    const snaps = [
      makeSnap(1, 0.3),
      makeSnap(2, 0.4),
      makeSnap(3, 0.9), // most recent
      makeSnap(4, 0.6), // latest
    ];
    const delta = computeAggregateDelta(snaps);
    // delta = 0.6 - 0.9 = -0.3
    expect(delta!.value).toBeCloseTo(-0.3);
    expect(delta!.direction).toBe('down');
  });
});

describe('computeFileDelta', () => {
  it('returns null when fewer than 2 snapshots', () => {
    expect(computeFileDelta([], 'a.go')).toBeNull();
    expect(computeFileDelta([makeSnap(1, 0.5, { 'a.go': 0.8 })], 'a.go')).toBeNull();
  });

  it('returns null when file not present in both snapshots', () => {
    const snaps = [makeSnap(1, 0.5, {}), makeSnap(2, 0.6, { 'a.go': 0.8 })];
    expect(computeFileDelta(snaps, 'a.go')).toBeNull();
  });

  it('returns delta for a file present in both snapshots', () => {
    const snaps = [
      makeSnap(1, 0.5, { 'a.go': 0.6 }),
      makeSnap(2, 0.7, { 'a.go': 0.9 }),
    ];
    const delta = computeFileDelta(snaps, 'a.go');
    expect(delta).not.toBeNull();
    expect(delta!.value).toBeCloseTo(0.3);
    expect(delta!.direction).toBe('up');
  });
});
