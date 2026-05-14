/**
 * RoadRenderer — dashed dependency edges on the ground plane.
 *
 * Roads connect building footprint centers (gz=0). Confidence scoring
 * controls dash density and opacity. When a building is selected, edges
 * connected to it are highlighted (cyan=outgoing, blue=incoming); all
 * others are dimmed.
 */

import type { IsometricCamera } from './IsometricCamera';
import type { Building, Confidence, Road } from '../store/cityStore';
import { sol } from '../theme/colors';

// Per-confidence visual style. Dash arrays are pre-allocated to avoid
// per-road allocations in the rAF hot path.
const CONFIDENCE_STYLES: Record<Confidence, { dash: number[]; alpha: number; width: number }> = {
  exact:    { dash: [6, 3], alpha: 0.55, width: 1.2 },
  inferred: { dash: [4, 4], alpha: 0.35, width: 0.9 },
  weak:     { dash: [2, 6], alpha: 0.18, width: 0.7 },
};
const FALLBACK_STYLE = CONFIDENCE_STYLES.weak;

// Solarized Dark colours
const COLOR_DEFAULT  = sol.base00; // faint, no selection
const COLOR_OUTGOING = sol.cyan;   // selected building → other
const COLOR_INCOMING = sol.blue;   // other → selected building
const COLOR_DIM      = sol.base01; // unrelated edge while selection active

export function drawRoads(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  roads: Road[],
  buildings: Building[],
  selectedBuildingId: string | null,
): void {
  if (roads.length === 0) return;

  // Pre-compute screen-space ground-plane centers for all buildings.
  const centers = new Map<string, [number, number]>();
  for (const b of buildings) {
    centers.set(b.id, camera.project(b.gx + b.gw / 2, b.gy + b.gh / 2, 0));
  }

  const hasSelection = selectedBuildingId !== null;

  ctx.save();

  for (const road of roads) {
    const from = centers.get(road.fromId);
    const to   = centers.get(road.toId);
    if (!from || !to) continue;

    const style = CONFIDENCE_STYLES[road.confidence] ?? FALLBACK_STYLE;

    let color: string;
    let alpha: number;

    if (hasSelection) {
      if (road.fromId === selectedBuildingId) {
        color = COLOR_OUTGOING;
        alpha = 0.85;
      } else if (road.toId === selectedBuildingId) {
        color = COLOR_INCOMING;
        alpha = 0.85;
      } else {
        color = COLOR_DIM;
        alpha = style.alpha * 0.4;
      }
    } else {
      color = COLOR_DEFAULT;
      alpha = style.alpha;
    }

    ctx.setLineDash(style.dash);
    ctx.strokeStyle = color;
    ctx.lineWidth = style.width;
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
    ctx.stroke();
  }

  ctx.restore();
}
