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
import type { Building, DistrictBuilding } from '../store/cityStore';
import { sol as SD } from '../theme/colors';
import { FONT_FAMILY, FONT_SIZE } from '../theme/typography';

/**
 * Opacity applied to buildings that visually occlude the cursor/selected building.
 * Low enough to see through, high enough to still show structure.
 */
const OCCLUDER_ALPHA = 0.22;

/**
 * Opacity of the ghost drawn over an occluding building for the always-on depth fade.
 * The back building's geometry shows through at this alpha in the region it is hidden.
 */
const OCCLUSION_FADE_ALPHA = 0.7;

/** Module-level offscreen canvas reused across frames to composite faded buildings. */
let _offscreenEl: HTMLCanvasElement | null = null;

function getOffscreenCtx(width: number, height: number): CanvasRenderingContext2D {
  if (!_offscreenEl) {
    _offscreenEl = document.createElement('canvas');
  }
  if (_offscreenEl.width !== width || _offscreenEl.height !== height) {
    _offscreenEl.width = width;
    _offscreenEl.height = height;
  }
  const ctx = _offscreenEl.getContext('2d');
  if (!ctx) throw new Error('Offscreen canvas 2D context unavailable');
  return ctx;
}

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
  occluderIds: ReadonlySet<string> = new Set(),
): void {
  const sorted = [...buildings].sort(
    (a, b) => (a.gx + a.gy) - (b.gx + b.gy),
  );

  for (const b of sorted) {
    if (occluderIds.has(b.id)) {
      drawBuildingFaded(ctx, camera, b, showLabels, time);
    } else {
      drawBuilding(ctx, camera, b, showLabels, time);
    }
  }
}

/**
 * Draw a building at reduced opacity via an offscreen canvas composite.
 * Used for the X-ray effect: occluding buildings are faded so the user can see
 * the building they have focused with the keyboard cursor or selection.
 *
 * Building is drawn normally onto an offscreen canvas, then composited onto the
 * main canvas at OCCLUDER_ALPHA. This is necessary because drawBuilding() sets
 * globalAlpha internally — a plain ctx.globalAlpha wrapper would be overridden.
 */
function drawBuildingFaded(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  b: Building,
  showLabels: boolean,
  time: number,
): void {
  const { width, height } = ctx.canvas;
  const offCtx = getOffscreenCtx(width, height);

  // Clear physical pixels (identity transform, then restore DPI transform).
  offCtx.setTransform(1, 0, 0, 1, 0, 0);
  offCtx.clearRect(0, 0, width, height);

  // Match the main canvas DPI transform so projected coordinates align.
  const t = ctx.getTransform();
  offCtx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);

  drawBuilding(offCtx, camera, b, showLabels, time);

  // Composite at reduced opacity. Reset to identity transform so the offscreen
  // image (already rendered at physical-pixel resolution) is copied 1:1 without
  // being scaled again by the DPI transform on the main context.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = OCCLUDER_ALPHA;
  ctx.drawImage(_offscreenEl!, 0, 0);
  ctx.restore();
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
 * Hidden back faces: B-C wall and D-C wall (3D geometry).
 *
 * 2D silhouette edges (always solid): A→B, D→C, C→C2, D→A, and all roof/face edges.
 * Only B→C is truly hidden in the 2D projection and drawn dashed.
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

  // --- 2. Base outline — solid silhouette edges (A→B, C→D→A); B→C is hidden and drawn dashed below ---
  // D→C and C→C2 are on the 2D convex hull of the projected building and must be solid.
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 0.85;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.lineTo(B[0], B[1]);  // A→B: front edge of right face (visible boundary)
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(C[0], C[1]);
  ctx.lineTo(D[0], D[1]);  // C→D: lower silhouette edge
  ctx.lineTo(A[0], A[1]);  // D→A: left silhouette edge
  ctx.stroke();
  ctx.globalAlpha = 1;

  // --- 3. Hidden back base edge B→C (dashed) + right silhouette C→C2 (solid) ---
  // B→C lies inside the 2D projection hull — it is hidden behind the right face in 3D.
  // C→C2 is the rightmost vertical boundary of the building silhouette — a visible edge.
  ctx.save();
  ctx.setLineDash([2, 2]);
  ctx.strokeStyle = SD.base01;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(B[0], B[1]);
  ctx.lineTo(C[0], C[1]);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 0.85;
  ctx.beginPath();
  ctx.moveTo(C[0], C[1]);
  ctx.lineTo(C2[0], C2[1]);
  ctx.stroke();

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

/** Minimal shape needed for cursor highlight — shared by Building and DistrictBuilding. */
interface IsoBox { gx: number; gy: number; gw: number; gh: number; gz: number }

/** Draw an amber dashed ring around the cursor building's visible silhouette. */
export function drawCursorHighlight(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  b: IsoBox,
): void {
  const pad = 0.5;

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

// ---------------------------------------------------------------------------
// Occlusion fade overlay (always-on depth readability pass)
// ---------------------------------------------------------------------------

/**
 * Draw a building's geometry at the given alpha via an offscreen canvas composite.
 *
 * Used for the always-on occlusion ghost: the back building is redrawn at
 * OCCLUSION_FADE_ALPHA clipped to the occluder's silhouette region. Labels are
 * intentionally excluded — the issue spec states labels are unaffected by occlusion.
 *
 * The caller must have already called ctx.clip() to restrict drawing to the
 * desired region before invoking this function.
 */
function drawBuildingGhost(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  b: Building,
  time: number,
  alpha: number,
): void {
  const { width, height } = ctx.canvas;
  const offCtx = getOffscreenCtx(width, height);

  offCtx.setTransform(1, 0, 0, 1, 0, 0);
  offCtx.clearRect(0, 0, width, height);
  const t = ctx.getTransform();
  offCtx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);

  // Draw geometry without labels — labels are unaffected by occlusion fade.
  drawBuilding(offCtx, camera, b, false, time);

  // Composite at reduced opacity. The clip set by the caller limits the draw area.
  // Reset to identity transform so the offscreen image (already at physical-pixel
  // resolution) copies 1:1 without being scaled again by the DPI transform.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.drawImage(_offscreenEl!, 0, 0);
  ctx.restore();
}

/**
 * Second rendering pass for the always-on occlusion depth-fade effect.
 *
 * For each building that is partially hidden behind a foreground building
 * (higher painter-sort-key with overlapping footprint), draws that building's
 * geometry at OCCLUSION_FADE_ALPHA clipped to the occluder's visible silhouette.
 * This produces a ghost image of the back building in the region it is
 * geometrically occluded, giving depth-readability cues without altering the
 * front buildings.
 *
 * Must be called AFTER the main drawBuildings() pass so the ghost composites
 * on top of the already-drawn occluding buildings.
 *
 * Skips:
 *   - Selected/cursor buildings — the X-ray effect (occluderIds) handles those.
 *   - Buildings already in occluderIds — they are drawn at 0.22 by drawBuildings;
 *     stacking a 0.7 ghost would compound the fading incorrectly.
 *   - Buildings with no overlapping foreground neighbour (no-op).
 */
export function drawOcclusionFadeOverlay(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  buildings: Building[],
  selectedBuildingId: string | null,
  cursorBuildingId: string | null,
  occluderIds: ReadonlySet<string>,
  now: number,
): void {
  const sorted = [...buildings].sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));

  for (let i = 0; i < sorted.length; i++) {
    const back = sorted[i];
    const backKey = back.gx + back.gy;

    // Buildings already handled by the X-ray focus effect — skip.
    if (
      back.id === selectedBuildingId ||
      back.id === cursorBuildingId ||
      occluderIds.has(back.id)
    ) continue;

    // Find front buildings (strictly higher sort key) whose footprints overlap.
    const frontOccluders: Building[] = [];
    for (let j = i + 1; j < sorted.length; j++) {
      const front = sorted[j];
      if (front.gx + front.gy <= backKey) continue;
      const overlapX = front.gx < back.gx + back.gw && front.gx + front.gw > back.gx;
      const overlapY = front.gy < back.gy + back.gh && front.gy + front.gh > back.gy;
      if (overlapX && overlapY) {
        frontOccluders.push(front);
      }
    }

    if (frontOccluders.length === 0) continue;

    // Clip to the union of the occluders' visible silhouettes.
    // Silhouette polygon: A → B → B2 → C2 → D2 → D (the full visible outline of
    // each occluder, excluding the back faces that are never drawn).
    ctx.save();
    ctx.beginPath();
    for (const occ of frontOccluders) {
      const A  = camera.project(occ.gx, occ.gy);
      const B  = camera.project(occ.gx + occ.gw, occ.gy);
      const B2 = camera.project(occ.gx + occ.gw, occ.gy, occ.gz);
      const C2 = camera.project(occ.gx + occ.gw, occ.gy + occ.gh, occ.gz);
      const D2 = camera.project(occ.gx, occ.gy + occ.gh, occ.gz);
      const D  = camera.project(occ.gx, occ.gy + occ.gh);
      ctx.moveTo(A[0], A[1]);
      ctx.lineTo(B[0], B[1]);
      ctx.lineTo(B2[0], B2[1]);
      ctx.lineTo(C2[0], C2[1]);
      ctx.lineTo(D2[0], D2[1]);
      ctx.lineTo(D[0], D[1]);
      ctx.closePath();
    }
    ctx.clip();

    drawBuildingGhost(ctx, camera, back, now, OCCLUSION_FADE_ALPHA);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// L3 district-building rendering
// ---------------------------------------------------------------------------

/** Status → border color for district buildings (cyan=ok, yellow=warn, red=err). */
function districtStatusColor(status: string): string {
  switch (status) {
    case 'err': return SD.red;
    case 'warn': return SD.yellow;
    default:     return SD.cyan;
  }
}

/**
 * Draw all district-buildings sorted back-to-front.
 * Called by CityRenderer when lodLevel === 'L3'.
 */
export function drawDistrictBuildings(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  districts: DistrictBuilding[],
  showLabels: boolean,
  time: number,
): void {
  const sorted = [...districts].sort(
    (a, b) => (a.gx + a.gy) - (b.gx + b.gy),
  );
  for (const d of sorted) {
    drawDistrictBuilding(ctx, camera, d, showLabels, time);
  }
}

/**
 * Draw a single district-building.
 *
 * Compared to a file-building it uses:
 * - Status color for all outlines/tints (cyan=ok, yellow=warn, red=err)
 * - Hatched vertical lines on visible side faces instead of window dots
 * - Bold label with file-count badge
 * - Blinking status indicator dot for warn/err
 * - Red flash fill for err (reuses drawAlarmFlash)
 */
function drawDistrictBuilding(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  d: DistrictBuilding,
  showLabels: boolean,
  time: number,
): void {
  const borderColor = districtStatusColor(d.status);
  const [tR, tG, tB] = hexToRgb(borderColor);

  // Ground-plane corners
  const A = camera.project(d.gx, d.gy);
  const B = camera.project(d.gx + d.gw, d.gy);
  const C = camera.project(d.gx + d.gw, d.gy + d.gh);
  const D = camera.project(d.gx, d.gy + d.gh);

  // Roof corners
  const A2 = camera.project(d.gx, d.gy, d.gz);
  const B2 = camera.project(d.gx + d.gw, d.gy, d.gz);
  const C2 = camera.project(d.gx + d.gw, d.gy + d.gh, d.gz);
  const D2 = camera.project(d.gx, d.gy + d.gh, d.gz);

  // 1. Footprint tint
  ctx.fillStyle = `rgba(${tR},${tG},${tB},0.05)`;
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.lineTo(B[0], B[1]);
  ctx.lineTo(C[0], C[1]);
  ctx.lineTo(D[0], D[1]);
  ctx.closePath();
  ctx.fill();

  // 2. Base outline — solid silhouette edges (A→B, C→D→A); B→C is hidden and drawn dashed below.
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.lineTo(B[0], B[1]);  // A→B: front edge of right face (visible boundary)
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(C[0], C[1]);
  ctx.lineTo(D[0], D[1]);  // C→D: lower silhouette edge
  ctx.lineTo(A[0], A[1]);  // D→A: left silhouette edge
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 3. Hidden back base edge B→C (dashed) + right silhouette C→C2 (solid)
  ctx.save();
  ctx.setLineDash([2, 2]);
  ctx.strokeStyle = SD.base01;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(B[0], B[1]);
  ctx.lineTo(C[0], C[1]);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(C[0], C[1]);
  ctx.lineTo(C2[0], C2[1]);
  ctx.stroke();

  // 4. Side faces — outline only
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.lineTo(B[0], B[1]);
  ctx.lineTo(B2[0], B2[1]);
  ctx.lineTo(A2[0], A2[1]);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.lineTo(D[0], D[1]);
  ctx.lineTo(D2[0], D2[1]);
  ctx.lineTo(A2[0], A2[1]);
  ctx.closePath();
  ctx.stroke();

  // 5. Roof fill + outline
  ctx.fillStyle = `rgba(${tR},${tG},${tB},0.15)`;
  ctx.beginPath();
  ctx.moveTo(A2[0], A2[1]);
  ctx.lineTo(B2[0], B2[1]);
  ctx.lineTo(C2[0], C2[1]);
  ctx.lineTo(D2[0], D2[1]);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // 6. Red flash fill for err districts
  if (d.status === 'err') {
    drawAlarmFlash(ctx, A, B, D, A2, B2, C2, D2, time);
  }

  // 7. Hatched vertical lines on visible side faces (representing combined files)
  drawDistrictHatch(ctx, camera, d, borderColor);

  // 8. Status indicator dot — blinking for warn/err (sketch-C spec)
  if (d.status !== 'ok') {
    drawDistrictStatusDot(ctx, D2, borderColor, d.status, time);
  }

  // 9. Bold label with file count badge
  if (showLabels) {
    drawDistrictLabel(ctx, d, D2, borderColor);
  }
}

/**
 * Draw hatched vertical lines on the two visible side faces of a district-building.
 * Vertical lines at regular u-intervals represent the combined file-buildings within.
 * Sketch-C: "hatched windows pattern (representing combined buildings)".
 */
function drawDistrictHatch(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  d: DistrictBuilding,
  color: string,
): void {
  const A  = camera.project(d.gx, d.gy);
  const B  = camera.project(d.gx + d.gw, d.gy);
  const D  = camera.project(d.gx, d.gy + d.gh);
  const A2 = camera.project(d.gx, d.gy, d.gz);
  const B2 = camera.project(d.gx + d.gw, d.gy, d.gz);
  const D2 = camera.project(d.gx, d.gy + d.gh, d.gz);

  // Number of hatch lines proportional to district width/depth
  const stripesRight = Math.max(2, Math.floor(d.gw * 1.5));
  const stripesLeft  = Math.max(2, Math.floor(d.gh * 1.5));

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.4;
  ctx.globalAlpha = 0.3;

  // Upper-right face: bl=A, br=B, tl=A2, tr=B2
  for (let i = 1; i < stripesRight; i++) {
    const u = i / stripesRight;
    const bot = bilerp(A, B, A2, B2, u, 0);
    const top = bilerp(A, B, A2, B2, u, 1);
    ctx.beginPath();
    ctx.moveTo(bot[0], bot[1]);
    ctx.lineTo(top[0], top[1]);
    ctx.stroke();
  }

  // Lower-left face: bl=A, br=D, tl=A2, tr=D2
  for (let i = 1; i < stripesLeft; i++) {
    const u = i / stripesLeft;
    const bot = bilerp(A, D, A2, D2, u, 0);
    const top = bilerp(A, D, A2, D2, u, 1);
    ctx.beginPath();
    ctx.moveTo(bot[0], bot[1]);
    ctx.lineTo(top[0], top[1]);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw a blinking status indicator dot near the front-bottom corner of the district.
 * Blinking at ~1.1 s for err, slow pulse for warn.
 */
function drawDistrictStatusDot(
  ctx: CanvasRenderingContext2D,
  anchor: [number, number],
  color: string,
  status: string,
  time: number,
): void {
  // Offset the dot 8px right and 4px down from the D2 anchor
  const cx = anchor[0] + 8;
  const cy = anchor[1] + 4;
  const r = 2.5;

  let alpha: number;
  if (status === 'err') {
    const phase = (time % 1100) / 1100;
    alpha = phase < 0.5 ? 1.0 : 0.25;
  } else {
    // warn: slow pulse
    alpha = 0.55 + 0.45 * Math.sin((time / 900) * Math.PI * 2);
  }

  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a bold district label with a file-count badge.
 * Anchored to D2 (bottom-left roof vertex), same position as file-building labels.
 * Sketch-C: "District label in bold with file count badge".
 */
function drawDistrictLabel(
  ctx: CanvasRenderingContext2D,
  d: DistrictBuilding,
  bottomLeft: [number, number],
  color: string,
): void {
  const namePart  = d.label;
  const badgePart = ` ×${d.fileCount}`;

  ctx.font = `bold ${FONT_SIZE.label}px ${FONT_FAMILY}`;
  const nameW  = ctx.measureText(namePart).width;
  ctx.font = `${FONT_SIZE.label}px ${FONT_FAMILY}`;
  const badgeW = ctx.measureText(badgePart).width;

  const padX  = 4;
  const padY  = 3;
  const plateW = nameW + badgeW + padX * 2;
  const plateH = 12 + padY;
  const plateX = bottomLeft[0] - plateW;
  const plateY = bottomLeft[1] - plateH / 2;

  // Backing plate
  ctx.fillStyle = 'rgba(13,16,20,0.88)';
  ctx.fillRect(plateX, plateY, plateW, plateH);
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.6;
  ctx.strokeRect(plateX, plateY, plateW, plateH);

  const textY = plateY + plateH / 2;
  const textX = plateX + padX;

  // Bold district name
  ctx.font = `bold ${FONT_SIZE.label}px ${FONT_FAMILY}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(namePart, textX, textY);

  // Dimmer file count badge
  ctx.font = `${FONT_SIZE.label}px ${FONT_FAMILY}`;
  ctx.globalAlpha = 0.65;
  ctx.fillText(badgePart, textX + nameW, textY);
  ctx.globalAlpha = 1;
}
