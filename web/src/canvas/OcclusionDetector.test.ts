import { describe, it, expect } from 'vitest';
import type { Building } from '../store/cityStore';
import { findPassiveOccluders } from './OcclusionDetector';

function mkBuilding(
  id: string,
  gx: number,
  gy: number,
  gw = 2,
  gh = 2,
  gz = 3,
): Building {
  return {
    id,
    gx, gy, gw, gh, gz,
    districtId: 'd',
    label: id,
    language: 'ts',
    loc: 10,
    coverage: 0.9,
    status: 'ok',
    editing: false,
    exports: 0,
  };
}

describe('findPassiveOccluders', () => {
  it('returns empty map when buildings do not overlap in grid space', () => {
    // a at (0,0)-(2,2), b at (5,0)-(7,2): no X overlap
    const result = findPassiveOccluders([
      mkBuilding('a', 0, 0),
      mkBuilding('b', 5, 0),
    ]);
    expect(result.size).toBe(0);
  });

  it('returns empty map for a single building', () => {
    const result = findPassiveOccluders([mkBuilding('a', 0, 0)]);
    expect(result.size).toBe(0);
  });

  it('detects occluder when front building footprint overlaps back building', () => {
    // a at (0,0)-(2,2), sort key 0
    // b at (1,1)-(3,3), sort key 2  → b is in front and overlaps a
    const result = findPassiveOccluders([
      mkBuilding('a', 0, 0),
      mkBuilding('b', 1, 1),
    ]);
    // 'a' is behind 'b', so a should have b as its occluder
    expect(result.get('a')).toEqual(new Set(['b']));
    // 'b' is in front — nothing in front of it
    expect(result.has('b')).toBe(false);
  });

  it('does not add an occluder when sort keys are equal', () => {
    // Same sort key means neither is definitively in front of the other.
    // a: gx=0, gy=2 → key 2; b: gx=1, gy=1 → key 2 (equal)
    const result = findPassiveOccluders([
      mkBuilding('a', 0, 2),
      mkBuilding('b', 1, 1),
    ]);
    expect(result.size).toBe(0);
  });

  it('accumulates multiple occluders for one back building', () => {
    // a at (0,0)-(2,2), key 0
    // b at (1,1)-(3,3), key 2 — overlaps a in both axes
    // c at (0,1)-(2,3), key 1 — overlaps a in both axes, strictly in front (key 1 > 0)
    const a = mkBuilding('a', 0, 0);
    const b = mkBuilding('b', 1, 1);
    const c = mkBuilding('c', 0, 1);
    const result = findPassiveOccluders([a, b, c]);
    const aOccluders = result.get('a');
    expect(aOccluders).toBeDefined();
    expect(aOccluders).toContain('b');
    expect(aOccluders).toContain('c');
  });

  it('handles transitively nested occlusion: A behind B, B behind C', () => {
    // a at (0,0) key 0; b at (1,1) key 2 (in front of a, overlaps);
    // c at (2,2) key 4 (in front of b, overlaps b)
    const a = mkBuilding('a', 0, 0);
    const b = mkBuilding('b', 1, 1);
    const c = mkBuilding('c', 2, 2);
    const result = findPassiveOccluders([a, b, c]);
    // a is behind b (and c if footprints overlap)
    expect(result.get('a')).toBeDefined();
    // b is behind c
    expect(result.get('b')).toEqual(new Set(['c']));
  });

  it('does not include self as occluder', () => {
    const a = mkBuilding('a', 0, 0);
    const b = mkBuilding('b', 1, 1);
    const result = findPassiveOccluders([a, b]);
    const aOccluders = result.get('a');
    if (aOccluders) {
      expect(aOccluders.has('a')).toBe(false);
    }
    const bOccluders = result.get('b');
    if (bOccluders) {
      expect(bOccluders.has('b')).toBe(false);
    }
  });
});
