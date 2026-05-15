import { create } from 'zustand';

export type FocusZone = 'city' | 'left' | 'right' | 'modal';

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
  // Selection
  selectedBuildingId: string | null;
  cursorBuildingId: string | null;
  focusZone: FocusZone;

  // Zoom and camera (mirrors IsometricCamera state for React consumers)
  zoom: number;
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
  setFocusZone: (zone: FocusZone) => void;
  setZoom: (zoom: number) => void;
  setCamera: (x: number, y: number) => void;
  toggleRoads: () => void;
  toggleLabels: () => void;
  toggleMinimap: () => void;
  toggleShortcutOverlay: () => void;
  toggleHighContrast: () => void;
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
  focusZone: 'city',

  zoom: 1.0,
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
  setFocusZone: (zone) => set({ focusZone: zone }),
  setZoom: (zoom) => set({ zoom }),
  setCamera: (x, y) => set({ cameraX: x, cameraY: y }),
  toggleRoads: () => set((s) => ({ showRoads: !s.showRoads })),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleMinimap: () => set((s) => ({ showMinimap: !s.showMinimap })),
  toggleShortcutOverlay: () => set((s) => ({ showShortcutOverlay: !s.showShortcutOverlay })),
  toggleHighContrast: () => set((s) => ({ highContrast: !s.highContrast })),
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
