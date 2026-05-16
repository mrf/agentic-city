import type { CSSProperties } from 'react';
import { useCityStore } from '../store/cityStore';
import { sol, ciColor, coverageColor, hudBase, TOP_BAR_H } from './palette';

const S: Record<string, CSSProperties> = {
  bar: {
    ...hudBase,
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: TOP_BAR_H,
    background: sol.base02,
    borderBottom: `1px solid ${sol.base01}`,
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    gap: 16,
    zIndex: 100,
    overflow: 'hidden',
    minWidth: 0,
  },
  sep: {
    color: sol.base01,
  },
  label: {
    color: sol.base0,
    marginRight: 4,
  },
  spacer: {
    flex: 1,
    minWidth: 8,
  },
  identity: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexShrink: 0,
    overflow: 'hidden',
  },
  stats: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    overflow: 'hidden',
    flexShrink: 1,
    minWidth: 0,
    whiteSpace: 'nowrap' as const,
  },
};

function Stat({ label, value, color }: { label: string; value: string; color?: string }): JSX.Element {
  const ariaLabel = label.trim() ? `${label.trim()} ${value}` : value;
  return (
    <span aria-label={ariaLabel}>
      <span style={S.label} aria-hidden="true">{label}</span>
      <span style={{ color: color ?? sol.base2 }} aria-hidden="true">{value}</span>
    </span>
  );
}

export function TopBar(): JSX.Element {
  const repoInfo = useCityStore((s) => s.city.repoInfo);
  const stats = useCityStore((s) => s.city.stats);

  const sha = repoInfo.headCommit ? repoInfo.headCommit.slice(0, 7) : '-------';
  const cov = stats.coverage >= 0 ? `${Math.round(stats.coverage * 100)}%` : '—';
  const tests =
    stats.testsTotal > 0
      ? `${stats.testsPassing}/${stats.testsTotal}`
      : '—';

  return (
    <header style={S.bar}>
      {/* Left: repo identity */}
      <div style={S.identity}>
        <Stat label="" value={repoInfo.name || 'agentic-city'} color={sol.base2} />
        <span style={S.sep}>·</span>
        <Stat label="" value={repoInfo.branch || 'main'} color={sol.violet} />
        <Stat label="@ " value={sha} color={sol.base00} />
        <span style={S.sep}>|</span>
        <Stat label="CI " value={repoInfo.ciStatus || 'unknown'} color={ciColor(repoInfo.ciStatus)} />
      </div>

      <div style={S.spacer} />

      {/* Right: repo stats — clip when narrow */}
      <div style={S.stats}>
        <Stat label="files " value={String(stats.fileCount)} />
        <span style={S.sep}>·</span>
        <Stat label="LOC " value={stats.totalLoc.toLocaleString()} />
        <span style={S.sep}>·</span>
        <Stat label="cov " value={cov} color={coverageColor(stats.coverage)} />
        <span style={S.sep}>·</span>
        <Stat label="tests " value={tests} color={stats.testsPassing === stats.testsTotal && stats.testsTotal > 0 ? sol.green : sol.base1} />
        {stats.openPrs > 0 && (
          <>
            <span style={S.sep}>·</span>
            <Stat label="PRs " value={String(stats.openPrs)} color={sol.yellow} />
          </>
        )}
      </div>
    </header>
  );
}
