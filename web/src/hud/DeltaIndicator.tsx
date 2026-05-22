import type { CSSProperties } from 'react';
import type { CoverageDelta } from '../store/coverageHistoryStore';
import { sol } from './palette';

const ARROW: Record<string, string> = {
  up: '↑',
  down: '↓',
  stable: '—',
};

const COLOR: Record<string, string> = {
  up: sol.green,
  down: sol.red,
  stable: sol.base01,
};

interface DeltaIndicatorProps {
  delta: CoverageDelta | null;
  style?: CSSProperties;
}

/**
 * Renders a color-coded delta indicator next to a coverage value.
 *
 * - Green ↑ for improvement
 * - Red ↓ for regression
 * - Grey — for stable / no change
 * - Nothing when delta is null (insufficient history)
 */
export function DeltaIndicator({ delta, style }: DeltaIndicatorProps): JSX.Element | null {
  if (delta === null) return null;

  const arrow = ARROW[delta.direction];
  const color = COLOR[delta.direction];
  const pct = Math.round(Math.abs(delta.value) * 100);
  const label = delta.direction === 'stable' ? arrow : `${arrow}${pct}%`;

  return (
    <span
      style={{ color, fontSize: '0.85em', marginLeft: 3, ...style }}
      aria-label={`coverage delta ${delta.direction}${delta.direction !== 'stable' ? ` ${pct} percent` : ''}`}
    >
      {label}
    </span>
  );
}
