import { sol } from '../theme/colors';
import { FONT_FAMILY, FONT_SIZE } from '../theme/typography';

/** Solarized dark palette used across canvas and HUD. */
export { sol } from '../theme/colors';
export { FONT_FAMILY as FONT, FONT_SIZE } from '../theme/typography';

/** Height of the top bar in pixels. */
export const TOP_BAR_H = 32;

/** Height of the bottom strip in pixels. */
export const BOTTOM_STRIP_H = 28;

/** Common base styles shared across all HUD panels. */
export const hudBase = {
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZE.hud,
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

/** Map model tier to a display color. */
export function tierColor(tier: string | undefined): string {
  switch (tier) {
    case 'opus':   return sol.violet;
    case 'sonnet': return sol.blue;
    case 'haiku':  return sol.cyan;
    default:       return sol.base00;
  }
}

/** Map agent mode to a display color. */
export function modeColor(mode: string): string {
  switch (mode) {
    case 'thinking':  return sol.yellow;
    case 'writing':   return sol.green;
    case 'reading':   return sol.blue;
    case 'running':   return sol.orange;
    case 'waiting':   return sol.base00;
    case 'error':     return sol.red;
    case 'done':      return sol.cyan;
    default:          return sol.base0;
  }
}

/** Map event severity to a display color. */
export function severityColor(severity: string): string {
  switch (severity) {
    case 'error':   return sol.red;
    case 'warn':    return sol.yellow;
    case 'info':    return sol.blue;
    case 'success': return sol.green;
    case 'debug':   return sol.base00;
    default:        return sol.base0;
  }
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
