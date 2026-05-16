import { useEffect, useRef, useState, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useUiStore, DISPATCH_ROLES } from '../store/uiStore';
import type { DispatchRole } from '../store/uiStore';
import { sol, FONT } from '../hud/palette';
import { useFocusTrap, useFocusRestore } from '../hooks/useFocusTrap';

const S: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(13,16,20,0.82)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '20vh',
    fontFamily: FONT,
  },
  palette: {
    width: 420,
    maxWidth: '90vw',
    background: sol.base02,
    border: `1px solid ${sol.yellow}`,
    borderRadius: 4,
    overflow: 'hidden',
    pointerEvents: 'auto',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    gap: 8,
    borderBottom: `1px solid ${sol.base01}`,
  },
  prompt: {
    color: sol.yellow,
    fontSize: 12,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: sol.base2,
    fontFamily: FONT,
    fontSize: 12,
    caretColor: sol.yellow,
  },
  list: {
    maxHeight: 300,
    overflow: 'auto',
  },
  item: {
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    cursor: 'pointer',
    fontSize: 11,
  },
  itemLabel: {
    fontWeight: 600,
  },
  itemDesc: {
    fontSize: 10,
    color: sol.base00,
  },
  empty: {
    padding: '12px',
    color: sol.base00,
    fontSize: 11,
    textAlign: 'center',
  },
};

export function CommandPalette(): JSX.Element | null {
  const phase2 = useUiStore((s) => s.phase2);
  const open = useUiStore((s) => s.commandPaletteOpen);
  const closeCommandPalette = useUiStore((s) => s.closeCommandPalette);
  const openDispatch = useUiStore((s) => s.openDispatch);
  const cursorBuildingId = useUiStore((s) => s.cursorBuildingId);

  const [filter, setFilter] = useState('');
  const [focusIndex, setFocusIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useFocusTrap(containerRef, open);
  useFocusRestore(open);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setFilter('');
      setFocusIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!filter) return DISPATCH_ROLES;
    const q = filter.toLowerCase();
    return DISPATCH_ROLES.filter(
      (r) => r.label.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
    );
  }, [filter]);

  // Clamp focus index when filtered list changes
  useEffect(() => {
    setFocusIndex((prev) => Math.min(prev, Math.max(filtered.length - 1, 0)));
  }, [filtered]);

  const selectRole = (role: DispatchRole): void => {
    openDispatch(cursorBuildingId ?? undefined, role);
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      closeCommandPalette();
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown' || (e.key === 'j' && e.ctrlKey)) {
      setFocusIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowUp' || (e.key === 'k' && e.ctrlKey)) {
      setFocusIndex((prev) => Math.max(prev - 1, 0));
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter') {
      const role = filtered[focusIndex];
      if (role) selectRole(role.id);
      e.preventDefault();
      return;
    }
  };

  if (!phase2 || !open) return null;

  return (
    <div style={S.backdrop} onClick={closeCommandPalette}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        style={S.palette}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div style={S.inputRow}>
          <span style={S.prompt} aria-hidden="true">▶</span>
          <input
            ref={inputRef}
            style={S.input}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="choose role..."
            aria-label="Search roles"
            spellCheck={false}
          />
        </div>
        <div role="listbox" aria-label="Roles" style={S.list}>
          {filtered.length === 0 ? (
            <div style={S.empty}>no matching roles</div>
          ) : (
            filtered.map((role, i) => {
              const isFocused = i === focusIndex;
              return (
                <div
                  key={role.id}
                  role="option"
                  aria-selected={isFocused}
                  style={{
                    ...S.item,
                    background: isFocused ? `${sol.yellow}18` : 'transparent',
                    borderLeft: isFocused ? `2px solid ${sol.yellow}` : '2px solid transparent',
                  }}
                  onClick={() => selectRole(role.id)}
                  onMouseEnter={() => setFocusIndex(i)}
                >
                  <span style={{ ...S.itemLabel, color: isFocused ? sol.base2 : sol.base0 }}>
                    {role.label}
                  </span>
                  <span style={S.itemDesc}>{role.description}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
