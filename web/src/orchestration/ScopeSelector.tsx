import type { CSSProperties } from 'react';
import { useUiStore } from '../store/uiStore';
import type { Building } from '../store/cityStore';
import { sol, FONT, langColor } from '../hud/palette';

interface ScopeSelectorProps {
  sortedBuildings: Building[];
  focusIndex: number;
}

const S: Record<string, CSSProperties> = {
  container: {
    flex: 1,
    overflow: 'auto',
  },
  districtHeader: {
    padding: '6px 12px 2px',
    color: sol.cyan,
    fontSize: 9,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    fontWeight: 'bold',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: '3px 12px',
    gap: 8,
    fontSize: 11,
    cursor: 'pointer',
  },
  checkbox: {
    width: 14,
    height: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${sol.base01}`,
    borderRadius: 2,
    fontSize: 10,
    flexShrink: 0,
  },
  filename: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  meta: {
    flexShrink: 0,
    fontSize: 10,
  },
  summary: {
    padding: '6px 12px',
    borderTop: `1px solid ${sol.base01}`,
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
    color: sol.base0,
    fontFamily: FONT,
  },
};

export function ScopeSelector({ sortedBuildings, focusIndex }: ScopeSelectorProps): JSX.Element {
  const dispatchScope = useUiStore((s) => s.dispatchScope);
  const toggleScopeBuilding = useUiStore((s) => s.toggleScopeBuilding);

  const totalLoc = sortedBuildings
    .filter((b) => dispatchScope.includes(b.id))
    .reduce((sum, b) => sum + b.loc, 0);

  return (
    <div style={S.container}>
      {sortedBuildings.map((b, i) => {
        const isSelected = dispatchScope.includes(b.id);
        const isFocused = i === focusIndex;
        const showHeader = i === 0 || b.districtId !== sortedBuildings[i - 1].districtId;

        return (
          <div key={b.id}>
            {showHeader && (
              <div style={S.districtHeader}>{b.districtId}/</div>
            )}
            <div
              style={{
                ...S.row,
                background: isFocused ? `${sol.yellow}18` : 'transparent',
                borderLeft: isFocused ? `2px solid ${sol.yellow}` : '2px solid transparent',
              }}
              onClick={() => toggleScopeBuilding(b.id)}
            >
              <span
                style={{
                  ...S.checkbox,
                  background: isSelected ? `${sol.yellow}33` : 'transparent',
                  borderColor: isSelected ? sol.yellow : sol.base01,
                  color: isSelected ? sol.yellow : 'transparent',
                }}
              >
                ✓
              </span>
              <span style={{ ...S.filename, color: isFocused ? sol.base2 : sol.base0 }}>
                {b.label}
              </span>
              <span style={{ ...S.meta, color: langColor(b.language) }}>
                {b.language}
              </span>
              <span style={{ ...S.meta, color: sol.base00 }}>
                {b.loc}
              </span>
            </div>
          </div>
        );
      })}

      <div style={S.summary}>
        <span>{dispatchScope.length} selected</span>
        <span>{totalLoc.toLocaleString()} LOC</span>
      </div>
    </div>
  );
}
