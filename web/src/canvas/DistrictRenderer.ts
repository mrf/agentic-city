/**
 * DistrictRenderer — dashed diamond outlines and labels for city districts.
 *
 * Districts are rendered as isometric diamonds on the ground plane,
 * drawn back-to-front by gx+gy to respect depth order.
 */

import type { IsometricCamera } from './IsometricCamera';
import type { District } from '../store/cityStore';

// Solarized Dark palette values used for district rendering
const BASE01 = '#3a4148';

export function drawDistricts(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  districts: District[],
): void {
  const sorted = [...districts].sort((a, b) => a.gx + a.gy - (b.gx + b.gy));
  for (const d of sorted) {
    drawDistrict(ctx, camera, d);
  }
}

function drawDistrict(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  d: District,
): void {
  const tl = camera.project(d.gx, d.gy);
  const tr = camera.project(d.gx + d.gw, d.gy);
  const br = camera.project(d.gx + d.gw, d.gy + d.gh);
  const bl = camera.project(d.gx, d.gy + d.gh);

  // Dashed diamond outline
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = BASE01;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tl[0], tl[1]);
  ctx.lineTo(tr[0], tr[1]);
  ctx.lineTo(br[0], br[1]);
  ctx.lineTo(bl[0], bl[1]);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // Label centered in the diamond
  const center = camera.project(d.gx + d.gw / 2, d.gy + d.gh / 2);
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.fillStyle = BASE01;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(d.label, center[0], center[1]);
}
