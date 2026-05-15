import type { CSSProperties } from 'react';
import { useCityStore } from '../store/cityStore';
import { useUiStore } from '../store/uiStore';
import { sol, hudBase, BOTTOM_STRIP_H } from './palette';

function activeColor(on: boolean): string {
  return on ? sol.cyan : sol.base00;
}

const S: Record<string, CSSProperties> = {
  strip: {
    ...hudBase,
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_STRIP_H,
    background: sol.base02,
    borderTop: `1px solid ${sol.base01}`,
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    gap: 16,
    fontSize: 10,
    color: sol.base00,
    zIndex: 100,
  },
  key: {
    display: 'inline-block',
    padding: '1px 4px',
    background: sol.base03,
    border: `1px solid ${sol.base01}`,
    borderRadius: 2,
    color: sol.base1,
    lineHeight: '1.4',
    fontSize: 9,
  },
  hint: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    whiteSpace: 'nowrap' as const,
  },
  sep: {
    color: sol.base01,
  },
  spacer: {
    flex: 1,
  },
  ticker: {
    color: sol.base0,
    maxWidth: 280,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    textAlign: 'right' as const,
  },
  zone: {
    color: sol.violet,
    marginLeft: 8,
  },
};

function Key({ k }: { k: string }): JSX.Element {
  return <span style={S.key}>{k}</span>;
}

function Hint({ keys, label, color }: { keys: string[]; label: string; color?: string }): JSX.Element {
  return (
    <span style={S.hint}>
      {keys.map((k, i) => (
        <Key key={i} k={k} />
      ))}
      <span style={color ? { color } : undefined}>{label}</span>
    </span>
  );
}

export function BottomStrip(): JSX.Element {
  const activities = useCityStore((s) => s.city.activities);
  const focusZone = useUiStore((s) => s.focusZone);
  const showRoads = useUiStore((s) => s.showRoads);
  const showLabels = useUiStore((s) => s.showLabels);
  const showMinimap = useUiStore((s) => s.showMinimap);
  const highContrast = useUiStore((s) => s.highContrast);
  const phase2 = useUiStore((s) => s.phase2);

  const lastActivity = activities.length > 0 ? activities[activities.length - 1] : null;

  return (
    <div style={S.strip}>
      <Hint keys={['h', 'j', 'k', 'l']} label="nav" />
      <span style={S.sep}>·</span>
      <Hint keys={['Enter']} label="select" />
      <span style={S.sep}>·</span>
      <Hint keys={['Esc']} label="city" />
      <span style={S.sep}>·</span>
      <Hint keys={['R']} label="roads" color={activeColor(showRoads)} />
      <Hint keys={['N']} label="labels" color={activeColor(showLabels)} />
      <Hint keys={['M']} label="minimap" color={activeColor(showMinimap)} />
      <Hint keys={['C']} label="contrast" color={activeColor(highContrast)} />
      <span style={S.sep}>·</span>
      <Hint keys={['W', 'A', 'S', 'D']} label="pan" />
      <Hint keys={['+', '−']} label="zoom" />
      <span style={S.sep}>·</span>
      <Hint keys={['?']} label="shortcuts" />
      {phase2 && (
        <>
          <span style={S.sep}>·</span>
          <Hint keys={['D']} label="dispatch" />
          <Hint keys={['⌘K']} label="palette" />
          <Hint keys={['X']} label="alarm" />
        </>
      )}

      <div style={S.spacer} />

      {lastActivity && (
        <span style={S.ticker}>
          <span style={{ color: lastActivity.color || sol.base0 }}>{lastActivity.who}</span>
          {': '}
          {lastActivity.message}
        </span>
      )}

      {focusZone !== 'city' && (
        <span style={S.zone}>focus: {focusZone}</span>
      )}
    </div>
  );
}
