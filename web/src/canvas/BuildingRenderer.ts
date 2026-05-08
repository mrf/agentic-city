/**
 * BuildingRenderer — isometric box rendering with language-tinted faces,
 * hidden back edges, and floating labels with backing plates.
 *
 * Draw order: footprint -> hidden back edges -> base outline ->
 *             side faces (language-tinted) -> roof -> label
 *
 * Buildings are sorted back-to-front by (gx + gy) for correct occlusion.
 */

import { IsometricCamera } from './IsometricCamera';
import type { Building } from '../store/cityStore';

const SD = {
  base01: '#3a4148',
  base00: '#525a62',
  base0: '#8a9097',
  base2: '#d8d6c8',
  blue: '#4a7a9c',
  cyan: '#4a8a8a',
  green: '#6a8a4a',
  yellow: '#a9923a',
  orange: '#b06a3a',
  red: '#a14a48',
  violet: '#6a6aa0',
  magenta: '#9c5070',
  blueDim: '#365a72',
  cyanDim: '#345e5e',
  greenDim: '#4a6638',
} as const;

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

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** Map building status to an accent color, or null for default/unknown. */
function statusToColor(status: string): string | null {
  if (status === 'err') return SD.red;
  if (status === 'warn') return SD.yellow;
  return null;
}

/** Draw all buildings sorted back-to-front for correct occlusion. */
export function drawBuildings(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  buildings: Building[],
  showLabels: boolean,
): void {
  const sorted = [...buildings].sort(
    (a, b) => (a.gx + a.gy) - (b.gx + b.gy),
  );

  for (const b of sorted) {
    drawBuilding(ctx, camera, b, showLabels);
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

  // Upper-right face (A -> B -> B2 -> A2) — brighter side
  ctx.fillStyle = `rgba(${tR},${tG},${tB},0.10)`;
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.lineTo(B[0], B[1]);
  ctx.lineTo(B2[0], B2[1]);
  ctx.lineTo(A2[0], A2[1]);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 0.85;
  ctx.stroke();

  // Lower-left face (A -> D -> D2 -> A2) — darker side
  ctx.fillStyle = `rgba(${tR},${tG},${tB},0.06)`;
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.lineTo(D[0], D[1]);
  ctx.lineTo(D2[0], D2[1]);
  ctx.lineTo(A2[0], A2[1]);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 0.85;
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

  // --- 6. Floating label with backing plate ---
  if (showLabels) {
    drawLabel(ctx, camera, b);
  }
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

function drawLabel(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  b: Building,
): void {
  const roofCenter = camera.project(
    b.gx + b.gw / 2,
    b.gy + b.gh / 2,
    b.gz,
  );

  ctx.font = '10px "JetBrains Mono", monospace';
  const textWidth = ctx.measureText(b.label).width;
  const padX = 4;
  const padY = 3;
  const plateW = textWidth + padX * 2;
  const plateH = 12 + padY;
  const plateX = roofCenter[0] - plateW / 2;
  const plateY = roofCenter[1] - 20 - plateH / 2;

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
  ctx.fillText(b.label, roofCenter[0], plateY + plateH / 2);
}
