/** Solarized dark palette used across canvas and HUD. */
export const sol = {
  base03: '#0d1014',
  base02: '#161b21',
  base01: '#3a4148',
  base00: '#525a62',
  base0: '#8a9097',
  base1: '#9ea4ab',
  base2: '#d8d6c8',
  blue: '#4a7a9c',
  cyan: '#4a8a8a',
  green: '#6a8a4a',
  yellow: '#a9923a',
  orange: '#b06a3a',
  red: '#a14a48',
  violet: '#6a6aa0',
  magenta: '#9c5070',
} as const;

export const FONT = '"JetBrains Mono", monospace';

/** Height of the top bar in pixels. */
export const TOP_BAR_H = 32;

/** Height of the bottom strip in pixels. */
export const BOTTOM_STRIP_H = 28;

/** Common base styles shared across all HUD panels. */
export const hudBase = {
  fontFamily: FONT,
  fontSize: 11,
  color: sol.base1,
  userSelect: 'none' as const,
  pointerEvents: 'none' as const,
  overflow: 'hidden',
} as const;

/** Map CI/build status string to a display color. */
export function ciColor(status: string): string {
  if (status === 'ok' || status === 'pass') return sol.green;
  if (status === 'fail' || status === 'error') return sol.red;
  if (status === 'running' || status === 'pending') return sol.yellow;
  return sol.base00;
}

/** Map coverage number (0–1) to color. -1 = unknown. */
export function coverageColor(cov: number): string {
  if (cov < 0) return sol.base00;
  if (cov >= 0.8) return sol.green;
  if (cov >= 0.5) return sol.yellow;
  return sol.red;
}

/** Map language string to a display color. */
export function langColor(lang: string): string {
  switch (lang) {
    case 'ts': return sol.blue;
    case 'tsx': return sol.violet;
    case 'js': return sol.yellow;
    case 'go': return sol.cyan;
    case 'py': return sol.green;
    case 'rs': return sol.orange;
    case 'css': return sol.magenta;
    case 'md': return sol.green;
    default: return sol.base0;
  }
}
