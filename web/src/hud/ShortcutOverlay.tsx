import type { CSSProperties } from 'react';
import { useUiStore } from '../store/uiStore';
import { sol, FONT } from './palette';

interface ShortcutEntry {
  keys: string[];
  label: string;
}

interface ShortcutCategory {
  title: string;
  entries: ShortcutEntry[];
}

const CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Navigation',
    entries: [
      { keys: ['h', 'j', 'k', 'l'], label: 'Move cursor' },
      { keys: ['Tab'], label: 'Next in district' },
      { keys: ['Shift+Tab'], label: 'Prev in district' },
      { keys: ['{', '}'], label: 'Jump district' },
      { keys: ['Enter'], label: 'Select building' },
      { keys: ['F'], label: 'Focus/center cursor' },
    ],
  },
  {
    title: 'Camera',
    entries: [
      { keys: ['W', 'A', 'S', 'D'], label: 'Pan' },
      { keys: ['↑', '↓', '←', '→'], label: 'Pan (arrows)' },
      { keys: ['+', '='], label: 'Zoom in' },
      { keys: ['-'], label: 'Zoom out' },
      { keys: ['0'], label: 'Reset zoom' },
    ],
  },
  {
    title: 'View Toggles',
    entries: [
      { keys: ['R'], label: 'Toggle roads' },
      { keys: ['N'], label: 'Toggle labels' },
      { keys: ['M'], label: 'Toggle minimap' },
      { keys: ['C'], label: 'Toggle high-contrast' },
    ],
  },
  {
    title: 'Agents',
    entries: [
      { keys: ['1–9'], label: 'Jump to agent N' },
      { keys: ['G'], label: 'Next agent' },
      { keys: ['Shift+G'], label: 'Prev agent' },
      { keys: ['I'], label: 'Inspect agent' },
    ],
  },
  {
    title: 'Selection',
    entries: [
      { keys: ['Esc'], label: 'Return to city / deselect' },
      { keys: ['Backspace'], label: 'Return to city' },
    ],
  },
  {
    title: 'Overlays',
    entries: [
      { keys: ['?'], label: 'Show/hide shortcuts' },
    ],
  },
];

const DISPATCH_SHORTCUTS: ShortcutCategory = {
  title: 'Dispatch (Phase 2)',
  entries: [
    { keys: ['D'], label: 'Open dispatch wizard' },
    { keys: ['⌘K'], label: 'Command palette' },
    { keys: ['X'], label: 'Toggle alarm overlay' },
    { keys: ['↑', '↓'], label: 'Navigate list' },
    { keys: ['Space'], label: 'Toggle selection' },
    { keys: ['Enter'], label: 'Confirm / dispatch' },
    { keys: ['Esc'], label: 'Back / cancel / dismiss' },
    { keys: ['Tab'], label: 'Next step' },
  ],
};

const S: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(13,16,20,0.82)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: FONT,
  },
  panel: {
    background: sol.base02,
    border: `1px solid ${sol.base01}`,
    borderRadius: 4,
    padding: '20px 24px',
    minWidth: 480,
    maxWidth: 640,
    maxHeight: '80vh',
    overflowY: 'auto',
    color: sol.base1,
    fontSize: 12,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottom: `1px solid ${sol.base01}`,
    paddingBottom: 10,
  },
  title: {
    color: sol.base2,
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  dismiss: {
    color: sol.base00,
    fontSize: 11,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px 24px',
  },
  category: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  categoryTitle: {
    color: sol.cyan,
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  row: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    padding: '3px 0',
    borderBottom: `1px solid ${sol.base03}`,
  },
  keys: {
    display: 'flex',
    gap: 3,
    flexShrink: 0,
    minWidth: 100,
  },
  key: {
    display: 'inline-block',
    padding: '1px 5px',
    background: sol.base03,
    border: `1px solid ${sol.base01}`,
    borderRadius: 2,
    color: sol.base2,
    fontSize: 10,
    lineHeight: '1.5',
    whiteSpace: 'nowrap' as const,
  },
  entryLabel: {
    color: sol.base0,
    fontSize: 11,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};

function KeyBadge({ k }: { k: string }): JSX.Element {
  return <span style={S.key}>{k}</span>;
}

function Entry({ entry }: { entry: ShortcutEntry }): JSX.Element {
  return (
    <div style={S.row}>
      <span style={S.keys}>
        {entry.keys.map((k, i) => (
          <KeyBadge key={i} k={k} />
        ))}
      </span>
      <span style={S.entryLabel}>{entry.label}</span>
    </div>
  );
}

function Category({ cat }: { cat: ShortcutCategory }): JSX.Element {
  return (
    <div style={S.category}>
      <div style={S.categoryTitle}>{cat.title}</div>
      {cat.entries.map((e, i) => (
        <Entry key={i} entry={e} />
      ))}
    </div>
  );
}

export function ShortcutOverlay(): JSX.Element | null {
  const show = useUiStore((s) => s.showShortcutOverlay);
  const phase2 = useUiStore((s) => s.phase2);
  const toggleShortcutOverlay = useUiStore((s) => s.toggleShortcutOverlay);

  if (!show) return null;

  const allCategories = phase2 ? [...CATEGORIES, DISPATCH_SHORTCUTS] : CATEGORIES;

  return (
    <div
      style={S.backdrop}
      onClick={toggleShortcutOverlay}
    >
      <div
        style={S.panel}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={S.header}>
          <span style={S.title}>Keyboard Shortcuts</span>
          <span style={S.dismiss}>press ? or click outside to close</span>
        </div>
        <div style={S.grid}>
          {allCategories.map((cat) => (
            <Category key={cat.title} cat={cat} />
          ))}
        </div>
      </div>
    </div>
  );
}
