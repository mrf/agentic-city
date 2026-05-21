import { describe, it, expect } from 'vitest';
import { IsometricCamera } from './IsometricCamera';
import { hitTestAgents } from './HitTester';
import type { Agent, Building } from '../store/cityStore';

function mkCamera(): IsometricCamera {
  // 800×600 canvas, scale=1
  return new IsometricCamera(800, 600);
}

function mkBuilding(id: string, gx: number, gy: number, gw = 4, gh = 4, gz = 3): Building {
  return {
    id, gx, gy, gw, gh, gz,
    districtId: 'd', label: id, language: 'ts',
    loc: 10, coverage: 0.9, status: 'ok', editing: false, exports: 0,
  };
}

function mkAgent(overrides: Partial<Agent>): Agent {
  return {
    id: 'agent-1',
    color: 'blue',
    mode: 'work',
    task: 'task',
    progress: 0.5,
    ...overrides,
  };
}

describe('hitTestAgents — hovering agent (targetId)', () => {
  it('returns agent index when clicking near its screen position', () => {
    const camera = mkCamera();
    const building = mkBuilding('b1', 0, 0);
    const agent = mkAgent({ targetId: 'b1' });

    // Compute the expected screen position: roof centre pushed up then pushed
    // outward from city centre by UFO_OUTWARD_PUSH=80 px (scale=1).
    const cx = building.gx + building.gw / 2;
    const cy = building.gy + building.gh / 2;
    const roofPt = camera.project(cx, cy, building.gz);
    // City centre is the average of building screen centres (gz=0 plane)
    const cityPt = camera.project(cx, cy, 0);
    const baseX = roofPt[0];
    const baseY = roofPt[1] - 30; // 30 * clampedScale at scale=1
    const dx = baseX - cityPt[0];
    const dy = baseY - cityPt[1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const UFO_OUTWARD_PUSH = 80;
    const expectedSx = baseX + (dx / len) * UFO_OUTWARD_PUSH;
    const expectedSy = baseY + (dy / len) * UFO_OUTWARD_PUSH;

    const result = hitTestAgents(camera, [agent], [building], expectedSx, expectedSy);
    expect(result).toBe(0);
  });

  it('returns null when clicking far from any agent', () => {
    const camera = mkCamera();
    const building = mkBuilding('b1', 0, 0);
    const agent = mkAgent({ targetId: 'b1' });
    const result = hitTestAgents(camera, [agent], [building], 0, 0);
    expect(result).toBeNull();
  });
});

describe('hitTestAgents — staging agent (no targetId, no flight)', () => {
  it('returns agent index when clicking near staging position above city centre', () => {
    const camera = mkCamera();
    const building = mkBuilding('b1', 0, 0);
    const agent = mkAgent({ id: 'agent-staging' }); // no targetId, no fromId/toId

    // City centre screen = average of building screen centres
    const bScreenPt = camera.project(building.gx + building.gw / 2, building.gy + building.gh / 2, 0);
    const cityCenterSx = bScreenPt[0];
    const cityCenterSy = bScreenPt[1];

    // slot=0: col=0, row=0, offsetX=(0-1)*40*1=-40, offsetY=0
    // sy = cityCenterSy - (100+0)*1 = cityCenterSy - 100
    const expectedSx = cityCenterSx - 40;
    const expectedSy = cityCenterSy - 100;

    const result = hitTestAgents(camera, [agent], [building], expectedSx, expectedSy);
    expect(result).toBe(0);
  });

  it('assigns correct slot positions when multiple staging agents present', () => {
    const camera = mkCamera();
    const building = mkBuilding('b1', 0, 0);
    const bScreenPt = camera.project(building.gx + building.gw / 2, building.gy + building.gh / 2, 0);
    const cityCenterSx = bScreenPt[0];
    const cityCenterSy = bScreenPt[1];

    const agents = [
      mkAgent({ id: 'agent-0' }),
      mkAgent({ id: 'agent-1' }),
      mkAgent({ id: 'agent-2' }),
    ];

    // slot 1: col=1, row=0, offsetX=(1-1)*40=0, sy = cityCenterSy-100
    const slot1Sx = cityCenterSx + 0;
    const slot1Sy = cityCenterSy - 100;

    const result = hitTestAgents(camera, agents, [building], slot1Sx, slot1Sy);
    expect(result).toBe(1);
  });
});

describe('hitTestAgents — flying agent (fromId + toId + flyProgress)', () => {
  it('returns agent index when clicking near its bezier position', () => {
    const camera = mkCamera();
    const from = mkBuilding('b1', 0, 0);
    const to = mkBuilding('b2', 10, 10);
    const agent = mkAgent({ id: 'agent-fly', fromId: 'b1', toId: 'b2', flyProgress: 0.5 });

    // Compute expected bezier midpoint (t=0.5)
    const fromPt = camera.project(from.gx + from.gw / 2, from.gy + from.gh / 2, from.gz);
    const toPt   = camera.project(to.gx + to.gw / 2,   to.gy + to.gh / 2,   to.gz);
    const FLIGHT_ARC_H = 80;
    const p0: [number, number] = [fromPt[0], fromPt[1]];
    const p3: [number, number] = [toPt[0], toPt[1]];
    const p1: [number, number] = [fromPt[0], fromPt[1] - FLIGHT_ARC_H];
    const p2: [number, number] = [toPt[0], toPt[1] - FLIGHT_ARC_H];
    const t = 0.5;
    const mt = 1 - t;
    const expectedSx = mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0];
    const expectedSy = mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1];

    const result = hitTestAgents(camera, [agent], [from, to], expectedSx, expectedSy);
    expect(result).toBe(0);
  });

  it('returns null when flying agent buildings are not found', () => {
    const camera = mkCamera();
    const agent = mkAgent({ id: 'agent-fly', fromId: 'missing1', toId: 'missing2', flyProgress: 0.5 });
    const result = hitTestAgents(camera, [agent], [], 400, 300);
    expect(result).toBeNull();
  });
});

describe('hitTestAgents — empty input', () => {
  it('returns null for empty agent list', () => {
    const camera = mkCamera();
    const result = hitTestAgents(camera, [], [], 400, 300);
    expect(result).toBeNull();
  });
});
