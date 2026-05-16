import type { CSSProperties } from 'react';
import { useCityStore } from '../store/cityStore';
import { useUiStore } from '../store/uiStore';
import type { Agent, ModelTier } from '../store/cityStore';
import { sol, hudBase, tierColor, modeColor, TOP_BAR_H, BOTTOM_STRIP_H } from './palette';

const RAIL_W = 200;

const TIER_LABELS: Record<ModelTier, string> = {
  opus: 'OPS', sonnet: 'SNT', haiku: 'HKU', unknown: '???',
};

const S: Record<string, CSSProperties> = {
  rail: {
    ...hudBase,
    position: 'fixed',
    top: TOP_BAR_H,
    left: 0,
    bottom: BOTTOM_STRIP_H,
    width: RAIL_W,
    maxWidth: 'calc(50vw - 4px)',
    background: `${sol.base02}e6`,
    borderRight: `1px solid ${sol.base01}`,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 90,
    overflow: 'hidden',
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
    cursor: 'default',
  },
  agentTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  keyHint: {
    color: sol.base01,
    fontSize: 9,
    minWidth: 10,
    flexShrink: 0,
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
  tierBadge: {
    fontSize: 8,
    padding: '1px 3px',
    borderRadius: 2,
    fontWeight: 700,
    letterSpacing: '0.05em',
    flexShrink: 0,
  },
  modeLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  modeLabel: {
    fontSize: 10,
    fontWeight: 600,
    flexShrink: 0,
  },
  task: {
    color: sol.base0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    flex: 1,
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

function AgentRow({ agent, index, focused }: { agent: Agent; index: number; focused: boolean }): JSX.Element {
  const pct = Math.max(0, Math.min(100, agent.progress ?? 0));
  const tc = tierColor(agent.modelTier);
  const mc = modeColor(agent.mode);
  const rowStyle: CSSProperties = focused
    ? { ...S.agentRow, background: `${sol.base01}55`, borderLeft: `2px solid ${sol.blue}`, paddingLeft: 8 }
    : S.agentRow;

  return (
    <div role="listitem" aria-label={`Agent ${agent.id}, ${agent.mode || 'idle'}`} style={rowStyle}>
      <div style={S.agentTop}>
        <span style={S.keyHint}>{index < 9 ? index + 1 : ''}</span>
        <span style={{ ...S.dot, background: agent.color || sol.base00 }} />
        <span style={S.agentId}>{agent.id}</span>
        <span
          style={{
            ...S.tierBadge,
            color: tc,
            background: `${tc}22`,
            border: `1px solid ${tc}55`,
          }}
        >
          {TIER_LABELS[agent.modelTier ?? 'unknown']}
        </span>
      </div>
      <div style={S.modeLine}>
        <span style={{ ...S.modeLabel, color: mc }}>{agent.mode || 'idle'}</span>
        {agent.task && <span style={S.task}>{agent.task}</span>}
      </div>
      <div style={S.trackOuter}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
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
  const focusedAgentIndex = useUiStore((s) => s.focusedAgentIndex);

  return (
    <nav style={S.rail} aria-label="Agents">
      <div style={S.header}>agents {agents.length > 0 ? `(${agents.length})` : ''}</div>
      <div role="list" style={S.agentList}>
        {agents.length === 0 ? (
          <div style={S.empty}>no active agents</div>
        ) : (
          agents.map((a, i) => (
            <AgentRow key={a.id} agent={a} index={i} focused={focusedAgentIndex === i} />
          ))
        )}
      </div>
    </nav>
  );
}
