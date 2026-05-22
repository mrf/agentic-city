/**
 * CoverageHeatmapRenderer — district-level coverage color wash.
 *
 * Fills each district polygon with a semi-transparent color derived from
 * the district's aggregate coverage ratio (LOC-weighted average of children).
 *
 * Color ramp:
 *   green  ≥ 80%  covered
 *   yellow ≥ 50%  partially covered
 *   red    <  50%  poorly covered
 *   grey         unknown (coverage = -1)
 */

import type { IsometricCamera } from './IsometricCamera';
import type { District, DistrictBuilding } from '../store/cityStore';
import { sol } from '../theme/colors';

/** Alpha for the heatmap fill — semi-transparent over the scene. */
const HEATMAP_ALPHA = 0.28;

function coverageColor(coverage: number): string {
  if (coverage < 0) return sol.base01;
  if (coverage >= 0.8) return sol.green;
  if (coverage >= 0.5) return sol.yellow;
  return sol.red;
}

/**
 * Draw semi-transparent coverage color washes over all district polygons.
 * Must be called after drawDistricts() so outlines appear on top.
 */
export function drawCoverageHeatmap(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  districts: District[],
  districtBuildings: DistrictBuilding[],
): void {
  // Build a coverage lookup by district ID from the aggregated district buildings.
  const coverageById = new Map<string, number>();
  for (const db of districtBuildings) {
    coverageById.set(db.id, db.coverage);
  }

  const sorted = [...districts].sort((a, b) => a.gx + a.gy - (b.gx + b.gy));

  ctx.save();
  ctx.globalAlpha = HEATMAP_ALPHA;

  for (const d of sorted) {
    const coverage = coverageById.get(d.id) ?? -1;
    const color = coverageColor(coverage);

    const tl = camera.project(d.gx, d.gy);
    const tr = camera.project(d.gx + d.gw, d.gy);
    const br = camera.project(d.gx + d.gw, d.gy + d.gh);
    const bl = camera.project(d.gx, d.gy + d.gh);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tl[0], tl[1]);
    ctx.lineTo(tr[0], tr[1]);
    ctx.lineTo(br[0], br[1]);
    ctx.lineTo(bl[0], bl[1]);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}
