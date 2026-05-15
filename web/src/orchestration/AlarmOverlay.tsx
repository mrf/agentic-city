/**
 * AlarmOverlay — full-screen alarm state overlay triggered by build failures
 * or test errors. Shows red vignette, CRITICAL banner, bug origin panel,
 * blast radius, alarm log, health stats, and rapid-response dispatch.
 *
 * Visual spec: code-sim/project/sketches/sketch-D-failure.jsx
 * Design ref: DESIGN.md P2.3
 */

import { useEffect, useRef, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useCityStore } from '../store/cityStore';
import type { Building, Road, ActivityEvent } from '../store/cityStore';
import { useUiStore } from '../store/uiStore';
import { sol, FONT, TOP_BAR_H, BOTTOM_STRIP_H } from '../hud/palette';
import { RapidResponse } from './RapidResponse';

// ── Alarm state derivation ──────────────────────────────────────────

export interface AlarmInfo {
  /** The primary error-origin building (CRIT > err, first match). */
  origin: Building | null;
  /** All buildings in the blast radius (err/warn status or downstream deps). */
  blastRadius: Building[];
  /** Recent error/warn activity events, most recent first. */
  alarmEvents: ActivityEvent[];
  /** Counts for the health panel. */
  errorCount: number;
  warningCount: number;
}

/** Walk the dependency graph from `originId` to find downstream buildings. */
function findDownstream(
  originId: string,
  roads: Road[],
  buildingMap: Map<string, Building>,
): Set<string> {
  const visited = new Set<string>();
  const queue = [originId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const road of roads) {
      if (road.fromId === current && !visited.has(road.toId) && buildingMap.has(road.toId)) {
        queue.push(road.toId);
      }
      if (road.toId === current && !visited.has(road.fromId) && buildingMap.has(road.fromId)) {
        queue.push(road.fromId);
      }
    }
  }
  return visited;
}

/** Derive alarm state from the current city snapshot. */
export function deriveAlarmInfo(
  buildings: Building[],
  roads: Road[],
  activities: ActivityEvent[],
): AlarmInfo {
  const buildingMap = new Map(buildings.map((b) => [b.id, b]));

  // Find origin: prefer CRIT, then first err
  const critBuildings = buildings.filter((b) => b.status === 'CRIT');
  const errBuildings = buildings.filter((b) => b.status === 'err');
  const warnBuildings = buildings.filter((b) => b.status === 'warn');
  const origin = critBuildings[0] ?? errBuildings[0] ?? null;

  // Blast radius: walk dependency graph from origin + all error/warn buildings
  const blastSet = new Set<string>();
  if (origin) {
    const downstream = findDownstream(origin.id, roads, buildingMap);
    for (const id of downstream) blastSet.add(id);
  }
  for (const b of errBuildings) blastSet.add(b.id);
  for (const b of warnBuildings) blastSet.add(b.id);

  const blastRadius = buildings.filter((b) => blastSet.has(b.id));

  // Alarm events: error and warn severity, most recent first
  const alarmEvents = [...activities]
    .filter((a) => a.severity === 'error' || a.severity === 'warn')
    .reverse()
    .slice(0, 12);

  const errorCount = errBuildings.length + critBuildings.length;
  const warningCount = warnBuildings.length;

  return { origin, blastRadius, alarmEvents, errorCount, warningCount };
}

// ── Blast radius type badge ─────────────────────────────────────────

function blastType(b: Building, originId: string | null): string {
  if (b.id === originId) return 'origin';
  if (b.status === 'err' || b.status === 'CRIT') return 'error';
  if (b.status === 'warn') return 'warn';
  return 'dep';
}

function blastColor(type: string): string {
  switch (type) {
    case 'origin':
    case 'error':  return sol.red;
    case 'warn':   return sol.yellow;
    default:       return sol.base0;
  }
}

// ── Time formatting ─────────────────────────────────────────────────

function fmtTs(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts.slice(-8);
    return d.toLocaleTimeString('en-US', { hour12: false });
  } catch {
    return '';
  }
}

function timeSince(activities: ActivityEvent[]): string {
  const errorEvents = activities.filter((a) => a.severity === 'error');
  if (errorEvents.length === 0) return '--:--';
  try {
    const firstError = new Date(errorEvents[errorEvents.length - 1].ts);
    const elapsed = Math.max(0, Math.floor((Date.now() - firstError.getTime()) / 1000));
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  } catch {
    return '--:--';
  }
}

// ── Styles ──────────────────────────────────────────────────────────

const PANEL_BG = 'rgba(40,5,8,0.92)';
const PANEL_BORDER = `1px solid ${sol.red}40`;

const S: Record<string, CSSProperties> = {
  vignette: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 140,
    background: `radial-gradient(ellipse at center, transparent 30%, rgba(161,74,72,0.25) 70%, rgba(161,74,72,0.55) 100%)`,
    boxShadow: `inset 0 0 120px rgba(161,74,72,0.6), inset 0 0 240px rgba(161,74,72,0.3)`,
  },
  banner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: TOP_BAR_H,
    borderBottom: `1px solid ${sol.red}`,
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    gap: 14,
    fontFamily: FONT,
    fontSize: 10,
    color: sol.red,
    background: PANEL_BG,
    zIndex: 160,
    pointerEvents: 'auto',
    userSelect: 'none',
  },
  leftPanel: {
    position: 'fixed',
    top: TOP_BAR_H + 8,
    left: 8,
    width: 200,
    maxWidth: 'calc(40vw - 16px)',
    zIndex: 155,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontFamily: FONT,
    fontSize: 10,
    color: sol.base0,
    pointerEvents: 'auto',
    userSelect: 'none',
    maxHeight: `calc(100vh - ${TOP_BAR_H + BOTTOM_STRIP_H + 24}px)`,
    overflowY: 'auto',
  },
  rightPanel: {
    position: 'fixed',
    top: TOP_BAR_H + 8,
    right: 8,
    width: 200,
    maxWidth: 'calc(40vw - 16px)',
    zIndex: 155,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontFamily: FONT,
    fontSize: 10,
    color: sol.base0,
    pointerEvents: 'auto',
    userSelect: 'none',
    maxHeight: `calc(100vh - ${TOP_BAR_H + BOTTOM_STRIP_H + 24}px)`,
    overflowY: 'auto',
  },
  panel: {
    background: PANEL_BG,
    border: PANEL_BORDER,
    borderRadius: 2,
    padding: '6px 8px',
  },
  panelTitle: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    fontSize: 9,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.12em',
    fontWeight: 700,
  },
  panelSub: {
    opacity: 0.7,
    fontWeight: 400,
  },
  blastRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 9,
    padding: '2px 0',
    borderBottom: `1px dotted ${sol.red}25`,
  },
  eventRow: {
    display: 'flex',
    gap: 6,
    fontSize: 9,
    padding: '2px 0',
    borderBottom: `1px dotted ${sol.red}20`,
    lineHeight: '1.5',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 9,
    padding: '2px 0',
  },
};

// ── Sub-components ──────────────────────────────────────────────────

function PanelBox({
  title,
  sub,
  color,
  children,
}: {
  title: string;
  sub?: string;
  color: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div style={S.panel}>
      <div style={{ ...S.panelTitle, color }}>
        <span>{title}</span>
        {sub && <span style={S.panelSub}>{sub}</span>}
      </div>
      {children}
    </div>
  );
}

function StatLine({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}): JSX.Element {
  return (
    <div style={S.statRow}>
      <span style={{ opacity: 0.65 }}>{label}</span>
      <span style={{ color: valueColor ?? sol.base1 }}>{value}</span>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────

export function AlarmOverlay(): JSX.Element | null {
  const phase2 = useUiStore((s) => s.phase2);
  const alarmActive = useUiStore((s) => s.alarmActive);
  const dismissAlarm = useUiStore((s) => s.dismissAlarm);
  const dispatchMode = useUiStore((s) => s.dispatchMode);

  const buildings = useCityStore((s) => s.city.buildings);
  const roads = useCityStore((s) => s.city.roads);
  const activities = useCityStore((s) => s.city.activities);
  const stats = useCityStore((s) => s.city.stats);
  const repoInfo = useCityStore((s) => s.city.repoInfo);

  const alarm = useMemo(
    () => deriveAlarmInfo(buildings, roads, activities),
    [buildings, roads, activities],
  );

  // Keyboard handler — Escape dismisses alarm when dispatch wizard is closed
  const dispatchRef = useRef(dispatchMode);
  dispatchRef.current = dispatchMode;

  useEffect(() => {
    if (!alarmActive) return;

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (dispatchRef.current) return;

      if (e.key === 'Escape') {
        dismissAlarm();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [alarmActive, dismissAlarm]);

  if (!phase2 || !alarmActive) return null;

  // No alarm data to show
  const hasAlarmCondition =
    alarm.origin !== null ||
    alarm.errorCount > 0 ||
    repoInfo.ciStatus === 'fail';

  if (!hasAlarmCondition) return null;

  const cov = stats.coverage >= 0 ? `${Math.round(stats.coverage * 100)}%` : '--';
  const tests = stats.testsTotal > 0
    ? `${stats.testsPassing}/${stats.testsTotal}`
    : '--';
  const elapsed = timeSince(activities);
  const originLabel = alarm.origin?.label ?? 'unknown';
  const originDistrict = alarm.origin?.districtId ?? '';

  return (
    <>
      {/* CSS animations for alarm state */}
      <style>{`
        @keyframes ac-alarm-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0.25; }
        }
        @keyframes ac-alarm-pulse {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.95; transform: scale(1.08); }
        }
        .ac-alarm-blink { animation: ac-alarm-blink 1.1s steps(1) infinite; }
        .ac-alarm-pulse { animation: ac-alarm-pulse 1.6s ease-in-out infinite; transform-origin: center; }
      `}</style>

      {/* Red vignette */}
      <div className="ac-alarm-pulse" style={S.vignette} />

      {/* CRITICAL banner — replaces top bar */}
      <div style={S.banner}>
        <span
          className="ac-alarm-blink"
          style={{ fontWeight: 700, letterSpacing: '0.2em' }}
        >
          {'▲ CRITICAL'}
        </span>
        {repoInfo.ciStatus === 'fail' && (
          <span style={{ opacity: 0.85 }}>CI :: FAILED</span>
        )}
        <span style={{ opacity: 0.7 }}>
          blast-radius={alarm.blastRadius.length}
        </span>
        <span style={{ opacity: 0.7 }}>since={elapsed}</span>
        <span style={{ flex: 1 }} />
        <span>tests={tests}</span>
        <span>cov={cov}</span>
        {alarm.warningCount > 0 && (
          <span style={{ color: sol.yellow }}>
            {'● '}{alarm.warningCount} warn
          </span>
        )}
        <span
          className="ac-alarm-blink"
          style={{ color: sol.red, fontWeight: 700 }}
        >
          {'● '}{alarm.errorCount} ERR
        </span>
      </div>

      {/* Left panel — bug report + blast radius + dispatch */}
      <div style={S.leftPanel}>
        {/* Bug origin */}
        {alarm.origin && (
          <PanelBox
            title={'◆ BUG ORIGIN'}
            sub={`${originDistrict}/${originLabel}`}
            color={sol.red}
          >
            <div style={{ fontSize: 9, color: sol.red, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, marginBottom: 3 }}>
                {alarm.origin.status === 'CRIT' ? 'Critical Error' : 'Error'}
              </div>
              <div style={{ fontSize: 8, color: sol.base0, opacity: 0.85, lineHeight: 1.4 }}>
                Build failure in {originLabel}
              </div>
              {/* Stack trace hint — district path */}
              <div
                style={{
                  borderTop: `1px dashed ${sol.red}50`,
                  marginTop: 5,
                  paddingTop: 5,
                  fontSize: 8,
                  color: sol.base0,
                }}
              >
                <span style={{ opacity: 0.5 }}>at</span> {originDistrict}/{originLabel}
              </div>
            </div>
          </PanelBox>
        )}

        {/* Blast radius */}
        {alarm.blastRadius.length > 0 && (
          <PanelBox title="BLAST RADIUS" sub="downstream" color={sol.red}>
            {alarm.blastRadius.map((b) => {
              const type = blastType(b, alarm.origin?.id ?? null);
              return (
                <div key={b.id} style={S.blastRow}>
                  <span style={{ color: blastColor(type) }}>
                    {'● '}{b.label}
                  </span>
                  <span style={{ opacity: 0.55 }}>{type}</span>
                </div>
              );
            })}
          </PanelBox>
        )}

        {/* Rapid-response dispatch */}
        <RapidResponse alarm={alarm} />
      </div>

      {/* Right panel — alarm log + health */}
      <div style={S.rightPanel}>
        {/* Alarm events */}
        <PanelBox title="ALARMS" sub="LIVE" color={sol.red}>
          {alarm.alarmEvents.length === 0 ? (
            <div style={{ fontSize: 9, opacity: 0.5 }}>no alarm events</div>
          ) : (
            alarm.alarmEvents.map((ev, i) => (
              <div key={i} style={S.eventRow}>
                <span style={{ opacity: 0.5, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtTs(ev.ts)}
                </span>
                <span
                  style={{
                    flex: 1,
                    color: ev.severity === 'error' ? sol.red : sol.yellow,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ev.message}
                </span>
              </div>
            ))
          )}
        </PanelBox>

        {/* Health stats */}
        <PanelBox title="HEALTH" color={sol.red}>
          <StatLine label="errors" value={String(alarm.errorCount)} valueColor={sol.red} />
          <StatLine label="warnings" value={String(alarm.warningCount)} valueColor={sol.yellow} />
          <StatLine
            label="passing"
            value={tests}
            valueColor={
              stats.testsPassing === stats.testsTotal && stats.testsTotal > 0
                ? sol.green
                : sol.yellow
            }
          />
          <StatLine label="coverage" value={cov} />
          <StatLine label="since" value={elapsed} valueColor={sol.red} />
        </PanelBox>
      </div>
    </>
  );
}
