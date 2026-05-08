import { create } from 'zustand';

export type FocusZone = 'city' | 'left' | 'right' | 'modal';

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
}));
