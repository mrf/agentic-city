import { describe, it, expect } from 'vitest';
import { formatCoverage, districtCoverageColor } from './BuildingRenderer';

describe('formatCoverage', () => {
  it('formats known coverage as integer percent', () => {
    expect(formatCoverage(0.72)).toBe('72%');
    expect(formatCoverage(0.8)).toBe('80%');
    expect(formatCoverage(0.0)).toBe('0%');
    expect(formatCoverage(1.0)).toBe('100%');
  });

  it('rounds to nearest integer', () => {
    expect(formatCoverage(0.666)).toBe('67%');
    expect(formatCoverage(0.334)).toBe('33%');
  });

  it('returns empty string for unknown coverage (-1)', () => {
    expect(formatCoverage(-1)).toBe('');
  });
});

describe('districtCoverageColor', () => {
  it('returns green for coverage >= 0.8', () => {
    const color = districtCoverageColor(0.8);
    expect(typeof color).toBe('string');
    expect(color).toMatch(/^#/);
    const high = districtCoverageColor(0.95);
    expect(high).toBe(color);
  });

  it('returns yellow for coverage in [0.5, 0.8)', () => {
    const mid = districtCoverageColor(0.65);
    const low80 = districtCoverageColor(0.5);
    expect(mid).toBe(low80);
    expect(mid).not.toBe(districtCoverageColor(0.8));
  });

  it('returns red for coverage < 0.5', () => {
    const low = districtCoverageColor(0.3);
    const vlow = districtCoverageColor(0.0);
    expect(low).toBe(vlow);
    expect(low).not.toBe(districtCoverageColor(0.5));
  });

  it('returns distinct colors for each tier', () => {
    const green = districtCoverageColor(0.9);
    const yellow = districtCoverageColor(0.6);
    const red = districtCoverageColor(0.2);
    expect(green).not.toBe(yellow);
    expect(yellow).not.toBe(red);
    expect(green).not.toBe(red);
  });
});
