import { create } from 'zustand';

export type FocusZone = 'city' | 'left' | 'right' | 'modal';

interface UiStore {
  selectedBuildingId: string | null;
  cursorBuildingId: string | null;
  focusZone: FocusZone;
  showRoads: boolean;
  showLabels: boolean;
  showMinimap: boolean;

  selectBuilding: (id: string | null) => void;
  setCursor: (id: string | null) => void;
  setFocusZone: (zone: FocusZone) => void;
  toggleRoads: () => void;
  toggleLabels: () => void;
  toggleMinimap: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  selectedBuildingId: null,
  cursorBuildingId: null,
  focusZone: 'city',
  showRoads: false,
  showLabels: true,
  showMinimap: false,

  selectBuilding: (id) => set({ selectedBuildingId: id }),
  setCursor: (id) => set({ cursorBuildingId: id }),
  setFocusZone: (zone) => set({ focusZone: zone }),
  toggleRoads: () => set((s) => ({ showRoads: !s.showRoads })),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleMinimap: () => set((s) => ({ showMinimap: !s.showMinimap })),
}));
