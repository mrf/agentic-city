import { describe, it, expect } from 'vitest';
import { detectCoverageDrop, COVERAGE_DROP_MIN_DELTA } from './useCoverageWatcher';

type BuildingLike = { id: string; coverage: number };

describe('detectCoverageDrop', () => {
  it('returns null when previous aggregate coverage is unknown', () => {
    const prev: BuildingLike[] = [{ id: 'a', coverage: -1 }];
    const next: BuildingLike[] = [{ id: 'a', coverage: 0.5 }];
    expect(detectCoverageDrop(prev, next, -1, 0.5)).toBeNull();
  });

  it('returns null when next aggregate coverage is unknown', () => {
    const prev: BuildingLike[] = [{ id: 'a', coverage: 0.9 }];
    const next: BuildingLike[] = [{ id: 'a', coverage: -1 }];
    expect(detectCoverageDrop(prev, next, 0.9, -1)).toBeNull();
  });

  it('returns null when coverage did not drop', () => {
    const prev: BuildingLike[] = [{ id: 'a', coverage: 0.8 }];
    const next: BuildingLike[] = [{ id: 'a', coverage: 0.85 }];
    expect(detectCoverageDrop(prev, next, 0.8, 0.85)).toBeNull();
  });

  it('returns null when drop is below the minimum delta', () => {
    const delta = COVERAGE_DROP_MIN_DELTA / 2; // half a percent
    const prev: BuildingLike[] = [{ id: 'a', coverage: 0.9 }];
    const next: BuildingLike[] = [{ id: 'a', coverage: 0.9 - delta }];
    expect(detectCoverageDrop(prev, next, 0.9, 0.9 - delta)).toBeNull();
  });

  it('returns result when aggregate drops by exactly the minimum delta', () => {
    const prev: BuildingLike[] = [{ id: 'a', coverage: 0.9 }];
    const next: BuildingLike[] = [{ id: 'a', coverage: 0.9 - COVERAGE_DROP_MIN_DELTA }];
    const result = detectCoverageDrop(
      prev, next, 0.9, 0.9 - COVERAGE_DROP_MIN_DELTA,
    );
    expect(result).not.toBeNull();
    expect(result!.affectedFileIds).toContain('a');
  });

  it('returns affected files whose individual coverage dropped', () => {
    const prev: BuildingLike[] = [
      { id: 'a', coverage: 0.9 },
      { id: 'b', coverage: 0.7 },
    ];
    const next: BuildingLike[] = [
      { id: 'a', coverage: 0.75 },  // dropped
      { id: 'b', coverage: 0.75 },  // increased — should not appear
    ];
    const result = detectCoverageDrop(prev, next, 0.85, 0.75);
    expect(result).not.toBeNull();
    expect(result!.affectedFileIds).toContain('a');
    expect(result!.affectedFileIds).not.toContain('b');
  });

  it('excludes files with unknown coverage from affected list', () => {
    const prev: BuildingLike[] = [
      { id: 'a', coverage: 0.9 },
      { id: 'b', coverage: -1 },  // unknown
    ];
    const next: BuildingLike[] = [
      { id: 'a', coverage: 0.7 },
      { id: 'b', coverage: 0.5 },  // appeared but no prior baseline
    ];
    const result = detectCoverageDrop(prev, next, 0.9, 0.7);
    expect(result).not.toBeNull();
    expect(result!.affectedFileIds).toContain('a');
    expect(result!.affectedFileIds).not.toContain('b');
  });

  it('handles new files (not in previous) gracefully', () => {
    const prev: BuildingLike[] = [{ id: 'a', coverage: 0.9 }];
    const next: BuildingLike[] = [
      { id: 'a', coverage: 0.7 },
      { id: 'new', coverage: 0.5 },  // new file — no baseline
    ];
    const result = detectCoverageDrop(prev, next, 0.9, 0.7);
    expect(result).not.toBeNull();
    expect(result!.affectedFileIds).toContain('a');
    expect(result!.affectedFileIds).not.toContain('new');
  });

  it('returns empty affectedFileIds when aggregate drops but no individual file dropped', () => {
    // Edge case: aggregate dropped but all files either stayed same or gained
    // (can happen due to a removed file that had high coverage)
    const prev: BuildingLike[] = [{ id: 'a', coverage: 0.9 }];
    const next: BuildingLike[] = [{ id: 'a', coverage: 0.9 }];
    const result = detectCoverageDrop(prev, next, 0.9, 0.75);
    expect(result).not.toBeNull();
    expect(result!.affectedFileIds).toHaveLength(0);
  });
});
