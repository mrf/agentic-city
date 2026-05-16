import { create } from 'zustand';

export type FocusZone = 'city' | 'left' | 'right' | 'modal';

/** Level-of-detail level: L1 = most zoomed in (function), L4 = most zoomed out (codebase). */
export type LodLevel = 'L1' | 'L2' | 'L3' | 'L4';

/**
 * Hysteresis bands for LOD transitions.
 * `leave` = zoom out past this to exit the level;
 * `enter` = zoom in past this to enter the level.
 * The dead band between leave and enter prevents flickering at boundaries.
 */
export const LOD_THRESHOLDS = {
  L1: { leave: 3.5, enter: 4.5 },  // function-level: highest zoom
  L2: { leave: 1.5, enter: 2.0 },  // file-level: collapse to districts before buildings become microscopic
  L3: { leave: 0.3, enter: 0.4 },  // module-level
  // L4 (codebase/orbit) is below all L3 thresholds
} as const;

/**
 * Compute the new LOD level from a zoom value and the current level.
 * Pure function — exported for testing.
 */
export function computeLodLevel(zoom: number, current: LodLevel): LodLevel {
  switch (current) {
    case 'L1':
      return zoom < LOD_THRESHOLDS.L1.leave ? 'L2' : 'L1';
    case 'L2':
      if (zoom >= LOD_THRESHOLDS.L1.enter) return 'L1';
      if (zoom < LOD_THRESHOLDS.L2.leave) return 'L3';
      return 'L2';
    case 'L3':
      if (zoom >= LOD_THRESHOLDS.L2.enter) return 'L2';
      if (zoom < LOD_THRESHOLDS.L3.leave) return 'L4';
      return 'L3';
    case 'L4':
      return zoom >= LOD_THRESHOLDS.L3.enter ? 'L3' : 'L4';
  }
}

export type DispatchStep = 1 | 2 | 3;

export type DispatchRole =
  | 'fix-bug'
  | 'refactor'
  | 'review'
  | 'add-test'
  | 'docs'
  | 'optimize'
  | 'custom';

export interface DispatchRoleEntry {
  id: DispatchRole;
  label: string;
  description: string;
}

export const DISPATCH_ROLES: DispatchRoleEntry[] = [
  { id: 'fix-bug', label: 'fix-bug', description: 'Patch failures in selected files' },
  { id: 'refactor', label: 'refactor', description: 'Restructure / clean up code' },
  { id: 'review', label: 'review', description: 'Audit and comment' },
  { id: 'add-test', label: 'add-test', description: 'Expand test coverage' },
  { id: 'docs', label: 'docs', description: 'Write or update documentation' },
  { id: 'optimize', label: 'optimize', description: 'Performance pass' },
  { id: 'custom', label: 'custom...', description: 'Free-form prompt' },
];

function isPhase2Enabled(): boolean {
  return typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('phase2');
}

interface UiStore {
  // Selection — file-level (L1/L2)
  selectedBuildingId: string | null;
  cursorBuildingId: string | null;
  // Selection — district-level (L3)
  selectedDistrictId: string | null;
  cursorDistrictId: string | null;
  focusZone: FocusZone;

  // Zoom and camera (mirrors IsometricCamera state for React consumers)
  zoom: number;
  lodLevel: LodLevel;
  cameraX: number;
  cameraY: number;

  // Visibility toggles
  showRoads: boolean;
  showLabels: boolean;
  showMinimap: boolean;

  // Overlays
  showShortcutOverlay: boolean;
  highContrast: boolean;

  // Agent focus & inspection
  focusedAgentIndex: number | null;
  inspectedAgentId: string | null;

  // Phase 2: Dispatch
  phase2: boolean;
  dispatchMode: boolean;
  dispatchStep: DispatchStep;
  dispatchScope: string[];
  dispatchRole: DispatchRole | null;
  commandPaletteOpen: boolean;

  // Phase 2: Alarm
  alarmActive: boolean;

  selectBuilding: (id: string | null) => void;
  setCursor: (id: string | null) => void;
  selectDistrict: (id: string | null) => void;
  setCursorDistrict: (id: string | null) => void;
  setFocusZone: (zone: FocusZone) => void;
  setZoom: (zoom: number) => void;
  setCamera: (x: number, y: number) => void;
  toggleRoads: () => void;
  toggleLabels: () => void;
  toggleMinimap: () => void;
  toggleShortcutOverlay: () => void;
  toggleHighContrast: () => void;
  /** Toggle between L2 (file view) and L3 (district view). */
  toggleLod: () => void;
  setFocusedAgentIndex: (index: number | null) => void;
  setInspectedAgentId: (id: string | null) => void;

  // Phase 2 actions
  openDispatch: (preselectedBuildingId?: string, preselectedRole?: DispatchRole) => void;
  closeDispatch: () => void;
  setDispatchStep: (step: DispatchStep) => void;
  toggleScopeBuilding: (id: string) => void;
  clearScope: () => void;
  setDispatchRole: (role: DispatchRole | null) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleAlarm: () => void;
  dismissAlarm: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  selectedBuildingId: null,
  cursorBuildingId: null,
  selectedDistrictId: null,
  cursorDistrictId: null,
  focusZone: 'city',

  zoom: 1.0,
  lodLevel: 'L3',
  cameraX: 0,
  cameraY: 0,

  showRoads: false,
  showLabels: true,
  showMinimap: false,

  showShortcutOverlay: false,
  highContrast: false,

  focusedAgentIndex: null,
  inspectedAgentId: null,

  // Phase 2: Dispatch
  phase2: isPhase2Enabled(),
  dispatchMode: false,
  dispatchStep: 1,
  dispatchScope: [],
  dispatchRole: null,
  commandPaletteOpen: false,
  alarmActive: false,

  selectBuilding: (id) => set({ selectedBuildingId: id }),
  setCursor: (id) => set({ cursorBuildingId: id }),
  selectDistrict: (id) => set({ selectedDistrictId: id }),
  setCursorDistrict: (id) => set({ cursorDistrictId: id }),
  setFocusZone: (zone) => set({ focusZone: zone }),
  setZoom: (zoom) => set((s) => ({ zoom, lodLevel: computeLodLevel(zoom, s.lodLevel) })),
  setCamera: (x, y) => set({ cameraX: x, cameraY: y }),
  toggleRoads: () => set((s) => ({ showRoads: !s.showRoads })),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleMinimap: () => set((s) => ({ showMinimap: !s.showMinimap })),
  toggleShortcutOverlay: () => set((s) => ({ showShortcutOverlay: !s.showShortcutOverlay })),
  toggleHighContrast: () => set((s) => ({ highContrast: !s.highContrast })),
  toggleLod: () => set((s) => {
    const next: LodLevel = s.lodLevel === 'L3' ? 'L2' : 'L3';
    return { lodLevel: next };
  }),
  setFocusedAgentIndex: (index) => set({ focusedAgentIndex: index }),
  setInspectedAgentId: (id) => set({ inspectedAgentId: id }),

  // Phase 2 actions
  openDispatch: (preselectedBuildingId, preselectedRole) => set({
    dispatchMode: true,
    dispatchStep: 1,
    dispatchScope: preselectedBuildingId ? [preselectedBuildingId] : [],
    dispatchRole: preselectedRole ?? null,
    focusZone: 'modal',
    commandPaletteOpen: false,
  }),
  closeDispatch: () => set({
    dispatchMode: false,
    dispatchStep: 1,
    dispatchScope: [],
    dispatchRole: null,
    focusZone: 'city',
  }),
  setDispatchStep: (step) => set({ dispatchStep: step }),
  toggleScopeBuilding: (id) => set((s) => {
    const idx = s.dispatchScope.indexOf(id);
    if (idx >= 0) {
      return { dispatchScope: s.dispatchScope.filter((b) => b !== id) };
    }
    return { dispatchScope: [...s.dispatchScope, id] };
  }),
  clearScope: () => set({ dispatchScope: [] }),
  setDispatchRole: (role) => set({ dispatchRole: role }),
  openCommandPalette: () => set({
    commandPaletteOpen: true,
    focusZone: 'modal',
  }),
  closeCommandPalette: () => set((s) => ({
    commandPaletteOpen: false,
    focusZone: s.dispatchMode ? 'modal' : 'city',
  })),
  toggleAlarm: () => set((s) => ({
    alarmActive: !s.alarmActive,
    focusZone: s.alarmActive ? 'city' : 'modal',
  })),
  dismissAlarm: () => set({
    alarmActive: false,
    focusZone: 'city',
  }),
}));

/** Derived selector: current LOD level, re-renders only when the level changes. */
export function useLodLevel(): LodLevel {
  return useUiStore((s) => s.lodLevel);
}
