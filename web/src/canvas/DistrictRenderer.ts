/**
 * DistrictRenderer — dashed diamond outlines and labels for city districts.
 *
 * Districts are rendered as isometric diamonds on the ground plane,
 * drawn back-to-front by gx+gy to respect depth order.
 */

import type { IsometricCamera } from './IsometricCamera';
import type { District } from '../store/cityStore';
import { sol } from '../theme/colors';
import { FONT_FAMILY, FONT_SIZE } from '../theme/typography';

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
  ctx.strokeStyle = sol.base01;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tl[0], tl[1]);
  ctx.lineTo(tr[0], tr[1]);
  ctx.lineTo(br[0], br[1]);
  ctx.lineTo(bl[0], bl[1]);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // Label along the bottom edge (bl→br), angled to match the isometric surface
  const edgeAngle = Math.atan2(br[1] - bl[1], br[0] - bl[0]); // ≈ -30°
  const mx = (bl[0] + br[0]) / 2;
  const my = (bl[1] + br[1]) / 2;

  // Nudge the label 14px inward toward the district center to clear the dashed line
  const center = camera.project(d.gx + d.gw / 2, d.gy + d.gh / 2);
  const toCenter = [center[0] - mx, center[1] - my] as const;
  const dist = Math.hypot(toCenter[0], toCenter[1]);
  const inset = dist > 0 ? 14 / dist : 0;

  ctx.save();
  ctx.translate(mx + toCenter[0] * inset, my + toCenter[1] * inset);
  ctx.rotate(edgeAngle);
  ctx.font = `${FONT_SIZE.label}px ${FONT_FAMILY}`;
  ctx.fillStyle = sol.base01;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(d.label, 0, 0);
  ctx.restore();
}
