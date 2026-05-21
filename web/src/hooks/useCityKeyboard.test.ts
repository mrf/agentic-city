import { describe, it, expect } from 'vitest';
import { sanitizeAgentIndex } from './useCityKeyboard';

function agent(id: string): { id: string } {
  return { id };
}

describe('sanitizeAgentIndex', () => {
  it('returns null when focusedIndex is null', () => {
    expect(sanitizeAgentIndex([agent('a')], [agent('a')], null)).toBeNull();
  });

  it('returns same index when focused agent is still at that position', () => {
    const agents = [agent('a'), agent('b'), agent('c')];
    expect(sanitizeAgentIndex(agents, agents, 1)).toBe(1);
  });

  it('follows agent to its new index when list order changes', () => {
    const prev = [agent('a'), agent('b'), agent('c')];
    const next = [agent('b'), agent('a'), agent('c')]; // a moved from 0→1, b from 1→0
    expect(sanitizeAgentIndex(prev, next, 0)).toBe(1); // was on 'a', now at 1
  });

  it('returns null when focused agent disappears', () => {
    const prev = [agent('a'), agent('b'), agent('c')];
    const next = [agent('a'), agent('c')]; // 'b' removed
    expect(sanitizeAgentIndex(prev, next, 1)).toBeNull(); // was on 'b', now gone
  });

  it('does not silently jump to a different agent when one disappears at same index', () => {
    const prev = [agent('a'), agent('b'), agent('c')];
    const next = [agent('a'), agent('c')]; // 'b' removed; 'c' now at index 1
    // focusedIndex was 1 ('b'). 'b' is gone → null, not 'c'.
    expect(sanitizeAgentIndex(prev, next, 1)).toBeNull();
  });

  it('returns null when index was out of bounds in previous list', () => {
    const prev = [agent('a')];
    const next = [agent('a'), agent('b')];
    expect(sanitizeAgentIndex(prev, next, 5)).toBeNull();
  });

  it('handles empty next list', () => {
    const prev = [agent('a'), agent('b')];
    expect(sanitizeAgentIndex(prev, [], 0)).toBeNull();
  });

  it('handles empty prev list', () => {
    expect(sanitizeAgentIndex([], [agent('a')], 0)).toBeNull();
  });
});
