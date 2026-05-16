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

export type ModelTier = 'opus' | 'sonnet' | 'haiku' | 'unknown';

export interface Agent {
  id: string;
  color: string;
  mode: string;
  task: string;
  progress: number;
  modelTier?: ModelTier;
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

export type Confidence = 'exact' | 'inferred' | 'weak';

export interface Road {
  fromId: string;
  toId: string;
  weight: number;
  confidence: Confidence;
}

export interface CityState {
  repoInfo: RepoInfo;
  districts: District[];
  buildings: Building[];
  roads: Road[];
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

/** Ensure all array fields in CityState are never null. */
function sanitize(city: CityState): CityState {
  return {
    ...city,
    districts: city.districts ?? [],
    buildings: city.buildings ?? [],
    roads: city.roads ?? [],
    agents: city.agents ?? [],
    activities: city.activities ?? [],
  };
}

/**
 * A district-level building for L3 LOD rendering.
 * One entry per district; stats are aggregated across all file-buildings within it.
 */
export interface DistrictBuilding {
  id: string;
  label: string;
  fileCount: number;
  status: string;   // 'ok' | 'warn' | 'err'
  gx: number;
  gy: number;
  gw: number;
  gh: number;
  gz: number;       // height proportional to file count
}

/** Worst-case status across a list of status strings. */
function worstStatus(statuses: string[]): string {
  if (statuses.some((s) => s === 'err' || s === 'CRIT')) return 'err';
  if (statuses.some((s) => s === 'warn')) return 'warn';
  return 'ok';
}

/** Derive one DistrictBuilding per district, aggregating file-building stats. */
export function selectDistrictBuildings(city: CityState): DistrictBuilding[] {
  const byDistrict = new Map<string, Building[]>();
  for (const b of city.buildings) {
    const list = byDistrict.get(b.districtId) ?? [];
    list.push(b);
    byDistrict.set(b.districtId, list);
  }

  return city.districts.map((d) => {
    const files = byDistrict.get(d.id) ?? [];
    return {
      id: d.id,
      label: d.label,
      fileCount: files.length,
      status: worstStatus(files.map((b) => b.status)),
      gx: d.gx,
      gy: d.gy,
      gw: d.gw,
      gh: d.gh,
      gz: Math.max(3, Math.min(8, 2 + Math.ceil(files.length / 3))),
    };
  });
}

export const useCityStore = create<CityStore>((set) => ({
  city: emptyCityState,
  setCity: (city) => set({ city: sanitize(city) }),
  patchCity: (partial) =>
    set((state) => ({ city: sanitize({ ...state.city, ...partial }) })),
}));
