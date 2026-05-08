/**
 * AgentRenderer — UFO rendering for agents in the isometric city view.
 *
 * Each agent is drawn as a classic flying saucer:
 *   disc  — flat ellipse (the saucer body)
 *   dome  — half-ellipse above disc centre (cockpit)
 *   ports — 4 porthole lights evenly spaced on the disc rim
 *
 * Visual encoding:
 *   color   — model family: blue=Claude, green=Codex, orange=Gemini
 *   scale   — tier: haiku=0.6×, sonnet=1.0×, opus=1.4×
 *   glow    — dome glow when mode='thinking'
 *   blink   — porthole blink when mode='error'
 *
 * Tractor beam (when agent.targetId is set and not flying):
 *   trapezoid  — wider at UFO, narrower at building impact
 *   scan lines — horizontal bands scrolling downward
 *   impact     — ellipse at building contact point
 *   confidence — 'exact'=solid, 'inferred'=dashed, 'weak'=dotted
 *
 * Flight (when agent.fromId + agent.toId + agent.flyProgress are set):
 *   cubic bezier arc between building roof centers in screen space
 */

import type { IsometricCamera } from './IsometricCamera';
import type { Agent, Building } from '../store/cityStore';
import { AnimationManager } from './AnimationManager';

// ── Palette ────────────────────────────────────────────────────────────────

const SD = {
  blue:   '#4a7a9c',
  green:  '#6a8a4a',
  orange: '#b06a3a',
  red:    '#a14a48',
  yellow: '#a9923a',
  base0:  '#8a9097',
  base01: '#3a4148',
} as const;

/** Map agent.color field → hex colour. */
function agentColor(color: string): string {
  if (color === 'blue')   return SD.blue;
  if (color === 'green')  return SD.green;
  if (color === 'orange') return SD.orange;
  return SD.base0;
}

/** Infer tier scale from agent id keywords. */
function tierScale(id: string): number {
  const lower = id.toLowerCase();
  if (lower.includes('haiku')) return 0.6;
  if (lower.includes('opus'))  return 1.4;
  return 1.0; // default = sonnet
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// ── UFO geometry ────────────────────────────────────────────────────────────

/** Disc + dome dimensions at scale=1, tier=1. */
const BASE = {
  discRx: 13,   // disc half-width
  discRy: 6,    // disc half-height (foreshortened for isometric look)
  domeRx: 10,   // dome half-width (slightly narrower than disc)
  domeH:  9,    // dome height above disc centre
  portR:  1.6,  // porthole radius
  portN:  4,    // porthole count
} as const;

const BEAM_TOP_HALF   = 9;  // half-width of beam at UFO end
const BEAM_BOTTOM_HALF = 3;  // half-width of beam at building end
const FLIGHT_ARC_H    = 80; // bezier arc height in screen pixels

// ── Main draw entry ─────────────────────────────────────────────────────────

export function drawAgents(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  agents: Agent[],
  buildings: Building[],
  time: number,
  animManager: AnimationManager,
): void {
  if (agents.length === 0) return;

  const buildMap = new Map<string, Building>(buildings.map((b) => [b.id, b]));

  ctx.save();

  for (const agent of agents) {
    if (agent.fromId && agent.toId && agent.flyProgress !== undefined) {
      drawFlyingAgent(ctx, camera, agent, buildMap, time, animManager);
    } else if (agent.targetId) {
      drawHoveringAgent(ctx, camera, agent, buildMap, time, animManager);
    }
    // Agents with no position data are not drawn
  }

  ctx.restore();
}

// ── Hovering agent (has targetId) ───────────────────────────────────────────

function drawHoveringAgent(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  agent: Agent,
  buildMap: Map<string, Building>,
  time: number,
  animManager: AnimationManager,
): void {
  const target = buildMap.get(agent.targetId!);
  if (!target) return;

  const cx = target.gx + target.gw / 2;
  const cy = target.gy + target.gh / 2;

  // Roof centre in screen space
  const roofPt = camera.project(cx, cy, target.gz);

  // UFO hovers a fixed screen-space distance above the roof
  const hoverY = roofPt[1] - 30 * Math.max(0.6, Math.min(1.5, camera.scale));
  const sx = roofPt[0];
  const sy = hoverY + animManager.getHoverBob(agent.id, time);

  // Draw tractor beam first (underneath UFO)
  drawTractorBeam(ctx, sx, sy, roofPt, agent, time);

  // Draw UFO disc + dome
  drawUFO(ctx, agent, sx, sy, camera.scale, time, animManager);
}

// ── Flying agent (fromId → toId along bezier) ───────────────────────────────

function drawFlyingAgent(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  agent: Agent,
  buildMap: Map<string, Building>,
  time: number,
  animManager: AnimationManager,
): void {
  const from = buildMap.get(agent.fromId!);
  const to   = buildMap.get(agent.toId!);
  if (!from || !to) return;

  const fromPt = camera.project(from.gx + from.gw / 2, from.gy + from.gh / 2, from.gz);
  const toPt   = camera.project(to.gx + to.gw / 2,   to.gy + to.gh / 2,   to.gz);

  // Cubic bezier control points — arc rises above both endpoints
  const p0: [number, number] = [fromPt[0], fromPt[1]];
  const p3: [number, number] = [toPt[0],   toPt[1]];
  const p1: [number, number] = [fromPt[0], fromPt[1] - FLIGHT_ARC_H];
  const p2: [number, number] = [toPt[0],   toPt[1]   - FLIGHT_ARC_H];

  const t = Math.max(0, Math.min(1, agent.flyProgress ?? 0));
  const [sx, sy] = AnimationManager.bezier(p0, p1, p2, p3, t);

  drawFlightPath(ctx, p0, p1, p2, p3, t, agentColor(agent.color));
  drawUFO(ctx, agent, sx, sy, camera.scale, time, animManager);
}

// ── UFO drawing ─────────────────────────────────────────────────────────────

function drawUFO(
  ctx: CanvasRenderingContext2D,
  agent: Agent,
  sx: number,
  sy: number,
  cameraScale: number,
  time: number,
  animManager: AnimationManager,
): void {
  const s = Math.max(0.5, Math.min(1.8, cameraScale)) * tierScale(agent.id);
  const col = agentColor(agent.color);
  const [r, g, b] = hexToRgb(col);

  const discRx = BASE.discRx * s;
  const discRy = BASE.discRy * s;
  const domeRx = BASE.domeRx * s;
  const domeH  = BASE.domeH  * s;

  // ── 1. Disc shadow ───────────────────────────────────────────────────────
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(sx, sy + discRy * 0.4, discRx * 0.9, discRy * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── 2. Dome glow (thinking state) ───────────────────────────────────────
  if (agent.mode === 'thinking') {
    const glowAlpha = AnimationManager.pulseAlpha(time) * 0.35;
    const grd = ctx.createRadialGradient(sx, sy - domeH * 0.5, 0, sx, sy - domeH * 0.5, domeRx * 1.5);
    grd.addColorStop(0,   `rgba(${r},${g},${b},${glowAlpha})`);
    grd.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.save();
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(sx, sy - domeH * 0.5, domeRx * 1.5, domeH * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── 3. Disc body ─────────────────────────────────────────────────────────
  ctx.save();
  const discFill = ctx.createLinearGradient(sx, sy - discRy, sx, sy + discRy);
  discFill.addColorStop(0,   `rgba(${r},${g},${b},0.60)`);
  discFill.addColorStop(0.5, `rgba(${r},${g},${b},0.40)`);
  discFill.addColorStop(1,   `rgba(${r},${g},${b},0.20)`);

  ctx.beginPath();
  ctx.ellipse(sx, sy, discRx, discRy, 0, 0, Math.PI * 2);
  ctx.fillStyle = discFill;
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(0.8, s * 0.9);
  ctx.globalAlpha = 0.9;
  ctx.stroke();
  ctx.restore();

  // ── 4. Dome ───────────────────────────────────────────────────────────────
  ctx.save();
  const domeFill = ctx.createLinearGradient(sx - domeRx, sy - domeH, sx + domeRx, sy);
  const domeAlpha = agent.mode === 'thinking' ? AnimationManager.pulseAlpha(time) : 0.55;
  domeFill.addColorStop(0,   `rgba(${r},${g},${b},${domeAlpha})`);
  domeFill.addColorStop(1,   `rgba(${r},${g},${b},0.15)`);

  ctx.beginPath();
  ctx.ellipse(sx, sy, domeRx, domeH, 0, Math.PI, 0); // upper half only
  ctx.fillStyle = domeFill;
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(0.7, s * 0.8);
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.restore();

  // ── 5. Portholes ─────────────────────────────────────────────────────────
  drawPortholes(ctx, agent, sx, sy, discRx, discRy, s, col, time, animManager);
}

function drawPortholes(
  ctx: CanvasRenderingContext2D,
  agent: Agent,
  sx: number,
  sy: number,
  discRx: number,
  discRy: number,
  s: number,
  col: string,
  time: number,
  animManager: AnimationManager,
): void {
  const spin  = animManager.getPortholeSpin(agent.id, time);
  const portR = BASE.portR * s;
  const isErr = agent.mode === 'error';
  const blinkA = isErr ? AnimationManager.blinkAlpha(time) : 0.9;
  const [r, g, b] = hexToRgb(col);

  ctx.save();
  for (let i = 0; i < BASE.portN; i++) {
    const angle = spin + (i / BASE.portN) * Math.PI * 2;
    // Portholes sit on the disc rim — scale x/y separately to follow ellipse edge
    const px = sx + Math.cos(angle) * discRx * 0.72;
    const py = sy + Math.sin(angle) * discRy * 0.72;

    ctx.globalAlpha = blinkA;
    ctx.fillStyle = isErr ? SD.red : `rgba(${r},${g},${b},0.95)`;
    ctx.beginPath();
    ctx.arc(px, py, portR, 0, Math.PI * 2);
    ctx.fill();

    // Porthole glint
    ctx.globalAlpha = blinkA * 0.5;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px - portR * 0.3, py - portR * 0.3, portR * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── Tractor beam ─────────────────────────────────────────────────────────────

function drawTractorBeam(
  ctx: CanvasRenderingContext2D,
  ufoSx: number,
  ufoSy: number,
  roofPt: [number, number],
  agent: Agent,
  time: number,
): void {
  const col = agentColor(agent.color);
  const [r, g, b] = hexToRgb(col);
  const confidence = agent.locationConfidence ?? 'weak';

  const bx = roofPt[0];
  const by = roofPt[1];
  const dy = by - ufoSy;
  const dx = bx - ufoSx;

  // Perpendicular direction (normalised) for beam width
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const perpX = -dy / len;
  const perpY =  dx / len;

  const topHalf = BEAM_TOP_HALF;
  const botHalf = BEAM_BOTTOM_HALF;

  // Four corners of the trapezoid
  const tlx = ufoSx + perpX * topHalf, tly = ufoSy + perpY * topHalf;
  const trx = ufoSx - perpX * topHalf, trY = ufoSy - perpY * topHalf;
  const blx = bx + perpX * botHalf,   bly = by + perpY * botHalf;
  const brx = bx - perpX * botHalf,   bry = by - perpY * botHalf;

  // ── Trapezoid fill ────────────────────────────────────────────────────────
  const beamGrd = ctx.createLinearGradient(ufoSx, ufoSy, bx, by);
  beamGrd.addColorStop(0, `rgba(${r},${g},${b},0.20)`);
  beamGrd.addColorStop(1, `rgba(${r},${g},${b},0.05)`);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(tlx, tly);
  ctx.lineTo(trx, trY);
  ctx.lineTo(brx, bry);
  ctx.lineTo(blx, bly);
  ctx.closePath();
  ctx.fillStyle = beamGrd;
  ctx.fill();

  // ── Trapezoid outline ─────────────────────────────────────────────────────
  const dashPattern = dashForConfidence(confidence);
  ctx.setLineDash(dashPattern);
  ctx.strokeStyle = `rgba(${r},${g},${b},0.55)`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // ── Scan lines ────────────────────────────────────────────────────────────
  const lineSpacing = 8;
  const scrollOffset = AnimationManager.scanOffset(time, lineSpacing);
  let scanAlpha = 0.10;
  if (confidence === 'exact') scanAlpha = 0.35;
  else if (confidence === 'inferred') scanAlpha = 0.20;

  ctx.save();
  // Clip to trapezoid so scan lines don't spill outside
  ctx.beginPath();
  ctx.moveTo(tlx, tly);
  ctx.lineTo(trx, trY);
  ctx.lineTo(brx, bry);
  ctx.lineTo(blx, bly);
  ctx.closePath();
  ctx.clip();

  ctx.strokeStyle = `rgba(${r},${g},${b},${scanAlpha})`;
  ctx.lineWidth = 0.8;
  ctx.setLineDash([]);

  const steps = Math.ceil(len / lineSpacing) + 2;
  for (let i = 0; i < steps; i++) {
    const frac = (i * lineSpacing + scrollOffset) / len;
    // Interpolate a line across the beam width at this fraction
    const lx1 = tlx + (blx - tlx) * frac;
    const ly1 = tly + (bly - tly) * frac;
    const lx2 = trx + (brx - trx) * frac;
    const ly2 = trY + (bry - trY) * frac;

    ctx.beginPath();
    ctx.moveTo(lx1, ly1);
    ctx.lineTo(lx2, ly2);
    ctx.stroke();
  }
  ctx.restore();

  // ── Impact ellipse ────────────────────────────────────────────────────────
  const impactAlpha = 0.25 + 0.15 * Math.sin(time * 0.004);
  ctx.save();
  ctx.globalAlpha = impactAlpha;
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.2;
  ctx.setLineDash(dashPattern);
  ctx.beginPath();
  ctx.ellipse(bx, by, botHalf * 2.5, botHalf * 1.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function dashForConfidence(confidence: string): number[] {
  if (confidence === 'exact')    return [];        // solid
  if (confidence === 'inferred') return [5, 3];    // dashed
  return [2, 5];                                   // dotted (weak)
}

// ── Flight path trail ────────────────────────────────────────────────────────

function drawFlightPath(
  ctx: CanvasRenderingContext2D,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  progress: number,
  col: string,
): void {
  // Draw the traversed portion of the arc as a faint dashed trail
  const steps = 32;
  const segments = Math.floor(progress * steps);
  if (segments < 1) return;

  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.25;
  ctx.setLineDash([4, 4]);

  ctx.beginPath();
  const [startX, startY] = AnimationManager.bezier(p0, p1, p2, p3, 0);
  ctx.moveTo(startX, startY);
  for (let i = 1; i <= segments; i++) {
    const t = i / steps;
    const [px, py] = AnimationManager.bezier(p0, p1, p2, p3, t);
    ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}
