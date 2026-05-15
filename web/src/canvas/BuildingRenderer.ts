/**
 * BuildingRenderer — isometric box rendering with language-tinted faces,
 * hidden back edges, floating labels, window dots, and edit rings.
 *
 * Draw order: footprint -> hidden back edges -> base outline ->
 *             side faces (language-tinted) -> roof -> window dots ->
 *             edit rings -> label
 *
 * Buildings are sorted back-to-front by (gx + gy) for correct occlusion.
 */

import { IsometricCamera } from './IsometricCamera';
import type { Building } from '../store/cityStore';
import { sol as SD } from '../theme/colors';
import { FONT_FAMILY, FONT_SIZE } from '../theme/typography';

const LANG_COLORS: Record<string, string> = {
  ts: SD.blue,
  tsx: SD.violet,
  js: SD.yellow,
  jsx: SD.yellow,
  go: SD.cyan,
  py: SD.green,
  rs: SD.orange,
  sql: SD.cyan,
  css: SD.magenta,
  md: SD.greenDim,
  spec: SD.yellow,
};

/** Stable hash of a string to a 32-bit unsigned int for seeded PRNG. */
function hashId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = ((h * 33) ^ id.charCodeAt(i)) >>> 0;
  }
  return h;
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** Map building status to an accent color, or null for default/unknown. */
function statusToColor(status: string): string | null {
  switch (status) {
    case 'err':
    case 'CRIT': return SD.red;
    case 'warn': return SD.yellow;
    default:     return null;
  }
}

/** True when a building is in an error/critical state that warrants alarm visuals. */
function isAlarmStatus(status: string): boolean {
  return status === 'err' || status === 'CRIT';
}

/** Draw all buildings sorted back-to-front for correct occlusion. */
export function drawBuildings(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  buildings: Building[],
  showLabels: boolean,
  time: number,
): void {
  const sorted = [...buildings].sort(
    (a, b) => (a.gx + a.gy) - (b.gx + b.gy),
  );

  for (const b of sorted) {
    drawBuilding(ctx, camera, b, showLabels, time);
  }
}

/**
 * Draw a single isometric building box.
 *
 * Corner naming (isometric view, viewer looking from upper-left):
 *   A = (gx, gy)           — near/front vertex (top of diamond)
 *   B = (gx+gw, gy)        — upper-right vertex
 *   C = (gx+gw, gy+gh)     — far/back vertex (bottom of diamond)
 *   D = (gx, gy+gh)        — lower-left vertex
 *
 * Visible side faces: A-B wall (upper-right) and A-D wall (lower-left).
 * Hidden back faces: B-C wall and D-C wall.
 */
function drawBuilding(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  b: Building,
  showLabels: boolean,
  time: number,
): void {
  const tint = LANG_COLORS[b.language] ?? SD.base00;
  const [tR, tG, tB] = hexToRgb(tint);

  // Ground-plane corners
  const A = camera.project(b.gx, b.gy);
  const B = camera.project(b.gx + b.gw, b.gy);
  const C = camera.project(b.gx + b.gw, b.gy + b.gh);
  const D = camera.project(b.gx, b.gy + b.gh);

  // Roof corners
  const A2 = camera.project(b.gx, b.gy, b.gz);
  const B2 = camera.project(b.gx + b.gw, b.gy, b.gz);
  const C2 = camera.project(b.gx + b.gw, b.gy + b.gh, b.gz);
  const D2 = camera.project(b.gx, b.gy + b.gh, b.gz);

  const strokeColor = statusToColor(b.status) ?? SD.base0;

  // --- 1. Footprint (very faint tint on ground) ---
  ctx.fillStyle = `rgba(${tR},${tG},${tB},0.05)`;
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.lineTo(B[0], B[1]);
  ctx.lineTo(C[0], C[1]);
  ctx.lineTo(D[0], D[1]);
  ctx.closePath();
  ctx.fill();

  // --- 2. Hidden back edges (dashed) ---
  ctx.save();
  ctx.setLineDash([2, 2]);
  ctx.strokeStyle = SD.base01;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  // B -> C base edge (hidden right-side base)
  ctx.moveTo(B[0], B[1]);
  ctx.lineTo(C[0], C[1]);
  // C -> C2 vertical edge (hidden far corner)
  ctx.lineTo(C2[0], C2[1]);
  ctx.stroke();
  // D -> C base edge (hidden left-side base)
  ctx.beginPath();
  ctx.moveTo(D[0], D[1]);
  ctx.lineTo(C[0], C[1]);
  ctx.stroke();
  ctx.restore();

  // --- 3. Base outline ---
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 0.85;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.lineTo(B[0], B[1]);
  ctx.lineTo(C[0], C[1]);
  ctx.lineTo(D[0], D[1]);
  ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 1;

  // --- 4. Side faces (language-tinted, semi-transparent) ---

  // Upper-right face (A -> B -> B2 -> A2) — outline only
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 0.85;
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.lineTo(B[0], B[1]);
  ctx.lineTo(B2[0], B2[1]);
  ctx.lineTo(A2[0], A2[1]);
  ctx.closePath();
  ctx.stroke();

  // Lower-left face (A -> D -> D2 -> A2) — outline only
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.lineTo(D[0], D[1]);
  ctx.lineTo(D2[0], D2[1]);
  ctx.lineTo(A2[0], A2[1]);
  ctx.closePath();
  ctx.stroke();

  // --- 5. Roof (A2 -> B2 -> C2 -> D2) ---
  ctx.fillStyle = `rgba(${tR},${tG},${tB},0.20)`;
  ctx.beginPath();
  ctx.moveTo(A2[0], A2[1]);
  ctx.lineTo(B2[0], B2[1]);
  ctx.lineTo(C2[0], C2[1]);
  ctx.lineTo(D2[0], D2[1]);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 0.95;
  ctx.stroke();

  // --- 6. Red flash fill for err/CRIT buildings ---
  if (isAlarmStatus(b.status)) {
    drawAlarmFlash(ctx, A, B, D, A2, B2, C2, D2, time);
  }

  // --- 7. Window dots (coverage pattern on roof) ---
  drawWindowDots(ctx, camera, b);

  // --- 8. Smoke/glitch lines on CRIT buildings ---
  if (b.status === 'CRIT') {
    const roofCenter = camera.project(b.gx + b.gw / 2, b.gy + b.gh / 2, b.gz);
    drawSmokeLines(ctx, roofCenter, time);
  }

  // --- 9. Edit pulse rings (animated, when editing=true) ---
  if (b.editing) {
    drawEditRings(ctx, camera, b, time);
  }

  // --- 10. Floating label with backing plate ---
  if (showLabels) {
    drawLabel(ctx, b, D2, b.status === 'CRIT');
  }
}

/** Bilinear interpolation within a quad defined by four screen-space corners. */
function bilerp(
  bl: [number, number], br: [number, number],
  tl: [number, number], tr: [number, number],
  u: number, v: number,
): [number, number] {
  return [
    bl[0] * (1 - u) * (1 - v) + br[0] * u * (1 - v) + tr[0] * u * v + tl[0] * (1 - u) * v,
    bl[1] * (1 - u) * (1 - v) + br[1] * u * (1 - v) + tr[1] * u * v + tl[1] * (1 - u) * v,
  ];
}

/**
 * Draw rectangular windows on the two visible side faces, representing coverage.
 * Lit windows = covered, dim windows = uncovered.
 * Coverage color: green >= 0.8, yellow >= 0.5, red < 0.5.
 * Skipped when coverage is unknown (< 0) or camera is zoomed out too far.
 */
function drawWindowDots(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  b: Building,
): void {
  if (b.coverage < 0) return;
  if (camera.scale < 0.5) return;
  if (b.gz < 2) return;

  let windowColor: string;
  if (b.coverage >= 0.8) windowColor = SD.green;
  else if (b.coverage >= 0.5) windowColor = SD.yellow;
  else windowColor = SD.red;

  // Face corners in screen space
  const A  = camera.project(b.gx, b.gy);
  const B  = camera.project(b.gx + b.gw, b.gy);
  const D  = camera.project(b.gx, b.gy + b.gh);
  const A2 = camera.project(b.gx, b.gy, b.gz);
  const B2 = camera.project(b.gx + b.gw, b.gy, b.gz);
  const D2 = camera.project(b.gx, b.gy + b.gh, b.gz);

  // Grid size per face
  const colsR = Math.min(Math.max(1, Math.floor(b.gw * 0.5)), 4);
  const colsL = Math.min(Math.max(1, Math.floor(b.gh * 0.5)), 4);
  const rows  = Math.min(Math.max(1, Math.floor(b.gz / 2.5)), 3);

  const total = (colsR + colsL) * rows;
  const litCount = Math.round(b.coverage * total);

  // Seeded LCG PRNG for stable window ordering per building
  let seed = hashId(b.id);
  const next = (): number => {
    seed = ((seed * 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  const order = Array.from({ length: total }, (_, i) => i);
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
  }
  const litSet = new Set(order.slice(0, litCount));

  const margin = 0.18;
  const winU = 0.35; // window width as fraction of cell
  const winV = 0.30; // window height as fraction of cell

  ctx.save();

  let idx = 0;

  // Draw windows on a face quad (bl→br = base edge, tl→tr = roof edge)
  function drawFace(
    bl: [number, number], br: [number, number],
    tl: [number, number], tr: [number, number],
    cols: number,
  ): void {
    const hu = winU / cols * (1 - 2 * margin) / 2;
    const hv = winV / rows * (1 - 2 * margin) / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const u = margin + (col + 0.5) / cols * (1 - 2 * margin);
        const v = margin + (row + 0.5) / rows * (1 - 2 * margin);

        const p0 = bilerp(bl, br, tl, tr, u - hu, v - hv);
        const p1 = bilerp(bl, br, tl, tr, u + hu, v - hv);
        const p2 = bilerp(bl, br, tl, tr, u + hu, v + hv);
        const p3 = bilerp(bl, br, tl, tr, u - hu, v + hv);

        if (litSet.has(idx)) {
          ctx.strokeStyle = windowColor;
          ctx.globalAlpha = 0.6;
        } else {
          ctx.strokeStyle = SD.base01;
          ctx.globalAlpha = 0.2;
        }
        ctx.lineWidth = Math.max(0.5, camera.scale * 0.6);

        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.lineTo(p3[0], p3[1]);
        ctx.closePath();
        ctx.stroke();

        idx++;
      }
    }
  }

  // Upper-right face (A→B base, A2→B2 roof)
  drawFace(A, B, A2, B2, colsR);
  // Lower-left face (A→D base, A2→D2 roof)
  drawFace(A, D, A2, D2, colsL);

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Draw animated concentric pulse rings on the roof when editing=true.
 * Three rings at staggered phases expand outward from the roof center,
 * fading as they grow (sonar-ping effect). Color: SD.yellow (edit mode).
 */
function drawEditRings(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  b: Building,
  time: number,
): void {
  const roofCx = camera.project(b.gx + b.gw / 2, b.gy + b.gh / 2, b.gz);
  const cx = roofCx[0];
  const cy = roofCx[1];

  const maxR = Math.max((b.gw + b.gh) * camera.scale * 0.28, 6);
  const period = 1800; // ms per cycle

  ctx.save();
  ctx.strokeStyle = SD.yellow;
  ctx.lineWidth = Math.max(0.8, camera.scale * 0.8);

  for (let i = 0; i < 3; i++) {
    const phase = ((time / period) + i / 3) % 1;
    const r = phase * maxR;
    const alpha = (1 - phase) * 0.65;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Draw a subtle cyan glow outline on mouse-hover. */
export function drawHoverHighlight(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  b: Building,
): void {
  const pad = 0.3;

  const A  = camera.project(b.gx - pad, b.gy - pad);
  const B  = camera.project(b.gx + b.gw + pad, b.gy - pad);
  const B2 = camera.project(b.gx + b.gw + pad, b.gy - pad, b.gz);
  const C2 = camera.project(b.gx + b.gw + pad, b.gy + b.gh + pad, b.gz);
  const D2 = camera.project(b.gx - pad, b.gy + b.gh + pad, b.gz);
  const D  = camera.project(b.gx - pad, b.gy + b.gh + pad);

  ctx.save();
  ctx.strokeStyle = SD.cyan;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.55;
  ctx.shadowColor = SD.cyan;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.lineTo(B[0], B[1]);
  ctx.lineTo(B2[0], B2[1]);
  ctx.lineTo(C2[0], C2[1]);
  ctx.lineTo(D2[0], D2[1]);
  ctx.lineTo(D[0], D[1]);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** Draw an amber dashed ring around the cursor building's visible silhouette. */
export function drawCursorHighlight(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  b: Building,
): void {
  const pad = 0.5;

  // Expanded silhouette: A→B (base) → B2→C2→D2 (roof) → D (base) → A
  const A  = camera.project(b.gx - pad, b.gy - pad);
  const B  = camera.project(b.gx + b.gw + pad, b.gy - pad);
  const B2 = camera.project(b.gx + b.gw + pad, b.gy - pad, b.gz);
  const C2 = camera.project(b.gx + b.gw + pad, b.gy + b.gh + pad, b.gz);
  const D2 = camera.project(b.gx - pad, b.gy + b.gh + pad, b.gz);
  const D  = camera.project(b.gx - pad, b.gy + b.gh + pad);

  ctx.save();
  ctx.setLineDash([5, 3]);
  ctx.strokeStyle = '#d4a017';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#d4a017';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.lineTo(B[0], B[1]);
  ctx.lineTo(B2[0], B2[1]);
  ctx.lineTo(C2[0], C2[1]);
  ctx.lineTo(D2[0], D2[1]);
  ctx.lineTo(D[0], D[1]);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a pulsing red flash fill over the two visible side faces and roof,
 * matching sketch-D's full-body red glow on err/CRIT buildings.
 */
function drawAlarmFlash(
  ctx: CanvasRenderingContext2D,
  A: [number, number], B: [number, number],
  D: [number, number],
  A2: [number, number], B2: [number, number],
  C2: [number, number], D2: [number, number],
  time: number,
): void {
  // Blink at ~1.1s: half the cycle at full alpha, half at low alpha
  const phase = (time % 1100) / 1100;
  const alpha = phase < 0.5 ? 0.55 : 0.20;

  const [rr, rg, rb] = hexToRgb(SD.red);

  ctx.save();

  // Upper-right face (A→B→B2→A2)
  ctx.fillStyle = `rgba(${rr},${rg},${rb},${alpha})`;
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.lineTo(B[0], B[1]);
  ctx.lineTo(B2[0], B2[1]);
  ctx.lineTo(A2[0], A2[1]);
  ctx.closePath();
  ctx.fill();

  // Lower-left face (A→D→D2→A2) — slightly dimmer
  ctx.fillStyle = `rgba(${rr},${rg},${rb},${alpha * 0.7})`;
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.lineTo(D[0], D[1]);
  ctx.lineTo(D2[0], D2[1]);
  ctx.lineTo(A2[0], A2[1]);
  ctx.closePath();
  ctx.fill();

  // Roof (A2→B2→C2→D2)
  ctx.fillStyle = `rgba(${rr},${rg},${rb},${alpha})`;
  ctx.beginPath();
  ctx.moveTo(A2[0], A2[1]);
  ctx.lineTo(B2[0], B2[1]);
  ctx.lineTo(C2[0], C2[1]);
  ctx.lineTo(D2[0], D2[1]);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Draw 3 jagged smoke/glitch lines rising from the building roof center,
 * matching sketch-D's CRIT smoke effect. Blinks at 1.1s interval.
 */
function drawSmokeLines(
  ctx: CanvasRenderingContext2D,
  roofCenter: [number, number],
  time: number,
): void {
  const phase = (time % 1100) / 1100;
  if (phase >= 0.5) return;

  const cx = roofCenter[0];
  const cy = roofCenter[1];

  ctx.save();
  ctx.strokeStyle = SD.red;
  ctx.lineWidth = 0.8;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.7;

  for (let k = 0; k < 3; k++) {
    const sx = cx + (k - 1) * 5;
    ctx.beginPath();
    ctx.moveTo(sx, cy - 4);
    ctx.lineTo(sx - 2, cy - 12);
    ctx.lineTo(sx + 1, cy - 22);
    ctx.lineTo(sx - 1, cy - 32);
    ctx.stroke();
  }

  ctx.restore();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  b: Building,
  bottomLeft: [number, number],
  isCrit = false,
): void {
  const displayLabel = isCrit ? `▲ ${b.label}` : b.label;
  ctx.font = `${isCrit ? 'bold ' : ''}${FONT_SIZE.label}px ${FONT_FAMILY}`;
  const textWidth = ctx.measureText(displayLabel).width;
  const padX = 4;
  const padY = 3;
  const plateW = textWidth + padX * 2;
  const plateH = 12 + padY;
  // Anchor right edge of plate to the bottom-left roof vertex (D2)
  const plateX = bottomLeft[0] - plateW;
  const plateY = bottomLeft[1] - plateH / 2;

  const statusColor = statusToColor(b.status);

  // Backing plate
  ctx.fillStyle = 'rgba(13,16,20,0.85)';
  ctx.fillRect(plateX, plateY, plateW, plateH);
  ctx.strokeStyle = statusColor ?? SD.base01;
  ctx.lineWidth = 0.4;
  ctx.strokeRect(plateX, plateY, plateW, plateH);

  // Text
  ctx.fillStyle = statusColor ?? SD.base2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(displayLabel, plateX + plateW / 2, plateY + plateH / 2);
}
