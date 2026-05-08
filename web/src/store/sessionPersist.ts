import type { FocusZone } from './uiStore';

export interface SessionState {
  cameraOx: number;
  cameraOy: number;
  cameraScale: number;
  selectedBuildingId: string | null;
  focusZone: FocusZone;
  showRoads: boolean;
  showLabels: boolean;
  showMinimap: boolean;
}

function sessionKey(repoName: string): string {
  return `ac:session:${repoName}`;
}

export function loadSession(repoName: string): SessionState | null {
  try {
    const raw = localStorage.getItem(sessionKey(repoName));
    if (!raw) return null;
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

export function saveSession(repoName: string, state: SessionState): void {
  try {
    localStorage.setItem(sessionKey(repoName), JSON.stringify(state));
  } catch {
    // Ignore storage errors (private mode, quota exceeded)
  }
}
