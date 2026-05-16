import { useMemo, type CSSProperties } from 'react';
import { useCityStore, selectDistrictBuildings } from '../store/cityStore';
import { useUiStore } from '../store/uiStore';
import type { ActivityEvent, Building, Agent, DistrictBuilding } from '../store/cityStore';
import { sol, langColor, coverageColor, ciColor, tierColor, severityColor, hudBase, TOP_BAR_H, BOTTOM_STRIP_H } from './palette';

const RAIL_W = 220;

/** Format a timestamp string to HH:MM:SS or just time portion. */
function fmtTs(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts.slice(-8);
    return d.toLocaleTimeString('en-US', { hour12: false });
  } catch {
    return '';
  }
}

const S: Record<string, CSSProperties> = {
  rail: {
    ...hudBase,
    position: 'fixed',
    top: TOP_BAR_H,
    right: 0,
    bottom: BOTTOM_STRIP_H,
    width: RAIL_W,
    maxWidth: 'calc(50vw - 4px)',
    background: `${sol.base02}e6`,
    borderLeft: `1px solid ${sol.base01}`,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 90,
    overflow: 'hidden',
  },
  section: {
    borderBottom: `1px solid ${sol.base01}`,
  },
  sectionHeader: {
    padding: '6px 10px',
    color: sol.base0,
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    borderBottom: `1px solid ${sol.base01}`,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '3px 10px',
    gap: 8,
  },
  rowLabel: {
    color: sol.base0,
    flexShrink: 0,
  },
  rowValue: {
    color: sol.base2,
    textAlign: 'right' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  activityList: {
    flex: 1,
    overflow: 'hidden',
    padding: '4px 0',
  },
  activityRow: {
    padding: '2px 10px',
    display: 'flex',
    gap: 5,
    alignItems: 'flex-start',
    lineHeight: '1.4',
  },
  activityTs: {
    flexShrink: 0,
    fontSize: 9,
    color: sol.base01,
    paddingTop: 1,
  },
  activityWho: {
    flexShrink: 0,
    fontWeight: 600,
    fontSize: 10,
  },
  activityMsg: {
    color: sol.base0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    fontSize: 10,
    flex: 1,
  },
  empty: {
    padding: '8px 10px',
    color: sol.base01,
    fontSize: 10,
  },
  statsGrid: {
    padding: '4px 0',
  },
  inspectHeader: {
    padding: '6px 10px',
    color: sol.cyan,
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    borderBottom: `1px solid ${sol.base01}`,
    display: 'flex',
    justifyContent: 'space-between',
  },
};

function BuildingPanel({ building }: { building: Building }): JSX.Element {
  const cov = building.coverage >= 0 ? `${Math.round(building.coverage * 100)}%` : '—';
  return (
    <div style={S.section}>
      <div style={S.sectionHeader}>selected</div>
      <div style={{ ...S.row, paddingTop: 5 }}>
        <span style={S.rowLabel}>file</span>
        <span style={{ ...S.rowValue, color: sol.base2 }}>{building.label}</span>
      </div>
      <div style={S.row}>
        <span style={S.rowLabel}>lang</span>
        <span style={{ ...S.rowValue, color: langColor(building.language) }}>{building.language}</span>
      </div>
      <div style={S.row}>
        <span style={S.rowLabel}>LOC</span>
        <span style={S.rowValue}>{building.loc.toLocaleString()}</span>
      </div>
      <div style={S.row}>
        <span style={S.rowLabel}>cov</span>
        <span style={{ ...S.rowValue, color: coverageColor(building.coverage) }}>{cov}</span>
      </div>
      <div style={{ ...S.row, paddingBottom: 5 }}>
        <span style={S.rowLabel}>status</span>
        <span style={{ ...S.rowValue, color: ciColor(building.status) }}>{building.status}</span>
      </div>
    </div>
  );
}

function DistrictBuildingPanel({ district }: { district: DistrictBuilding }): JSX.Element {
  const cov = district.coverage >= 0 ? `${Math.round(district.coverage * 100)}%` : '—';
  const statuses = Object.entries(district.statusBreakdown).sort((a, b) => b[1] - a[1]);
  return (
    <div style={S.section}>
      <div style={S.sectionHeader}>district</div>
      <div style={{ ...S.row, paddingTop: 5 }}>
        <span style={S.rowLabel}>name</span>
        <span style={{ ...S.rowValue, color: sol.base2 }}>{district.label}</span>
      </div>
      <div style={S.row}>
        <span style={S.rowLabel}>files</span>
        <span style={S.rowValue}>{district.fileCount}</span>
      </div>
      <div style={S.row}>
        <span style={S.rowLabel}>LOC</span>
        <span style={S.rowValue}>{district.totalLoc.toLocaleString()}</span>
      </div>
      <div style={S.row}>
        <span style={S.rowLabel}>cov</span>
        <span style={{ ...S.rowValue, color: coverageColor(district.coverage) }}>{cov}</span>
      </div>
      {statuses.map(([status, count]) => (
        <div key={status} style={S.row}>
          <span style={S.rowLabel}>{status}</span>
          <span style={{ ...S.rowValue, color: ciColor(status) }}>{count}</span>
        </div>
      ))}
      <div style={{ ...S.row, paddingBottom: 5 }}>
        <span style={{ ...S.rowLabel, color: sol.base00, fontSize: 9 }}>Enter → zoom L2</span>
      </div>
    </div>
  );
}

function AgentInspectPanel({ agent }: { agent: Agent }): JSX.Element {
  const tc = tierColor(agent.modelTier);
  const pct = Math.max(0, Math.min(1, agent.progress ?? 0));
  return (
    <div style={S.section}>
      <div style={S.inspectHeader}>
        <span>inspect</span>
        <span style={{ color: sol.base00 }}>press I to close</span>
      </div>
      <div style={{ ...S.row, paddingTop: 5 }}>
        <span style={S.rowLabel}>agent</span>
        <span style={{ ...S.rowValue, color: agent.color || sol.base2 }}>{agent.id}</span>
      </div>
      <div style={S.row}>
        <span style={S.rowLabel}>model</span>
        <span style={{ ...S.rowValue, color: tc }}>{agent.modelTier ?? 'unknown'}</span>
      </div>
      <div style={S.row}>
        <span style={S.rowLabel}>mode</span>
        <span style={{ ...S.rowValue, color: sol.base2 }}>{agent.mode || 'idle'}</span>
      </div>
      {agent.task && (
        <div style={S.row}>
          <span style={S.rowLabel}>task</span>
          <span style={{ ...S.rowValue, color: sol.base1 }}>{agent.task}</span>
        </div>
      )}
      <div style={S.row}>
        <span style={S.rowLabel}>progress</span>
        <span style={{ ...S.rowValue, color: sol.base2 }}>{Math.round(pct * 100)}%</span>
      </div>
      {agent.targetId && (
        <div style={S.row}>
          <span style={S.rowLabel}>target</span>
          <span style={{ ...S.rowValue, color: sol.base1 }}>{agent.targetId}</span>
        </div>
      )}
      {agent.errorMsg && (
        <div style={{ ...S.row, paddingBottom: 5 }}>
          <span style={S.rowLabel}>error</span>
          <span style={{ ...S.rowValue, color: sol.red }}>{agent.errorMsg}</span>
        </div>
      )}
    </div>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }): JSX.Element {
  const whoColor = event.color || sol.base1;
  const msgColor = severityColor(event.severity);
  return (
    <div style={S.activityRow}>
      <span style={S.activityTs}>{fmtTs(event.ts)}</span>
      <span style={{ ...S.activityWho, color: whoColor }}>
        {event.who.slice(0, 6)}
      </span>
      <span style={{ ...S.activityMsg, color: msgColor }}>{event.message}</span>
    </div>
  );
}

function StatsPanel(): JSX.Element {
  const stats = useCityStore((s) => s.city.stats);
  const cov = stats.coverage >= 0 ? `${Math.round(stats.coverage * 100)}%` : '—';
  return (
    <div style={S.section}>
      <div style={S.sectionHeader}>stats</div>
      <div style={S.statsGrid}>
        <div style={S.row}>
          <span style={S.rowLabel}>files</span>
          <span style={S.rowValue}>{stats.fileCount}</span>
        </div>
        <div style={S.row}>
          <span style={S.rowLabel}>LOC</span>
          <span style={S.rowValue}>{stats.totalLoc.toLocaleString()}</span>
        </div>
        <div style={S.row}>
          <span style={S.rowLabel}>coverage</span>
          <span style={{ ...S.rowValue, color: coverageColor(stats.coverage) }}>{cov}</span>
        </div>
        {stats.openPrs > 0 && (
          <div style={S.row}>
            <span style={S.rowLabel}>open PRs</span>
            <span style={{ ...S.rowValue, color: sol.yellow }}>{stats.openPrs}</span>
          </div>
        )}
        {stats.bugCount > 0 && (
          <div style={S.row}>
            <span style={S.rowLabel}>bugs</span>
            <span style={{ ...S.rowValue, color: sol.red }}>{stats.bugCount}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function RightRail(): JSX.Element {
  const city = useCityStore((s) => s.city);
  const activities = city.activities;
  const agents = city.agents;
  const lodLevel = useUiStore((s) => s.lodLevel);
  const selectedBuildingId = useUiStore((s) => s.selectedBuildingId);
  const cursorBuildingId = useUiStore((s) => s.cursorBuildingId);
  const cursorDistrictId = useUiStore((s) => s.cursorDistrictId);
  const inspectedAgentId = useUiStore((s) => s.inspectedAgentId);

  const inspectedAgent = inspectedAgentId ? agents.find((a) => a.id === inspectedAgentId) : null;

  // At L3: show the cursor district-building if one is active
  const districtBuildings = useMemo(
    () => lodLevel === 'L3' ? selectDistrictBuildings(city.districts, city.buildings, city.agents) : null,
    [lodLevel, city],
  );
  const districtBuilding = districtBuildings && cursorDistrictId
    ? districtBuildings.find((d) => d.id === cursorDistrictId) ?? null
    : null;

  // At L1/L2: show selected or cursor file-building
  const activeBuildingId = selectedBuildingId ?? cursorBuildingId;
  const building = lodLevel !== 'L3' && activeBuildingId
    ? city.buildings.find((b) => b.id === activeBuildingId) ?? null
    : null;

  const showStats = !inspectedAgent && !districtBuilding && !building;

  // Show latest activities, most recent first, up to 12
  const recent = [...activities].reverse().slice(0, 12);

  return (
    <div style={S.rail}>
      {inspectedAgent && <AgentInspectPanel agent={inspectedAgent} />}
      {!inspectedAgent && districtBuilding && <DistrictBuildingPanel district={districtBuilding} />}
      {!inspectedAgent && !districtBuilding && building && <BuildingPanel building={building} />}
      {showStats && <StatsPanel />}

      <div style={S.sectionHeader}>activity</div>
      <div style={S.activityList}>
        {recent.length === 0 ? (
          <div style={S.empty}>no recent activity</div>
        ) : (
          recent.map((ev, i) => <ActivityRow key={i} event={ev} />)
        )}
      </div>

      {!inspectedAgent && building && (
        <div style={{ borderTop: `1px solid ${sol.base01}` }}>
          <StatsPanel />
        </div>
      )}
    </div>
  );
}
