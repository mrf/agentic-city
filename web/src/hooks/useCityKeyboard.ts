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
import type { Building, Agent } from '../store/cityStore';
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
  syncCamera: () => void,
): void {
  setCursor(building.id);
  autoFollow(camera, building);
  syncCamera();
}

export function useCityKeyboard(
  rendererRef: React.RefObject<CityRenderer | null>,
): void {
  const buildings = useCityStore((s) => s.city.buildings);
  const districts = useCityStore((s) => s.city.districts);
  const agents = useCityStore((s) => s.city.agents);
  const cursorBuildingId = useUiStore((s) => s.cursorBuildingId);
  const setCursor = useUiStore((s) => s.setCursor);
  const selectBuilding = useUiStore((s) => s.selectBuilding);
  const focusZone = useUiStore((s) => s.focusZone);
  const setFocusZone = useUiStore((s) => s.setFocusZone);
  const setZoom = useUiStore((s) => s.setZoom);
  const setCamera = useUiStore((s) => s.setCamera);
  const toggleRoads = useUiStore((s) => s.toggleRoads);
  const toggleLabels = useUiStore((s) => s.toggleLabels);
  const toggleMinimap = useUiStore((s) => s.toggleMinimap);
  const toggleShortcutOverlay = useUiStore((s) => s.toggleShortcutOverlay);
  const toggleHighContrast = useUiStore((s) => s.toggleHighContrast);
  const showShortcutOverlay = useUiStore((s) => s.showShortcutOverlay);
  const focusedAgentIndex = useUiStore((s) => s.focusedAgentIndex);
  const setFocusedAgentIndex = useUiStore((s) => s.setFocusedAgentIndex);
  const inspectedAgentId = useUiStore((s) => s.inspectedAgentId);
  const setInspectedAgentId = useUiStore((s) => s.setInspectedAgentId);

  // Ref holds latest reactive state so the keydown handler stays stable
  const stateRef = useRef({
    buildings, districts, agents, cursorBuildingId, focusZone,
    showShortcutOverlay, focusedAgentIndex, inspectedAgentId,
  });
  stateRef.current = {
    buildings, districts, agents, cursorBuildingId, focusZone,
    showShortcutOverlay, focusedAgentIndex, inspectedAgentId,
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;

      const renderer = rendererRef.current;
      if (!renderer) return;
      const cam = renderer.camera;
      const {
        buildings, districts, agents, cursorBuildingId, focusZone,
        showShortcutOverlay, focusedAgentIndex, inspectedAgentId,
      } = stateRef.current;

      if (e.key === '?') {
        toggleShortcutOverlay();
        e.preventDefault();
        return;
      }

      if (e.key === 'Escape' && showShortcutOverlay) {
        toggleShortcutOverlay();
        e.preventDefault();
        return;
      }

      if (showShortcutOverlay) return;

      const syncCamera = () => {
        setZoom(cam.scale);
        setCamera(cam.ox, cam.oy);
      };

      // --- Focus-zone switching ---
      if (e.key === '[') { setFocusZone('left'); e.preventDefault(); return; }
      if (e.key === ']') { setFocusZone('right'); e.preventDefault(); return; }

      if (e.key === 'Escape') {
        if (inspectedAgentId) {
          setInspectedAgentId(null);
          e.preventDefault();
          return;
        }
        if (focusedAgentIndex !== null) {
          setFocusedAgentIndex(null);
          e.preventDefault();
          return;
        }
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

      // --- Agent navigation (available in all focus zones) ---

      // 1-9: jump to agent by position
      const digit = parseInt(e.key, 10);
      if (!isNaN(digit) && digit >= 1 && digit <= 9 && agents.length > 0) {
        const idx = digit - 1;
        if (idx < agents.length) {
          setFocusedAgentIndex(idx);
          setInspectedAgentId(null);
          e.preventDefault();
          return;
        }
      }

      // G / Shift+G: cycle through agents
      if (e.key === 'g' || e.key === 'G') {
        if (agents.length === 0) return;
        if (e.shiftKey) {
          // Shift+G: previous agent
          const prev = focusedAgentIndex === null
            ? agents.length - 1
            : (focusedAgentIndex - 1 + agents.length) % agents.length;
          setFocusedAgentIndex(prev);
        } else {
          // G: next agent
          const next = focusedAgentIndex === null
            ? 0
            : (focusedAgentIndex + 1) % agents.length;
          setFocusedAgentIndex(next);
        }
        setInspectedAgentId(null);
        e.preventDefault();
        return;
      }

      // I: inspect focused/selected agent (toggle)
      if (e.key === 'i' || e.key === 'I') {
        if (focusedAgentIndex !== null && focusedAgentIndex < agents.length) {
          const agent = agents[focusedAgentIndex];
          if (inspectedAgentId === agent.id) {
            setInspectedAgentId(null);
          } else {
            setInspectedAgentId(agent.id);
            setFocusZone('right');
          }
          e.preventDefault();
          return;
        }
      }

      // --- UI toggles (work in any focus zone) ---
      if (e.key === 'r' || e.key === 'R') { toggleRoads(); e.preventDefault(); return; }
      if (e.key === 'n' || e.key === 'N') { toggleLabels(); e.preventDefault(); return; }
      if (e.key === 'm' || e.key === 'M') { toggleMinimap(); e.preventDefault(); return; }
      if (e.key === 'c' || e.key === 'C') { toggleHighContrast(); e.preventDefault(); return; }

      // Only city-mode keys below
      if (focusZone !== 'city') return;

      // --- Camera pan (WASD / arrows) ---
      switch (e.key) {
        case 'w': case 'W': case 'ArrowUp':
          cam.panByKey('up'); syncCamera(); e.preventDefault(); return;
        case 's': case 'S': case 'ArrowDown':
          cam.panByKey('down'); syncCamera(); e.preventDefault(); return;
        case 'a': case 'A': case 'ArrowLeft':
          cam.panByKey('left'); syncCamera(); e.preventDefault(); return;
        case 'd': case 'D': case 'ArrowRight':
          cam.panByKey('right'); syncCamera(); e.preventDefault(); return;
        case '+': case '=':
          cam.zoomIn(); syncCamera(); e.preventDefault(); return;
        case '-':
          cam.zoomOut(); syncCamera(); e.preventDefault(); return;
        case '0':
          cam.resetZoom(); syncCamera(); e.preventDefault(); return;
      }

      // --- Cursor navigation ---
      if (buildings.length === 0) return;

      const cursor = buildings.find((b) => b.id === cursorBuildingId) ?? null;

      // First nav key initialises the cursor on the first building
      if (!cursor) {
        if (['h', 'j', 'k', 'l', 'Tab', 'Enter'].includes(e.key)) {
          moveCursor(cam, buildings[0], setCursor, syncCamera);
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
        if (target) moveCursor(cam, target, setCursor, syncCamera);
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
        moveCursor(cam, inDistrict[next], setCursor, syncCamera);
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
        if (inDist.length > 0) moveCursor(cam, inDist[0], setCursor, syncCamera);
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
        syncCamera();
        e.preventDefault();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    setCursor, selectBuilding, setFocusZone,
    setZoom, setCamera,
    toggleRoads, toggleLabels, toggleMinimap,
    toggleShortcutOverlay, toggleHighContrast,
    setFocusedAgentIndex, setInspectedAgentId,
    rendererRef,
  ]);
}
