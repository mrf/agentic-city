import { describe, it, expect } from 'vitest';
import { computeLodLevel, LOD_THRESHOLDS } from './uiStore';

describe('LOD_THRESHOLDS', () => {
  it('L2.leave is at a usable zoom level (>= 1.5)', () => {
    // Before the fix, L2.leave was 0.9 — far too zoomed out.
    // Buildings must still be readable (not microscopic) at the transition.
    expect(LOD_THRESHOLDS.L2.leave).toBeGreaterThanOrEqual(1.5);
  });

  it('L2.enter is above L2.leave to maintain hysteresis (avoid flicker)', () => {
    expect(LOD_THRESHOLDS.L2.enter).toBeGreaterThan(LOD_THRESHOLDS.L2.leave);
  });
});

describe('computeLodLevel — L2/L3 boundary', () => {
  it('stays L2 at the new leave threshold itself', () => {
    // Exactly at the boundary stays in the current level until strictly below.
    expect(computeLodLevel(LOD_THRESHOLDS.L2.leave, 'L2')).toBe('L2');
  });

  it('transitions L2 → L3 just below the new leave threshold', () => {
    const justBelow = LOD_THRESHOLDS.L2.leave - 0.01;
    expect(computeLodLevel(justBelow, 'L2')).toBe('L3');
  });

  it('old threshold (0.9) no longer triggers L2 → L3', () => {
    // With the raised threshold, zooming to 0.9 should already be in L3,
    // but when computing from L2 state the value < new leave triggers L3.
    // Key assertion: L2.leave must be well above 0.9 so the transition is
    // earlier (at a more usable zoom), not later.
    expect(LOD_THRESHOLDS.L2.leave).toBeGreaterThan(0.9);
  });

  it('transitions L3 → L2 at the new enter threshold', () => {
    expect(computeLodLevel(LOD_THRESHOLDS.L2.enter, 'L3')).toBe('L2');
  });

  it('stays L3 just below the new enter threshold (dead band)', () => {
    const justBelow = LOD_THRESHOLDS.L2.enter - 0.01;
    expect(computeLodLevel(justBelow, 'L3')).toBe('L3');
  });
});

describe('computeLodLevel — other boundaries unaffected', () => {
  it('L1 → L2 at L1.leave', () => {
    const justBelow = LOD_THRESHOLDS.L1.leave - 0.01;
    expect(computeLodLevel(justBelow, 'L1')).toBe('L2');
    expect(computeLodLevel(LOD_THRESHOLDS.L1.leave, 'L1')).toBe('L1');
  });

  it('L3 → L4 at L3.leave', () => {
    const justBelow = LOD_THRESHOLDS.L3.leave - 0.01;
    expect(computeLodLevel(justBelow, 'L3')).toBe('L4');
    expect(computeLodLevel(LOD_THRESHOLDS.L3.leave, 'L3')).toBe('L3');
  });

  it('L4 → L3 at L3.enter', () => {
    expect(computeLodLevel(LOD_THRESHOLDS.L3.enter, 'L4')).toBe('L3');
    const justBelow = LOD_THRESHOLDS.L3.enter - 0.01;
    expect(computeLodLevel(justBelow, 'L4')).toBe('L4');
  });
});
