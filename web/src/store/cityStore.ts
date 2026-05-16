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
 * Aggregate view of a district at L3 zoom — one entry per district with
 * stats derived from its constituent file-buildings.
 */
export interface DistrictBuilding {
  id: string;
  label: string;
  gx: number;
  gy: number;
  gw: number;
  gh: number;
  fileCount: number;
  totalLoc: number;
  /** Weighted-average coverage (0–1), or -1 if no coverage data. */
  coverage: number;
  /** Map of status string → count of buildings with that status. */
  statusBreakdown: Record<string, number>;
}

/** Derive district-level aggregate buildings from city state. Pure function. */
export function selectDistrictBuildings(city: CityState): DistrictBuilding[] {
  return city.districts.map((d) => {
    const dbs = city.buildings.filter((b) => b.districtId === d.id);
    const fileCount = dbs.length;
    const totalLoc = dbs.reduce((s, b) => s + b.loc, 0);
    const covBs = dbs.filter((b) => b.coverage >= 0);
    const covDenom = covBs.reduce((s, b) => s + b.loc, 0);
    const coverage = covBs.length > 0 && covDenom > 0
      ? covBs.reduce((s, b) => s + b.coverage * b.loc, 0) / covDenom
      : -1;
    const statusBreakdown: Record<string, number> = {};
    for (const b of dbs) {
      statusBreakdown[b.status] = (statusBreakdown[b.status] ?? 0) + 1;
    }
    return { id: d.id, label: d.label, gx: d.gx, gy: d.gy, gw: d.gw, gh: d.gh, fileCount, totalLoc, coverage, statusBreakdown };
  });
}

export const useCityStore = create<CityStore>((set) => ({
  city: emptyCityState,
  setCity: (city) => set({ city: sanitize(city) }),
  patchCity: (partial) =>
    set((state) => ({ city: sanitize({ ...state.city, ...partial }) })),
}));
