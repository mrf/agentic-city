import type { CSSProperties } from 'react';
import { useCityStore } from '../store/cityStore';
import type { Agent } from '../store/cityStore';
import { sol, hudBase, TOP_BAR_H, BOTTOM_STRIP_H } from './palette';

const RAIL_W = 200;

const S: Record<string, CSSProperties> = {
  rail: {
    ...hudBase,
    position: 'fixed',
    top: TOP_BAR_H,
    left: 0,
    bottom: BOTTOM_STRIP_H,
    width: RAIL_W,
    background: `${sol.base02}e6`,
    borderRight: `1px solid ${sol.base01}`,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 90,
  },
  header: {
    padding: '6px 10px',
    color: sol.base0,
    borderBottom: `1px solid ${sol.base01}`,
    letterSpacing: '0.08em',
    fontSize: 10,
    textTransform: 'uppercase' as const,
  },
  agentList: {
    flex: 1,
    overflowY: 'hidden' as const,
    padding: '4px 0',
  },
  agentRow: {
    padding: '5px 10px 4px',
    borderBottom: `1px solid ${sol.base03}`,
  },
  agentTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0,
  },
  agentId: {
    color: sol.base2,
    fontWeight: 600,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  mode: {
    color: sol.base00,
    fontSize: 10,
  },
  task: {
    color: sol.base0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    marginBottom: 4,
    fontSize: 10,
  },
  trackOuter: {
    height: 3,
    background: sol.base01,
    borderRadius: 2,
    overflow: 'hidden',
  },
  empty: {
    padding: '12px 10px',
    color: sol.base01,
    fontSize: 10,
    textAlign: 'center' as const,
  },
};

function AgentRow({ agent }: { agent: Agent }): JSX.Element {
  const pct = Math.max(0, Math.min(1, agent.progress ?? 0));
  return (
    <div style={S.agentRow}>
      <div style={S.agentTop}>
        <span style={{ ...S.dot, background: agent.color || sol.base00 }} />
        <span style={S.agentId}>{agent.id}</span>
        <span style={S.mode}>{agent.mode}</span>
      </div>
      {agent.task && <div style={S.task}>{agent.task}</div>}
      <div style={S.trackOuter}>
        <div
          style={{
            height: '100%',
            width: `${pct * 100}%`,
            background: agent.color || sol.blue,
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      {agent.errorMsg && (
        <div style={{ color: sol.red, fontSize: 10, marginTop: 2 }}>{agent.errorMsg}</div>
      )}
    </div>
  );
}

export function LeftRail(): JSX.Element {
  const agents = useCityStore((s) => s.city.agents);

  return (
    <div style={S.rail}>
      <div style={S.header}>agents {agents.length > 0 ? `(${agents.length})` : ''}</div>
      <div style={S.agentList}>
        {agents.length === 0 ? (
          <div style={S.empty}>no active agents</div>
        ) : (
          agents.map((a) => <AgentRow key={a.id} agent={a} />)
        )}
      </div>
    </div>
  );
}
