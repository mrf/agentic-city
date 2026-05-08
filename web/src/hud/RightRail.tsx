import type { CSSProperties } from 'react';
import { useCityStore } from '../store/cityStore';
import { useUiStore } from '../store/uiStore';
import type { ActivityEvent, Building } from '../store/cityStore';
import { sol, langColor, coverageColor, ciColor, hudBase, TOP_BAR_H, BOTTOM_STRIP_H } from './palette';

const RAIL_W = 220;

const S: Record<string, CSSProperties> = {
  rail: {
    ...hudBase,
    position: 'fixed',
    top: TOP_BAR_H,
    right: 0,
    bottom: BOTTOM_STRIP_H,
    width: RAIL_W,
    background: `${sol.base02}e6`,
    borderLeft: `1px solid ${sol.base01}`,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 90,
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
    gap: 6,
    alignItems: 'flex-start',
    lineHeight: '1.4',
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
  },
  empty: {
    padding: '8px 10px',
    color: sol.base01,
    fontSize: 10,
  },
  statsGrid: {
    padding: '4px 0',
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

function ActivityRow({ event }: { event: ActivityEvent }): JSX.Element {
  return (
    <div style={S.activityRow}>
      <span style={{ ...S.activityWho, color: event.color || sol.base1 }}>
        {event.who.slice(0, 8)}
      </span>
      <span style={S.activityMsg}>{event.message}</span>
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
  const { buildings, activities } = useCityStore((s) => ({
    buildings: s.city.buildings,
    activities: s.city.activities,
  }));
  const selectedId = useUiStore((s) => s.selectedBuildingId);
  const cursorId = useUiStore((s) => s.cursorBuildingId);

  const activeId = selectedId ?? cursorId;
  const building = activeId ? buildings.find((b) => b.id === activeId) : null;

  // Show latest activities, most recent first, up to 12
  const recent = [...activities].reverse().slice(0, 12);

  return (
    <div style={S.rail}>
      {building && <BuildingPanel building={building} />}
      {!building && <StatsPanel />}

      <div style={S.sectionHeader}>activity</div>
      <div style={S.activityList}>
        {recent.length === 0 ? (
          <div style={S.empty}>no recent activity</div>
        ) : (
          recent.map((ev, i) => <ActivityRow key={i} event={ev} />)
        )}
      </div>

      {building && (
        <div style={{ borderTop: `1px solid ${sol.base01}` }}>
          <StatsPanel />
        </div>
      )}
    </div>
  );
}
