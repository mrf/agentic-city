/**
 * HitTester — click/cursor detection on isometric building shapes.
 *
 * Hit tests operate in screen space against each building's visible silhouette
 * polygon, covering all three visible faces (right wall, left wall, roof). This
 * correctly handles clicks on roofs and side walls, not just the ground footprint.
 *
 * Proximity search finds the nearest building by screen-projected center — used
 * to place the keyboard cursor when the user clicks outside any building outline.
 */

import type { IsometricCamera } from './IsometricCamera';
import type { Building, Agent } from '../store/cityStore';

function pointInPolygon(px: number, py: number, poly: [number, number][]): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Outer silhouette of a building in screen coordinates.
 * Six vertices: base front → base right → top right → top back → top left → base left.
 * Omits the near-top corner (it always falls inside the hull for any valid box).
 */
function buildingSilhouette(
  camera: IsometricCamera,
  b: Building,
): [number, number][] {
  return [
    camera.project(b.gx,        b.gy,        0),
    camera.project(b.gx + b.gw, b.gy,        0),
    camera.project(b.gx + b.gw, b.gy,        b.gz),
    camera.project(b.gx + b.gw, b.gy + b.gh, b.gz),
    camera.project(b.gx,        b.gy + b.gh, b.gz),
    camera.project(b.gx,        b.gy + b.gh, 0),
  ];
}

export function hitBuilding(
  camera: IsometricCamera,
  b: Building,
  sx: number,
  sy: number,
): boolean {
  return pointInPolygon(sx, sy, buildingSilhouette(camera, b));
}

/**
 * Return the topmost building at screen point (sx, sy), or null if none.
 * Sorts back-to-front (ascending gx+gy) to match draw order so the visually
 * frontmost building wins when outlines overlap.
 */
export function hitTestBuildings(
  camera: IsometricCamera,
  buildings: Building[],
  sx: number,
  sy: number,
): Building | null {
  const sorted = [...buildings].sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));
  let hit: Building | null = null;
  for (const b of sorted) {
    if (hitBuilding(camera, b, sx, sy)) hit = b;
  }
  return hit;
}

/** Compute an agent's screen position (ignoring hover bob). */
function agentScreenPos(
  camera: IsometricCamera,
  agent: Agent,
  buildMap: Map<string, Building>,
): [number, number] | null {
  if (agent.targetId) {
    const target = buildMap.get(agent.targetId);
    if (!target) return null;
    const cx = target.gx + target.gw / 2;
    const cy = target.gy + target.gh / 2;
    const roofPt = camera.project(cx, cy, target.gz);
    const hoverY = roofPt[1] - 30 * Math.max(0.6, Math.min(1.5, camera.scale));
    return [roofPt[0], hoverY];
  }
  return null;
}

const UFO_HIT_RADIUS = 18;

/**
 * Return the agent at screen point (sx, sy), or null if none.
 * Returns the index into the agents array for direct use with focusedAgentIndex.
 */
export function hitTestAgents(
  camera: IsometricCamera,
  agents: Agent[],
  buildings: Building[],
  sx: number,
  sy: number,
): number | null {
  if (agents.length === 0) return null;
  const buildMap = new Map<string, Building>(buildings.map((b) => [b.id, b]));
  const hitR = UFO_HIT_RADIUS * Math.max(0.5, Math.min(1.8, camera.scale));

  let bestIdx: number | null = null;
  let bestDist = hitR * hitR;

  for (let i = 0; i < agents.length; i++) {
    const pos = agentScreenPos(camera, agents[i], buildMap);
    if (!pos) continue;
    const d = (pos[0] - sx) ** 2 + (pos[1] - sy) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  return bestIdx;
}

/**
 * Return the building whose screen-projected center is nearest to (sx, sy),
 * or null when the array is empty.
 */
export function nearestBuildingToScreen(
  camera: IsometricCamera,
  buildings: Building[],
  sx: number,
  sy: number,
): Building | null {
  if (buildings.length === 0) return null;

  let best: Building | null = null;
  let bestDist = Infinity;

  for (const b of buildings) {
    const [cx, cy] = camera.project(b.gx + b.gw / 2, b.gy + b.gh / 2, b.gz / 2);
    const d = (cx - sx) ** 2 + (cy - sy) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }

  return best;
}
