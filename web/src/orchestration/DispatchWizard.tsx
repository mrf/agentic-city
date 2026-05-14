import { useEffect, useRef, useState, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useCityStore } from '../store/cityStore';
import { useUiStore, DISPATCH_ROLES } from '../store/uiStore';
import type { DispatchStep } from '../store/uiStore';
import { sol, FONT, TOP_BAR_H, BOTTOM_STRIP_H, tierColor } from '../hud/palette';
import { ScopeSelector } from './ScopeSelector';

const PANEL_W = 320;

const STEP_LABELS: Record<DispatchStep, string> = {
  1: 'select scope',
  2: 'choose role',
  3: 'review & dispatch',
};

const S: Record<string, CSSProperties> = {
  panel: {
    position: 'fixed',
    top: TOP_BAR_H,
    right: 0,
    bottom: BOTTOM_STRIP_H,
    width: PANEL_W,
    maxWidth: 'calc(50vw - 4px)',
    background: `${sol.base02}f2`,
    borderLeft: `1px solid ${sol.yellow}`,
    fontFamily: FONT,
    fontSize: 11,
    color: sol.base1,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 150,
    userSelect: 'none',
    pointerEvents: 'auto',
    overflow: 'hidden',
  },
  header: {
    padding: '8px 12px',
    borderBottom: `1px solid ${sol.base01}`,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 10,
    lineHeight: '1.4',
  },
  headerLabel: {
    color: sol.yellow,
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  headerInfo: {
    color: sol.base00,
  },
  steps: {
    display: 'flex',
    gap: 2,
    padding: '6px 12px',
    borderBottom: `1px solid ${sol.base01}`,
  },
  stepBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 2,
    fontSize: 10,
  },
  body: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  sectionHeader: {
    padding: '6px 12px',
    color: sol.base00,
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    borderBottom: `1px solid ${sol.base01}`,
  },
  roleItem: {
    padding: '6px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    cursor: 'pointer',
  },
  roleName: {
    fontWeight: 600,
    fontSize: 11,
  },
  roleDesc: {
    fontSize: 10,
    color: sol.base00,
  },
  scopeSummary: {
    padding: '6px 12px',
    fontSize: 10,
    color: sol.base0,
    borderBottom: `1px solid ${sol.base01}`,
    display: 'flex',
    justifyContent: 'space-between',
  },
  previewSection: {
    borderTop: `1px solid ${sol.base01}`,
    background: sol.base03,
    padding: '8px 12px',
    fontFamily: FONT,
    fontSize: 10,
    color: sol.base0,
    whiteSpace: 'pre',
    lineHeight: '1.6',
  },
  previewLabel: {
    color: sol.base00,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: 4,
    fontSize: 9,
  },
  agentRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '2px 12px',
    fontSize: 11,
  },
  dispatchRow: {
    padding: '8px 12px',
    display: 'flex',
    gap: 8,
    borderTop: `1px solid ${sol.base01}`,
  },
  dispatchBtn: {
    flex: 1,
    padding: '6px 0',
    textAlign: 'center',
    background: `${sol.yellow}22`,
    border: `1px solid ${sol.yellow}`,
    borderRadius: 2,
    color: sol.yellow,
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  footer: {
    padding: '6px 12px',
    borderTop: `1px solid ${sol.base01}`,
    display: 'flex',
    gap: 12,
    fontSize: 9,
    color: sol.base00,
  },
  hintKey: {
    display: 'inline-block',
    padding: '0 3px',
    background: sol.base03,
    border: `1px solid ${sol.base01}`,
    borderRadius: 2,
    color: sol.base1,
    fontSize: 8,
    lineHeight: '1.5',
    marginRight: 3,
  },
};

function HintBadge({ keys, label }: { keys: string[]; label: string }): JSX.Element {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {keys.map((k, i) => (
        <span key={i} style={S.hintKey}>{k}</span>
      ))}
      <span>{label}</span>
    </span>
  );
}

function stepColor(active: boolean, done: boolean): string {
  if (active) return sol.yellow;
  if (done) return sol.green;
  return sol.base00;
}

function roleNameColor(focused: boolean, selected: boolean): string {
  if (focused) return sol.base2;
  if (selected) return sol.yellow;
  return sol.base0;
}

function StepBadge(
  { num, label, active, done }: { num: number; label: string; active: boolean; done: boolean },
): JSX.Element {
  const bg = active ? `${sol.yellow}22` : 'transparent';
  const border = active ? `1px solid ${sol.yellow}44` : '1px solid transparent';
  const color = stepColor(active, done);
  const icon = done ? '✓' : `${num}`;

  return (
    <span style={{ ...S.stepBadge, background: bg, border, color }}>
      <span>{icon}</span>
      <span>{label}</span>
    </span>
  );
}

export function DispatchWizard(): JSX.Element | null {
  const phase2 = useUiStore((s) => s.phase2);
  const dispatchMode = useUiStore((s) => s.dispatchMode);
  const dispatchStep = useUiStore((s) => s.dispatchStep);
  const dispatchScope = useUiStore((s) => s.dispatchScope);
  const dispatchRole = useUiStore((s) => s.dispatchRole);
  const closeDispatch = useUiStore((s) => s.closeDispatch);
  const setDispatchStep = useUiStore((s) => s.setDispatchStep);
  const toggleScopeBuilding = useUiStore((s) => s.toggleScopeBuilding);
  const setDispatchRole = useUiStore((s) => s.setDispatchRole);

  const buildings = useCityStore((s) => s.city.buildings);
  const agents = useCityStore((s) => s.city.agents);

  const [scopeFocusIndex, setScopeFocusIndex] = useState(0);
  const [roleFocusIndex, setRoleFocusIndex] = useState(0);

  const sortedBuildings = useMemo(
    () =>
      [...buildings].sort((a, b) => {
        const dc = a.districtId.localeCompare(b.districtId);
        if (dc !== 0) return dc;
        return a.label.localeCompare(b.label);
      }),
    [buildings],
  );

  // Sync role focus index to pre-selected role
  useEffect(() => {
    if (dispatchRole) {
      const idx = DISPATCH_ROLES.findIndex((r) => r.id === dispatchRole);
      if (idx >= 0) setRoleFocusIndex(idx);
    }
  }, [dispatchRole]);

  // Reset focus indices on step change
  useEffect(() => {
    if (dispatchStep === 1) setScopeFocusIndex(0);
    if (dispatchStep === 2 && !dispatchRole) setRoleFocusIndex(0);
  }, [dispatchStep, dispatchRole]);

  // Keyboard handler — uses ref for current state
  const stateRef = useRef({
    dispatchStep, dispatchScope, dispatchRole, dispatchMode,
    sortedBuildings, scopeFocusIndex, roleFocusIndex,
  });
  stateRef.current = {
    dispatchStep, dispatchScope, dispatchRole, dispatchMode,
    sortedBuildings, scopeFocusIndex, roleFocusIndex,
  };

  useEffect(() => {
    if (!dispatchMode) return;

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const st = stateRef.current;
      if (!st.dispatchMode) return;

      // Escape: back or close
      if (e.key === 'Escape') {
        if (st.dispatchStep === 1) {
          closeDispatch();
        } else {
          setDispatchStep((st.dispatchStep - 1) as DispatchStep);
        }
        e.preventDefault();
        return;
      }

      // Tab / Shift+Tab: advance / retreat step
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (st.dispatchStep > 1) {
            setDispatchStep((st.dispatchStep - 1) as DispatchStep);
          }
        } else {
          if (st.dispatchStep === 1 && st.dispatchScope.length > 0) {
            setDispatchStep(2);
          } else if (st.dispatchStep === 2 && st.dispatchRole) {
            setDispatchStep(3);
          }
        }
        e.preventDefault();
        return;
      }

      switch (st.dispatchStep) {
        case 1: {
          const maxIdx = st.sortedBuildings.length - 1;
          if (e.key === 'j' || e.key === 'ArrowDown') {
            setScopeFocusIndex((prev) => Math.min(prev + 1, maxIdx));
            e.preventDefault();
          } else if (e.key === 'k' || e.key === 'ArrowUp') {
            setScopeFocusIndex((prev) => Math.max(prev - 1, 0));
            e.preventDefault();
          } else if (e.key === ' ') {
            const b = st.sortedBuildings[st.scopeFocusIndex];
            if (b) toggleScopeBuilding(b.id);
            e.preventDefault();
          } else if (e.key === 'Enter') {
            if (st.dispatchScope.length > 0) setDispatchStep(2);
            e.preventDefault();
          }
          break;
        }
        case 2: {
          const maxIdx = DISPATCH_ROLES.length - 1;
          if (e.key === 'j' || e.key === 'ArrowDown') {
            setRoleFocusIndex((prev) => Math.min(prev + 1, maxIdx));
            e.preventDefault();
          } else if (e.key === 'k' || e.key === 'ArrowUp') {
            setRoleFocusIndex((prev) => Math.max(prev - 1, 0));
            e.preventDefault();
          } else if (e.key === 'Enter') {
            const role = DISPATCH_ROLES[st.roleFocusIndex];
            if (role) {
              setDispatchRole(role.id);
              setDispatchStep(3);
            }
            e.preventDefault();
          }
          break;
        }
        case 3: {
          if (e.key === 'Enter') {
            closeDispatch();
            e.preventDefault();
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatchMode, closeDispatch, setDispatchStep, toggleScopeBuilding, setDispatchRole]);

  if (!phase2 || !dispatchMode) return null;

  const scopeBuildings = buildings.filter((b) => dispatchScope.includes(b.id));
  const scopeLoc = scopeBuildings.reduce((sum, b) => sum + b.loc, 0);
  const autoAgent = agents.find((a) => a.mode === 'idle' || a.mode === 'waiting' || a.mode === 'done') ?? null;

  // Build preview text
  const scopeNames = scopeBuildings.map((b) => b.label).join(',');
  const previewLines = ['> dispatch \\'];
  if (dispatchRole) previewLines.push(`    --role ${dispatchRole} \\`);
  if (scopeNames) previewLines.push(`    --scope ${scopeNames} \\`);
  previewLines.push(`    --agent ${autoAgent ? autoAgent.id : 'auto'}`);
  const previewText = previewLines.join('\n');

  return (
    <div style={S.panel}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.headerLabel}>▶ dispatch</span>
        <span style={S.headerInfo}>
          step {dispatchStep} of 3 — {STEP_LABELS[dispatchStep]}
        </span>
        {dispatchScope.length > 0 && (
          <span style={{ ...S.headerInfo, marginLeft: 'auto' }}>
            {dispatchScope.length} bldg ~{scopeLoc.toLocaleString()} LOC
          </span>
        )}
      </div>

      {/* Step indicators */}
      <div style={S.steps}>
        <StepBadge num={1} label="target" active={dispatchStep === 1} done={dispatchStep > 1} />
        <StepBadge num={2} label="role" active={dispatchStep === 2} done={dispatchStep > 2} />
        <StepBadge num={3} label="dispatch" active={dispatchStep === 3} done={false} />
      </div>

      {/* Body */}
      <div style={S.body}>
        {/* Scope summary (shown when past step 1) */}
        {dispatchStep > 1 && (
          <div style={S.scopeSummary}>
            <span>scope: {dispatchScope.length} file{dispatchScope.length !== 1 ? 's' : ''}</span>
            <span>{scopeLoc.toLocaleString()} LOC</span>
          </div>
        )}

        {/* Step 1: Scope selector */}
        {dispatchStep === 1 && (
          <ScopeSelector
            sortedBuildings={sortedBuildings}
            focusIndex={scopeFocusIndex}
          />
        )}

        {/* Step 2: Role selector */}
        {dispatchStep === 2 && (
          <>
            <div style={S.sectionHeader}>choose role</div>
            {DISPATCH_ROLES.map((role, i) => {
              const isFocused = i === roleFocusIndex;
              const isSelected = dispatchRole === role.id;
              return (
                <div
                  key={role.id}
                  style={{
                    ...S.roleItem,
                    background: isFocused ? `${sol.yellow}18` : 'transparent',
                    borderLeft: isFocused ? `2px solid ${sol.yellow}` : '2px solid transparent',
                  }}
                  onClick={() => {
                    setDispatchRole(role.id);
                    setRoleFocusIndex(i);
                    setDispatchStep(3);
                  }}
                >
                  <span
                    style={{
                      ...S.roleName,
                      color: roleNameColor(isFocused, isSelected),
                    }}
                  >
                    {isSelected ? '▸ ' : '  '}{role.label}
                  </span>
                  <span style={S.roleDesc}>{role.description}</span>
                </div>
              );
            })}
          </>
        )}

        {/* Step 3: Review & Dispatch */}
        {dispatchStep === 3 && (
          <>
            <div style={S.scopeSummary}>
              <span>role: {dispatchRole}</span>
            </div>
            <div style={S.sectionHeader}>agent</div>
            {autoAgent ? (
              <>
                <div style={S.agentRow}>
                  <span style={{ color: sol.base0 }}>id</span>
                  <span style={{ color: autoAgent.color || sol.base2 }}>{autoAgent.id}</span>
                </div>
                <div style={S.agentRow}>
                  <span style={{ color: sol.base0 }}>mode</span>
                  <span style={{ color: sol.base2 }}>{autoAgent.mode}</span>
                </div>
                {autoAgent.modelTier && (
                  <div style={S.agentRow}>
                    <span style={{ color: sol.base0 }}>tier</span>
                    <span style={{ color: tierColor(autoAgent.modelTier) }}>
                      {autoAgent.modelTier}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: '4px 12px', color: sol.base00, fontSize: 10 }}>
                auto-pick (when available)
              </div>
            )}
            <div style={S.dispatchRow}>
              <button type="button" style={S.dispatchBtn} onClick={closeDispatch}>
                ▶ DISPATCH
              </button>
            </div>
          </>
        )}
      </div>

      {/* Preview */}
      {(dispatchScope.length > 0 || dispatchRole) && (
        <div style={S.previewSection}>
          <div style={S.previewLabel}>$ preview</div>
          {previewText}
        </div>
      )}

      {/* Footer hints */}
      <div style={S.footer}>
        <HintBadge keys={['Esc']} label={dispatchStep === 1 ? 'cancel' : 'back'} />
        <HintBadge keys={['↑', '↓']} label="nav" />
        {dispatchStep === 1 && <HintBadge keys={['Space']} label="toggle" />}
        <HintBadge keys={['Enter']} label={dispatchStep === 3 ? 'dispatch' : 'next'} />
        <HintBadge keys={['Tab']} label="step" />
      </div>
    </div>
  );
}
