/**
 * CoverageDropToast — appears when coverage regression is detected.
 *
 * Shows which files dropped below threshold and offers a one-click path to
 * open the dispatch wizard pre-populated with those files and the add-test
 * role. Can be dismissed with the "dismiss" button or the Escape key.
 *
 * Only rendered when phase2 is enabled (same gate as DispatchWizard).
 */

import { useCallback, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useUiStore } from '../store/uiStore';
import { sol, FONT, BOTTOM_STRIP_H } from '../hud/palette';

const S: Record<string, CSSProperties> = {
  toast: {
    position: 'fixed',
    bottom: BOTTOM_STRIP_H + 8,
    left: 12,
    width: 280,
    background: `${sol.base02}f2`,
    border: `1px solid ${sol.yellow}`,
    borderRadius: 2,
    fontFamily: FONT,
    fontSize: 11,
    color: sol.base1,
    zIndex: 200,
    userSelect: 'none',
  },
  header: {
    padding: '6px 10px',
    borderBottom: `1px solid ${sol.base01}`,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 10,
  },
  icon: {
    color: sol.yellow,
    fontWeight: 700,
    fontSize: 12,
  },
  title: {
    color: sol.yellow,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    fontSize: 10,
  },
  body: {
    padding: '6px 10px',
    fontSize: 10,
    color: sol.base0,
    lineHeight: 1.5,
  },
  role: {
    color: sol.cyan,
    fontWeight: 600,
  },
  actions: {
    padding: '6px 10px',
    borderTop: `1px solid ${sol.base01}`,
    display: 'flex',
    gap: 8,
  },
  dispatchBtn: {
    flex: 1,
    padding: '5px 0',
    background: `${sol.yellow}22`,
    border: `1px solid ${sol.yellow}`,
    borderRadius: 2,
    color: sol.yellow,
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
  },
  dismissBtn: {
    padding: '5px 8px',
    background: 'transparent',
    border: `1px solid ${sol.base01}`,
    borderRadius: 2,
    color: sol.base00,
    fontFamily: FONT,
    fontSize: 10,
    cursor: 'pointer',
  },
  hint: {
    padding: '0 10px 5px',
    fontSize: 8,
    color: sol.base01,
  },
};

export function CoverageDropToast(): JSX.Element | null {
  const phase2 = useUiStore((s) => s.phase2);
  const suggestion = useUiStore((s) => s.coverageDropSuggestion);
  const dismissCoverageDropSuggestion = useUiStore((s) => s.dismissCoverageDropSuggestion);
  const openDispatchForCoverage = useUiStore((s) => s.openDispatchForCoverage);
  const dispatchMode = useUiStore((s) => s.dispatchMode);

  const handleDispatch = useCallback(() => {
    if (!suggestion) return;
    openDispatchForCoverage(suggestion.affectedFileIds);
  }, [suggestion, openDispatchForCoverage]);

  // Escape key dismisses the toast (only when dispatch wizard is not open).
  useEffect(() => {
    if (!suggestion || dispatchMode) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismissCoverageDropSuggestion();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [suggestion, dispatchMode, dismissCoverageDropSuggestion]);

  if (!phase2 || !suggestion) return null;

  const fileCount = suggestion.affectedFileIds.length;
  const fileLabel = fileCount === 0
    ? 'unknown files'
    : `${fileCount} file${fileCount !== 1 ? 's' : ''}`;

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="Coverage drop suggestion"
      style={S.toast}
    >
      <div style={S.header}>
        <span style={S.icon} aria-hidden="true">▼</span>
        <span style={S.title}>coverage dropped</span>
      </div>

      <div style={S.body}>
        Regression detected in {fileLabel}.
        Suggest dispatching an{' '}
        <span style={S.role}>add-test</span>{' '}
        agent to restore coverage.
      </div>

      <div style={S.actions}>
        <button
          type="button"
          style={S.dispatchBtn}
          onClick={handleDispatch}
          aria-label={`Dispatch add-test agent for ${fileLabel}`}
        >
          ▶ add-test agent
        </button>
        <button
          type="button"
          style={S.dismissBtn}
          onClick={dismissCoverageDropSuggestion}
          aria-label="Dismiss coverage suggestion"
        >
          dismiss
        </button>
      </div>

      <div style={S.hint}>Esc to dismiss</div>
    </aside>
  );
}
