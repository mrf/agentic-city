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

// DistrictBuilding is the aggregate view of a District at LOD L3.
// It is a pure derived value — source buildings and districts are never mutated.
export interface DistrictBuilding {
  id: string;
  label: string;
  loc: number;
  totalLoc: number;
  coverage: number;   // weighted average of children with known coverage; -1 if none known
  status: string;     // worst-case: err > warn > unknown > ok
  statusBreakdown: Record<string, number>;
  fileCount: number;
  agentCount: number;
  gx: number;
  gy: number;
  gw: number;
  gh: number;
  gz: number;       // height proportional to file count
}

const STATUS_RANK: Record<string, number> = {
  ok: 1,
  unknown: 2,
  warn: 3,
  err: 4,
};

function worstStatus(a: string, b: string): string {
  const ra = STATUS_RANK[a] ?? 2;
  const rb = STATUS_RANK[b] ?? 2;
  return ra >= rb ? a : b;
}

/**
 * Pure selector: derives one DistrictBuilding per District from the current city state.
 * Used when LOD is L3. Original buildings are not modified.
 */
export function selectDistrictBuildings(
  districts: District[],
  buildings: Building[],
  agents: Agent[],
): DistrictBuilding[] {
  // Group buildings by district and collect building IDs per district for agent lookup
  const childrenByDistrict = new Map<string, Building[]>();
  const buildingIdsByDistrict = new Map<string, Set<string>>();
  for (const d of districts) {
    childrenByDistrict.set(d.id, []);
    buildingIdsByDistrict.set(d.id, new Set());
  }
  for (const b of buildings) {
    childrenByDistrict.get(b.districtId)?.push(b);
    buildingIdsByDistrict.get(b.districtId)?.add(b.id);
  }

  // Count how many agents target each building (via targetId or toId when flying)
  const agentTargets = new Map<string, number>();
  for (const agent of agents) {
    const target = agent.targetId ?? agent.toId;
    if (target) {
      agentTargets.set(target, (agentTargets.get(target) ?? 0) + 1);
    }
  }

  return districts.map((d) => {
    const children = childrenByDistrict.get(d.id) ?? [];
    const childIds = buildingIdsByDistrict.get(d.id) ?? new Set<string>();

    // LOC sum
    const loc = children.reduce((sum, b) => sum + b.loc, 0);

    // File count
    const fileCount = children.length;

    // Weighted average coverage (only children with coverage >= 0)
    const knownChildren = children.filter((b) => b.coverage >= 0);
    const knownLoc = knownChildren.reduce((sum, b) => sum + b.loc, 0);
    let coverage: number;
    if (knownChildren.length === 0) {
      coverage = -1;
    } else if (knownLoc === 0) {
      // All known children have zero LOC — fall back to simple average
      coverage = knownChildren.reduce((sum, b) => sum + b.coverage, 0) / knownChildren.length;
    } else {
      coverage = knownChildren.reduce((sum, b) => sum + b.coverage * b.loc, 0) / knownLoc;
    }

    // Worst-case status
    const status = children.reduce(
      (worst, b) => worstStatus(worst, b.status),
      'ok' as string,
    );

    // Status breakdown for right rail display
    const statusBreakdown: Record<string, number> = {};
    for (const b of children) {
      statusBreakdown[b.status] = (statusBreakdown[b.status] ?? 0) + 1;
    }

    // Agent count: agents whose target is a building in this district
    let agentCount = 0;
    for (const id of childIds) {
      agentCount += agentTargets.get(id) ?? 0;
    }

    return {
      id: d.id,
      label: d.label,
      loc,
      totalLoc: loc,
      coverage,
      status,
      statusBreakdown,
      fileCount,
      agentCount,
      gx: d.gx,
      gy: d.gy,
      gw: d.gw,
      gh: d.gh,
      gz: Math.max(3, Math.min(8, 2 + Math.ceil(fileCount / 3))),
    };
  });
}

export const useCityStore = create<CityStore>((set) => ({
  city: emptyCityState,
  setCity: (city) => set({ city: sanitize(city) }),
  patchCity: (partial) =>
    set((state) => ({ city: sanitize({ ...state.city, ...partial }) })),
}));
