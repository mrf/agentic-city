import { describe, it, expect, beforeEach } from 'vitest';
import { computeLodLevel, LOD_THRESHOLDS, useUiStore } from './uiStore';

describe('LOD_THRESHOLDS', () => {
  it('L2.leave is at a usable zoom level (>= 2.0)', () => {
    // Raised from 1.5 → 2.0 (2 wheel notches sooner) so LOD switches before
    // buildings shrink to microscopic. Original pre-fix value was 0.9.
    expect(LOD_THRESHOLDS.L2.leave).toBeGreaterThanOrEqual(2.0);
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

  it('previous thresholds (0.9, 1.5) no longer trigger L2 → L3', () => {
    // L2.leave was 0.9 before first fix, 1.5 before second fix.
    // Now raised to 2.0 so the transition triggers 2 wheel notches sooner.
    expect(LOD_THRESHOLDS.L2.leave).toBeGreaterThan(1.5);
  });

  it('transitions L3 → L2 at the new enter threshold', () => {
    expect(computeLodLevel(LOD_THRESHOLDS.L2.enter, 'L3')).toBe('L2');
  });

  it('stays L3 just below the new enter threshold (dead band)', () => {
    const justBelow = LOD_THRESHOLDS.L2.enter - 0.01;
    expect(computeLodLevel(justBelow, 'L3')).toBe('L3');
  });
});

describe('toggle independence — N/M key conflict regression (agentic-city-1dj)', () => {
  // Regression: pressing N was toggling both labels AND minimap simultaneously.
  // These tests lock down that each toggle action only affects its own field.

  beforeEach(() => {
    // Reset relevant visibility toggles to known state before each test.
    useUiStore.setState({ showLabels: true, showMinimap: false });
  });

  it('toggleLabels flips showLabels', () => {
    useUiStore.getState().toggleLabels();
    expect(useUiStore.getState().showLabels).toBe(false);
    useUiStore.getState().toggleLabels();
    expect(useUiStore.getState().showLabels).toBe(true);
  });

  it('toggleLabels does not change showMinimap', () => {
    const before = useUiStore.getState().showMinimap;
    useUiStore.getState().toggleLabels();
    expect(useUiStore.getState().showMinimap).toBe(before);
  });

  it('toggleMinimap flips showMinimap', () => {
    useUiStore.getState().toggleMinimap();
    expect(useUiStore.getState().showMinimap).toBe(true);
    useUiStore.getState().toggleMinimap();
    expect(useUiStore.getState().showMinimap).toBe(false);
  });

  it('toggleMinimap does not change showLabels', () => {
    const before = useUiStore.getState().showLabels;
    useUiStore.getState().toggleMinimap();
    expect(useUiStore.getState().showLabels).toBe(before);
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
