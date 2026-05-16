/**
 * useCityKeyboard — spatial keyboard navigation for the isometric city canvas.
 *
 * Cursor movement (H/J/K/L) uses nearest-neighbor search in grid space.
 * Tab/Shift+Tab cycles within district by LOC order.
 * Camera auto-follows when cursor moves off-screen.
 * At L3, arrow keys navigate district-buildings; Enter zooms to L2 on the district.
 */

import { useEffect, useRef } from 'react';
import { useCityStore } from '../store/cityStore';
import { useUiStore, LOD_THRESHOLDS } from '../store/uiStore';
import { useCameraControls } from './useCameraControls';
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

/** Minimum grid item needed for spatial navigation. */
interface GridItem {
  id: string;
  gx: number;
  gy: number;
  gw: number;
  gh: number;
}

function gridCenter(item: GridItem): [number, number] {
  return [item.gx + item.gw / 2, item.gy + item.gh / 2];
}

/** Find the nearest item from `from` in the given isometric direction. */
function findNearest<T extends GridItem>(
  from: T,
  candidates: T[],
  dir: Direction,
): T | null {
  const [dx, dy] = DIR_VECTORS[dir];
  const [cx, cy] = gridCenter(from);

  let best: T | null = null;
  let bestScore = Infinity;

  for (const b of candidates) {
    if (b.id === from.id) continue;
    const [bx, by] = gridCenter(b);
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

/** Zoom camera to L2 scale and center on the given grid rect. */
function zoomToL2(
  camera: IsometricCamera,
  item: GridItem,
  syncCamera: (cam: IsometricCamera) => void,
): void {
  // Solidly inside L2 (well above the L3→L2 enter threshold of 1.2)
  camera.scale = LOD_THRESHOLDS.L2.enter * 1.25;
  const [cx, cy] = gridCenter(item);
  const [sx, sy] = camera.project(cx, cy, 0);
  camera.ox += window.innerWidth / 2 - sx;
  camera.oy += window.innerHeight / 2 - sy;
  syncCamera(camera);
}

/** Pan camera so the building stays in view. If `force`, always center. */
function autoFollow(
  camera: IsometricCamera,
  building: Building,
  force = false,
): void {
  const [cx, cy] = gridCenter(building);
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
  syncCamera: (cam: IsometricCamera) => void,
): void {
  setCursor(building.id);
  autoFollow(camera, building);
  syncCamera(camera);
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
  const cursorDistrictId = useUiStore((s) => s.cursorDistrictId);
  const setCursorDistrict = useUiStore((s) => s.setCursorDistrict);
  const lodLevel = useUiStore((s) => s.lodLevel);
  const focusZone = useUiStore((s) => s.focusZone);
  const setFocusZone = useUiStore((s) => s.setFocusZone);
  const toggleRoads = useUiStore((s) => s.toggleRoads);
  const toggleLabels = useUiStore((s) => s.toggleLabels);
  const toggleMinimap = useUiStore((s) => s.toggleMinimap);
  const toggleShortcutOverlay = useUiStore((s) => s.toggleShortcutOverlay);
  const toggleHighContrast = useUiStore((s) => s.toggleHighContrast);
  const toggleLod = useUiStore((s) => s.toggleLod);
  const showShortcutOverlay = useUiStore((s) => s.showShortcutOverlay);
  const focusedAgentIndex = useUiStore((s) => s.focusedAgentIndex);
  const setFocusedAgentIndex = useUiStore((s) => s.setFocusedAgentIndex);
  const inspectedAgentId = useUiStore((s) => s.inspectedAgentId);
  const setInspectedAgentId = useUiStore((s) => s.setInspectedAgentId);
  const { syncCamera, panByKey, zoomIn, zoomOut, resetZoom } = useCameraControls();

  // Phase 2 state
  const phase2 = useUiStore((s) => s.phase2);
  const dispatchMode = useUiStore((s) => s.dispatchMode);
  const commandPaletteOpen = useUiStore((s) => s.commandPaletteOpen);
  const openDispatch = useUiStore((s) => s.openDispatch);
  const openCommandPalette = useUiStore((s) => s.openCommandPalette);
  const alarmActive = useUiStore((s) => s.alarmActive);
  const toggleAlarm = useUiStore((s) => s.toggleAlarm);

  // Ref holds latest reactive state so the keydown handler stays stable.
  // Updated on every render, so it always reflects current store values —
  // including building list changes that don't originate from key actions.
  const stateRef = useRef({
    buildings, districts, agents, cursorBuildingId, cursorDistrictId, lodLevel,
    focusZone, showShortcutOverlay, focusedAgentIndex, inspectedAgentId,
    phase2, dispatchMode, commandPaletteOpen, alarmActive,
  });
  stateRef.current = {
    buildings, districts, agents, cursorBuildingId, cursorDistrictId, lodLevel,
    focusZone, showShortcutOverlay, focusedAgentIndex, inspectedAgentId,
    phase2, dispatchMode, commandPaletteOpen, alarmActive,
  };

  // Sanitize cursor when the building list changes. If cursorBuildingId no
  // longer refers to an existing building (removed while navigating), reset
  // it immediately rather than waiting for the next keypress to discover it.
  useEffect(() => {
    if (cursorBuildingId !== null && !buildings.some((b) => b.id === cursorBuildingId)) {
      setCursor(null);
    }
  }, [buildings, cursorBuildingId, setCursor]);

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
        buildings, districts, agents, cursorBuildingId, cursorDistrictId, lodLevel,
        focusZone, showShortcutOverlay, focusedAgentIndex, inspectedAgentId,
        phase2, dispatchMode, commandPaletteOpen, alarmActive,
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

      // Phase 2: Cmd+K opens command palette
      if (phase2 && (e.metaKey || e.ctrlKey) && e.key === 'k') {
        if (!dispatchMode && !commandPaletteOpen) {
          openCommandPalette();
        }
        e.preventDefault();
        return;
      }

      // Phase 2: X toggles alarm overlay
      if (phase2 && (e.key === 'x' || e.key === 'X') && !dispatchMode && !commandPaletteOpen) {
        toggleAlarm();
        e.preventDefault();
        return;
      }

      // Phase 2 modals own their keyboard — yield all events
      if (dispatchMode || commandPaletteOpen || alarmActive) return;

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

      // --- UI toggles (global — work in any focus zone) ---
      if (e.key === 'r' || e.key === 'R') { toggleRoads(); e.preventDefault(); return; }
      if (e.key === 'n' || e.key === 'N') { toggleLabels(); e.preventDefault(); return; }
      if (e.key === 'm' || e.key === 'M') { toggleMinimap(); e.preventDefault(); return; }
      if (e.key === 'c' || e.key === 'C') { toggleHighContrast(); e.preventDefault(); return; }
      // L (uppercase) — toggle LOD between file view (L2) and district view (L3)
      // Lowercase 'l' is reserved for vim-style right navigation
      if (e.key === 'L') { toggleLod(); e.preventDefault(); return; }

      // Only city-mode keys below
      if (focusZone !== 'city') return;

      // Phase 2: D key opens dispatch wizard
      if (phase2 && (e.key === 'd' || e.key === 'D')) {
        openDispatch(cursorBuildingId ?? undefined);
        e.preventDefault();
        return;
      }

      // --- Camera pan (WASD / arrows) ---
      switch (e.key) {
        case 'w': case 'W': case 'ArrowUp':
          panByKey(cam, 'up'); e.preventDefault(); return;
        case 's': case 'S': case 'ArrowDown':
          panByKey(cam, 'down'); e.preventDefault(); return;
        case 'a': case 'A': case 'ArrowLeft':
          panByKey(cam, 'left'); e.preventDefault(); return;
        case 'd': case 'D': case 'ArrowRight':
          panByKey(cam, 'right'); e.preventDefault(); return;
        case '+': case '=':
          zoomIn(cam); e.preventDefault(); return;
        case '-':
          zoomOut(cam); e.preventDefault(); return;
        case '0':
          resetZoom(cam); e.preventDefault(); return;
      }

      // --- L3: navigate district-buildings ---
      if (lodLevel === 'L3') {
        if (districts.length === 0) return;

        const navKeys = ['h', 'j', 'k', 'l', 'Enter'];
        if (!navKeys.includes(e.key)) return;

        const districtItems: GridItem[] = districts.map((d) => ({
          id: d.id, gx: d.gx, gy: d.gy, gw: d.gw, gh: d.gh,
        }));

        const cursorDistrict = districtItems.find((d) => d.id === cursorDistrictId) ?? null;

        // First nav key initialises the district cursor
        if (!cursorDistrict) {
          setCursorDistrict(districtItems[0].id);
          e.preventDefault();
          return;
        }

        const dirMap: Record<string, Direction> = {
          h: 'left', l: 'right', k: 'up', j: 'down',
        };
        const dir = dirMap[e.key];
        if (dir) {
          const target = findNearest(cursorDistrict, districtItems, dir);
          if (target) setCursorDistrict(target.id);
          e.preventDefault();
          return;
        }

        // Enter — zoom to L2 centered on the cursor district
        if (e.key === 'Enter') {
          zoomToL2(cam, cursorDistrict, syncCamera);
          e.preventDefault();
          return;
        }

        return;
      }

      // --- L1/L2: navigate file-buildings ---
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
        syncCamera(cam);
        e.preventDefault();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    setCursor, selectBuilding, setCursorDistrict, setFocusZone,
    syncCamera, panByKey, zoomIn, zoomOut, resetZoom,
    toggleRoads, toggleLabels, toggleMinimap,
    toggleShortcutOverlay, toggleHighContrast, toggleLod,
    setFocusedAgentIndex, setInspectedAgentId,
    openDispatch, openCommandPalette, toggleAlarm,
    rendererRef,
  ]);
}
