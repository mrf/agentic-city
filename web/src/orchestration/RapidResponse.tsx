/**
 * RapidResponse — one-click agent dispatch from the alarm panel.
 *
 * Pre-populates dispatch scope with blast-radius buildings and role with
 * 'fix-bug'. Provides a prominent DISPATCH NOW button and keyboard shortcut.
 */

import { useCallback, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useCityStore } from '../store/cityStore';
import { useUiStore } from '../store/uiStore';
import { sol, FONT, tierColor } from '../hud/palette';
import type { AlarmInfo } from './AlarmOverlay';

const PANEL_BG = 'rgba(40,5,8,0.92)';
const PANEL_BORDER = `1px solid ${sol.red}40`;

const S: Record<string, CSSProperties> = {
  panel: {
    background: PANEL_BG,
    border: PANEL_BORDER,
    borderRadius: 2,
    padding: '6px 8px',
  },
  title: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.12em',
    color: sol.yellow,
    marginBottom: 6,
  },
  recommend: {
    fontSize: 9,
    color: sol.base0,
    lineHeight: 1.4,
    marginBottom: 6,
  },
  agentInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 9,
    padding: '2px 0',
    color: sol.base0,
  },
  dispatchBtn: {
    width: '100%',
    marginTop: 6,
    background: sol.red,
    color: '#fff',
    border: 'none',
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: 700,
    padding: '5px 0',
    cursor: 'pointer',
    letterSpacing: '0.1em',
    borderRadius: 2,
  },
  hint: {
    fontSize: 8,
    color: sol.base00,
    marginTop: 4,
    textAlign: 'center' as const,
  },
};

export function RapidResponse({ alarm }: { alarm: AlarmInfo }): JSX.Element {
  const openDispatch = useUiStore((s) => s.openDispatch);
  const dismissAlarm = useUiStore((s) => s.dismissAlarm);
  const alarmActive = useUiStore((s) => s.alarmActive);
  const dispatchMode = useUiStore((s) => s.dispatchMode);
  const agents = useCityStore((s) => s.city.agents);

  const availableAgent = agents.find(
    (a) => a.mode === 'idle' || a.mode === 'waiting' || a.mode === 'done',
  ) ?? null;

  const handleDispatch = useCallback(() => {
    // Pre-select origin building and fix-bug role, then open dispatch wizard
    const originId = alarm.origin?.id;
    dismissAlarm();
    openDispatch(originId, 'fix-bug');
  }, [alarm.origin, openDispatch, dismissAlarm]);

  // Enter key dispatches when alarm is active and dispatch wizard isn't open
  useEffect(() => {
    if (!alarmActive || dispatchMode) return;

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Enter') {
        handleDispatch();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [alarmActive, dispatchMode, handleDispatch]);

  return (
    <div style={S.panel}>
      <div style={S.title}>DISPATCH</div>
      <div style={S.recommend}>
        recommend agent →{' '}
        <span style={{ color: sol.yellow, fontWeight: 700 }}>fix-bug</span>
      </div>
      {availableAgent && (
        <div style={S.agentInfo}>
          <span>agent: {availableAgent.id}</span>
          {availableAgent.modelTier && (
            <span style={{ color: tierColor(availableAgent.modelTier) }}>
              {availableAgent.modelTier}
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        style={S.dispatchBtn}
        onClick={handleDispatch}
      >
        {'▶ DISPATCH NOW'}
      </button>
      <div style={S.hint}>Enter to dispatch</div>
    </div>
  );
}
