/**
 * useCityKeyboard — spatial keyboard navigation for the isometric city canvas.
 *
 * Cursor movement (H/J/K/L) uses nearest-neighbor search in grid space.
 * Tab/Shift+Tab cycles within district by LOC order.
 * Camera auto-follows when cursor moves off-screen.
 */

import { useEffect, useRef } from 'react';
import { useCityStore } from '../store/cityStore';
import { useUiStore } from '../store/uiStore';
import type { Building } from '../store/cityStore';
import type { CityRenderer } from '../canvas/CityRenderer';
import type { IsometricCamera } from '../canvas/IsometricCamera';

type Direction = 'left' | 'right' | 'up' | 'down';

const DIR_VECTORS: Record<Direction, [number, number]> = {
  left: [-1, 0],  // H — iso −x
  right: [1, 0],  // L — iso +x
  up: [0, -1],    // K — iso −y
  down: [0, 1],   // J — iso +y
};

const MAX_ANGLE = 75 * Math.PI / 180;
const COS_MAX_ANGLE = Math.cos(MAX_ANGLE);

function buildingCenter(b: Building): [number, number] {
  return [b.gx + b.gw / 2, b.gy + b.gh / 2];
}

/** Find the nearest building from `from` in the given isometric direction. */
function findNearest(
  from: Building,
  candidates: Building[],
  dir: Direction,
): Building | null {
  const [dx, dy] = DIR_VECTORS[dir];
  const [cx, cy] = buildingCenter(from);

  let best: Building | null = null;
  let bestScore = Infinity;

  for (const b of candidates) {
    if (b.id === from.id) continue;
    const [bx, by] = buildingCenter(b);
    const vx = bx - cx;
    const vy = by - cy;

    const dot = vx * dx + vy * dy;
    if (dot <= 0) continue;

    const dist = Math.sqrt(vx * vx + vy * vy);
    const cosAngle = dot / dist;
    if (cosAngle < COS_MAX_ANGLE) continue;

    // Penalize off-axis candidates: effective distance / cos(angle)
    const score = dist / cosAngle;
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }

  return best;
}

/** Pan camera so the building stays in view. If `force`, always center. */
function autoFollow(
  camera: IsometricCamera,
  building: Building,
  force = false,
): void {
  const [cx, cy] = buildingCenter(building);
  const [sx, sy] = camera.project(cx, cy, building.gz / 2);

  const w = window.innerWidth;
  const h = window.innerHeight;
  const margin = 100;

  if (force || sx < margin || sx > w - margin || sy < margin || sy > h - margin) {
    camera.ox += w / 2 - sx;
    camera.oy += h / 2 - sy;
  }
}

/** Move cursor to `building`, update store, auto-follow camera. */
function moveCursor(
  camera: IsometricCamera,
  building: Building,
  setCursor: (id: string | null) => void,
): void {
  setCursor(building.id);
  autoFollow(camera, building);
}

export function useCityKeyboard(
  rendererRef: React.RefObject<CityRenderer | null>,
): void {
  const buildings = useCityStore((s) => s.city.buildings);
  const districts = useCityStore((s) => s.city.districts);
  const cursorBuildingId = useUiStore((s) => s.cursorBuildingId);
  const setCursor = useUiStore((s) => s.setCursor);
  const selectBuilding = useUiStore((s) => s.selectBuilding);
  const focusZone = useUiStore((s) => s.focusZone);
  const setFocusZone = useUiStore((s) => s.setFocusZone);
  const toggleRoads = useUiStore((s) => s.toggleRoads);
  const toggleLabels = useUiStore((s) => s.toggleLabels);
  const toggleMinimap = useUiStore((s) => s.toggleMinimap);

  // Ref holds latest reactive state so the keydown handler stays stable
  const stateRef = useRef({ buildings, districts, cursorBuildingId, focusZone });
  stateRef.current = { buildings, districts, cursorBuildingId, focusZone };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;

      const renderer = rendererRef.current;
      if (!renderer) return;
      const cam = renderer.camera;
      const { buildings, districts, cursorBuildingId, focusZone } = stateRef.current;

      // --- Focus-zone switching ---
      if (e.key === '[') { setFocusZone('left'); e.preventDefault(); return; }
      if (e.key === ']') { setFocusZone('right'); e.preventDefault(); return; }

      if (e.key === 'Escape') {
        if (focusZone !== 'city') {
          setFocusZone('city');
        } else {
          selectBuilding(null);
          setCursor(null);
        }
        e.preventDefault();
        return;
      }

      if (e.key === 'Backspace' && focusZone !== 'city') {
        setFocusZone('city');
        e.preventDefault();
        return;
      }

      // Only city-mode keys below
      if (focusZone !== 'city') return;

      // --- Camera pan (WASD / arrows) ---
      switch (e.key) {
        case 'w': case 'W': case 'ArrowUp':
          cam.panByKey('up'); e.preventDefault(); return;
        case 's': case 'S': case 'ArrowDown':
          cam.panByKey('down'); e.preventDefault(); return;
        case 'a': case 'A': case 'ArrowLeft':
          cam.panByKey('left'); e.preventDefault(); return;
        case 'd': case 'D': case 'ArrowRight':
          cam.panByKey('right'); e.preventDefault(); return;
        case '+': case '=':
          cam.zoomIn(); e.preventDefault(); return;
        case '-':
          cam.zoomOut(); e.preventDefault(); return;
        case '0':
          cam.resetZoom(); e.preventDefault(); return;
      }

      // --- UI toggles ---
      if (e.key === 'r' || e.key === 'R') { toggleRoads(); e.preventDefault(); return; }
      if (e.key === 'n' || e.key === 'N') { toggleLabels(); e.preventDefault(); return; }
      if (e.key === 'm' || e.key === 'M') { toggleMinimap(); e.preventDefault(); return; }

      // --- Cursor navigation ---
      if (buildings.length === 0) return;

      const cursor = buildings.find((b) => b.id === cursorBuildingId) ?? null;

      // First nav key initialises the cursor on the first building
      if (!cursor) {
        if (['h', 'j', 'k', 'l', 'Tab', 'Enter'].includes(e.key)) {
          moveCursor(cam, buildings[0], setCursor);
          e.preventDefault();
        }
        return;
      }

      // H/J/K/L — directional movement
      const dirMap: Record<string, Direction> = {
        h: 'left', l: 'right', k: 'up', j: 'down',
      };
      const dir = dirMap[e.key];
      if (dir) {
        const target = findNearest(cursor, buildings, dir);
        if (target) moveCursor(cam, target, setCursor);
        e.preventDefault();
        return;
      }

      // Tab / Shift+Tab — cycle within district by LOC
      if (e.key === 'Tab') {
        const inDistrict = buildings
          .filter((b) => b.districtId === cursor.districtId)
          .sort((a, b) => a.loc - b.loc);
        if (inDistrict.length === 0) return;
        const idx = inDistrict.findIndex((b) => b.id === cursor.id);
        const next = e.shiftKey
          ? (idx - 1 + inDistrict.length) % inDistrict.length
          : (idx + 1) % inDistrict.length;
        moveCursor(cam, inDistrict[next], setCursor);
        e.preventDefault();
        return;
      }

      // { / } — jump between districts
      if (e.key === '{' || e.key === '}') {
        const sorted = [...districts].sort((a, b) => a.id.localeCompare(b.id));
        const curIdx = sorted.findIndex((d) => d.id === cursor.districtId);
        if (curIdx < 0) return;
        const nextIdx = e.key === '}'
          ? (curIdx + 1) % sorted.length
          : (curIdx - 1 + sorted.length) % sorted.length;
        const inDist = buildings
          .filter((b) => b.districtId === sorted[nextIdx].id)
          .sort((a, b) => a.loc - b.loc);
        if (inDist.length > 0) moveCursor(cam, inDist[0], setCursor);
        e.preventDefault();
        return;
      }

      // Enter — select focused building
      if (e.key === 'Enter') {
        selectBuilding(cursor.id);
        e.preventDefault();
        return;
      }

      // F — focus/center camera on cursor
      if (e.key === 'f' || e.key === 'F') {
        autoFollow(cam, cursor, true);
        e.preventDefault();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    setCursor, selectBuilding, setFocusZone,
    toggleRoads, toggleLabels, toggleMinimap,
    rendererRef,
  ]);
}
