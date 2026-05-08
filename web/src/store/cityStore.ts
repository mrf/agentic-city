import { create } from 'zustand';

export interface District {
  id: string;
  label: string;
  parentId: string;
  gx: number;
  gy: number;
  gw: number;
  gh: number;
}

export interface Building {
  id: string;
  districtId: string;
  label: string;
  language: string;
  loc: number;
  coverage: number;
  status: string;
  editing: boolean;
  exports: number;
  gx: number;
  gy: number;
  gw: number;
  gh: number;
  gz: number;
}

export interface Agent {
  id: string;
  color: string;
  mode: string;
  task: string;
  progress: number;
  targetId?: string;
  locationConfidence?: string;
  fromId?: string;
  toId?: string;
  flyProgress?: number;
  errorMsg?: string;
}

export interface RepoInfo {
  name: string;
  branch: string;
  headCommit: string;
  ciStatus: string;
}

export interface RepoStats {
  fileCount: number;
  totalLoc: number;
  coverage: number;
  openPrs: number;
  bugCount: number;
  testsPassing: number;
  testsTotal: number;
}

export interface ActivityEvent {
  ts: string;
  who: string;
  message: string;
  color: string;
  severity: string;
}

export interface CityState {
  repoInfo: RepoInfo;
  districts: District[];
  buildings: Building[];
  roads: { fromId: string; toId: string; weight: number; confidence: string }[];
  agents: Agent[];
  activities: ActivityEvent[];
  stats: RepoStats;
  ts: number;
}

interface CityStore {
  city: CityState;
  setCity: (city: CityState) => void;
  patchCity: (partial: Partial<CityState>) => void;
}

const emptyCityState: CityState = {
  repoInfo: { name: '', branch: '', headCommit: '', ciStatus: 'unknown' },
  districts: [],
  buildings: [],
  roads: [],
  agents: [],
  activities: [],
  stats: {
    fileCount: 0,
    totalLoc: 0,
    coverage: -1,
    openPrs: 0,
    bugCount: 0,
    testsPassing: 0,
    testsTotal: 0,
  },
  ts: 0,
};

export const useCityStore = create<CityStore>((set) => ({
  city: emptyCityState,
  setCity: (city) => set({ city }),
  patchCity: (partial) =>
    set((state) => ({ city: { ...state.city, ...partial } })),
}));
