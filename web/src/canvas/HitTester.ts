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
import type { Building, Agent, DistrictBuilding } from '../store/cityStore';
import type { LodLevel } from '../store/uiStore';

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

// Mirror the constants from AgentRenderer so hit positions match draw positions exactly.
const FLIGHT_ARC_H         = 80;
const STAGING_SLOT_SPACING = 40;
const UFO_OUTWARD_PUSH     = 80;
const DISTRICT_SLOT_SPACING = 30;

/** Clamp camera scale to the same range AgentRenderer uses for UFO sizing. */
function clampScale(camera: IsometricCamera): number {
  return Math.max(0.6, Math.min(1.5, camera.scale));
}

/** Cubic bezier point at t — mirrors AnimationManager.bezier without the import. */
function bezierPoint(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  t: number,
): [number, number] {
  const mt = 1 - t;
  return [
    mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0],
    mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1],
  ];
}

/** Bezier arc position between two screen-projected roof centres at progress t. */
function flightArcPos(
  fromPt: [number, number],
  toPt: [number, number],
  progress: number,
): [number, number] {
  const p1: [number, number] = [fromPt[0], fromPt[1] - FLIGHT_ARC_H];
  const p2: [number, number] = [toPt[0],   toPt[1]   - FLIGHT_ARC_H];
  const t = Math.max(0, Math.min(1, progress));
  return bezierPoint(fromPt, p1, p2, toPt, t);
}

/**
 * Compute an agent's screen position (ignoring hover bob), matching AgentRenderer logic.
 *
 * Three cases:
 *   flying  — bezier arc between fromId and toId building roofs
 *   hovering — above targetId building roof
 *   staging  — above city centre in a slot grid (stagingSlot tracks how many
 *              staging agents have already been assigned positions this call)
 */
function agentScreenPos(
  camera: IsometricCamera,
  agent: Agent,
  buildMap: Map<string, Building>,
  cityCenter: [number, number],
  stagingSlot: number,
): [number, number] | null {
  const clampedScale = clampScale(camera);

  if (agent.fromId && agent.toId && agent.flyProgress !== undefined) {
    const from = buildMap.get(agent.fromId);
    const to   = buildMap.get(agent.toId);
    if (!from || !to) return null;

    const fromPt = camera.project(from.gx + from.gw / 2, from.gy + from.gh / 2, from.gz);
    const toPt   = camera.project(to.gx   + to.gw   / 2, to.gy   + to.gh   / 2, to.gz);
    return flightArcPos(fromPt, toPt, agent.flyProgress);
  }

  if (agent.targetId) {
    const target = buildMap.get(agent.targetId);
    if (!target) return null;
    const cx = target.gx + target.gw / 2;
    const cy = target.gy + target.gh / 2;
    const roofPt = camera.project(cx, cy, target.gz);
    const baseX = roofPt[0];
    const baseY = roofPt[1] - 30 * clampedScale;
    const dx = baseX - cityCenter[0];
    const dy = baseY - cityCenter[1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const push = UFO_OUTWARD_PUSH * clampedScale;
    return [baseX + (dx / len) * push, baseY + (dy / len) * push];
  }

  // Staging agent — parked above city centre in a 3-column grid.
  const col = stagingSlot % 3;
  const row = Math.floor(stagingSlot / 3);
  const offsetX = (col - 1) * STAGING_SLOT_SPACING * clampedScale;
  const offsetY = row * STAGING_SLOT_SPACING * 0.75 * clampedScale;
  return [
    cityCenter[0] + offsetX,
    cityCenter[1] - (100 + offsetY) * clampedScale,
  ];
}

/**
 * Screen position for an agent parked on a district building at L3.
 * Mirrors drawHoveringAgentOnDistrict from AgentRenderer (without hover bob).
 */
function districtHoverPos(
  camera: IsometricCamera,
  db: DistrictBuilding,
  slot: number,
): [number, number] {
  const clampedScale = clampScale(camera);
  const cx = db.gx + db.gw / 2;
  const cy = db.gy + db.gh / 2;
  const roofPt = camera.project(cx, cy, db.gz);
  const rank = Math.ceil(slot / 2);
  const side = slot % 2 === 0 ? 1 : -1;
  const offsetX = (slot === 0 ? 0 : side * rank) * DISTRICT_SLOT_SPACING * clampedScale;
  return [roofPt[0] + offsetX, roofPt[1] - 25 * clampedScale];
}

/** Compute average screen-space position of building centres (gz=0 plane). */
function cityCenterScreen(
  camera: IsometricCamera,
  buildings: Building[],
): [number, number] {
  if (buildings.length === 0) return [0, 0];
  let sumX = 0, sumY = 0;
  for (const b of buildings) {
    const [px, py] = camera.project(b.gx + b.gw / 2, b.gy + b.gh / 2, 0);
    sumX += px;
    sumY += py;
  }
  return [sumX / buildings.length, sumY / buildings.length];
}

const UFO_HIT_RADIUS = 18;

/**
 * Return the agent at screen point (sx, sy), or null if none.
 * Returns the index into the agents array for direct use with focusedAgentIndex.
 *
 * At L3, positions are computed using districtBuildings (mirroring AgentRenderer's L3 branch).
 * At L1/L2, existing file-level building logic is used. Parameters default to L2 behaviour
 * so existing callers without LOD arguments continue to work.
 */
export function hitTestAgents(
  camera: IsometricCamera,
  agents: Agent[],
  buildings: Building[],
  sx: number,
  sy: number,
  lod: LodLevel = 'L2',
  districtBuildings: DistrictBuilding[] = [],
): number | null {
  if (agents.length === 0) return null;
  const buildMap = new Map<string, Building>(buildings.map((b) => [b.id, b]));
  const cityCenter = cityCenterScreen(camera, buildings);
  const hitR = UFO_HIT_RADIUS * Math.max(0.5, Math.min(1.8, camera.scale));

  let bestIdx: number | null = null;
  let bestDist = hitR * hitR;

  if (lod === 'L3') {
    const districtMap = new Map<string, DistrictBuilding>(districtBuildings.map((d) => [d.id, d]));
    const districtByBuildingId = new Map<string, DistrictBuilding>();
    for (const b of buildings) {
      const db = districtMap.get(b.districtId);
      if (db) districtByBuildingId.set(b.id, db);
    }
    const districtSlots = new Map<string, number>();
    let stagingSlot = 0;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      let pos: [number, number] | null = null;

      if (agent.fromId && agent.toId && agent.flyProgress !== undefined) {
        const fromDb = districtByBuildingId.get(agent.fromId);
        const toDb   = districtByBuildingId.get(agent.toId);
        if (!fromDb || !toDb) continue;

        if (fromDb.id === toDb.id) {
          // Same district — park on the district surface (mid-flight pause).
          const slot = districtSlots.get(toDb.id) ?? 0;
          districtSlots.set(toDb.id, slot + 1);
          pos = districtHoverPos(camera, toDb, slot);
        } else {
          // Different districts — bezier arc between district-building roof centres.
          const fromPt = camera.project(fromDb.gx + fromDb.gw / 2, fromDb.gy + fromDb.gh / 2, fromDb.gz);
          const toPt   = camera.project(toDb.gx   + toDb.gw   / 2, toDb.gy   + toDb.gh   / 2, toDb.gz);
          pos = flightArcPos(fromPt, toPt, agent.flyProgress);
        }
      } else if (agent.targetId) {
        const db = districtByBuildingId.get(agent.targetId);
        if (db) {
          const slot = districtSlots.get(db.id) ?? 0;
          districtSlots.set(db.id, slot + 1);
          pos = districtHoverPos(camera, db, slot);
        } else {
          // Target building not in any district — fall back to staging.
          pos = agentScreenPos(camera, agent, buildMap, cityCenter, stagingSlot++);
        }
      } else {
        pos = agentScreenPos(camera, agent, buildMap, cityCenter, stagingSlot++);
      }

      if (!pos) continue;
      const d = (pos[0] - sx) ** 2 + (pos[1] - sy) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
  } else {
    let stagingSlot = 0;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const isFlying = !!(agent.fromId && agent.toId && agent.flyProgress !== undefined);
      const isStaging = !isFlying && !agent.targetId;
      const slot = isStaging ? stagingSlot++ : 0;
      const pos = agentScreenPos(camera, agent, buildMap, cityCenter, slot);
      if (!pos) continue;
      const d = (pos[0] - sx) ** 2 + (pos[1] - sy) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
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
