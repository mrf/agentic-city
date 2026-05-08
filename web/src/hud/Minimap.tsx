/**
 * Minimap — reduced-scale city overview with agent positions and viewport rect.
 * Toggled by the M key via uiStore.showMinimap.
 */

import { useEffect, useRef } from 'react';
import { useCityStore } from '../store/cityStore';
import { useUiStore } from '../store/uiStore';
import { sol, FONT, BOTTOM_STRIP_H } from './palette';
import type { Building, Agent } from '../store/cityStore';

const W = 200;
const H = 140;
const PAD = 8;
const AGENT_R = 3;

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

function isoFlat(gx: number, gy: number): [number, number] {
  return [gx * COS30 + gy * COS30, gx * -SIN30 + gy * SIN30];
}

function buildingCorners(b: Building): [number, number][] {
  return [
    [b.gx, b.gy],
    [b.gx + b.gw, b.gy],
    [b.gx + b.gw, b.gy + b.gh],
    [b.gx, b.gy + b.gh],
  ];
}

function buildingCenter(b: Building): [number, number] {
  return [b.gx + b.gw / 2, b.gy + b.gh / 2];
}

function agentGridPos(
  agent: Agent,
  byId: Map<string, Building>,
): [number, number] | null {
  if (agent.mode === 'fly' && agent.fromId && agent.toId) {
    const from = byId.get(agent.fromId);
    const to = byId.get(agent.toId);
    if (!from || !to) return null;
    const t = agent.flyProgress ?? 0;
    const [fx, fy] = buildingCenter(from);
    const [tx, ty] = buildingCenter(to);
    return [fx + (tx - fx) * t, fy + (ty - fy) * t];
  }
  if (agent.targetId) {
    const b = byId.get(agent.targetId);
    if (b) return buildingCenter(b);
  }
  return null;
}

export function Minimap(): JSX.Element | null {
  const showMinimap = useUiStore((s) => s.showMinimap);
  if (!showMinimap) return null;
  return <MinimapCanvas />;
}

function MinimapCanvas(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buildings = useCityStore((s) => s.city.buildings);
  const agents = useCityStore((s) => s.city.agents);
  const zoom = useUiStore((s) => s.zoom);
  const cameraX = useUiStore((s) => s.cameraX);
  const cameraY = useUiStore((s) => s.cameraY);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = sol.base02;
    ctx.fillRect(0, 0, W, H);

    if (buildings.length === 0) {
      drawBorder(ctx);
      return;
    }

    // Compute iso bounding box of all building corners (gz ignored for flat overhead view)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const b of buildings) {
      for (const corner of buildingCorners(b)) {
        const [px, py] = isoFlat(corner[0], corner[1]);
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }

    const contentW = maxX - minX || 1;
    const contentH = maxY - minY || 1;
    const fitScale = Math.min((W - PAD * 2) / contentW, (H - PAD * 2) / contentH);
    const ox = PAD + ((W - PAD * 2) - contentW * fitScale) / 2 - minX * fitScale;
    const oy = PAD + ((H - PAD * 2) - contentH * fitScale) / 2 - minY * fitScale;

    function project(gx: number, gy: number): [number, number] {
      const [px, py] = isoFlat(gx, gy);
      return [ox + px * fitScale, oy + py * fitScale];
    }

    // Building footprints
    for (const b of buildings) {
      const corners = buildingCorners(b).map(([gx, gy]) => project(gx, gy));
      tracePoly(ctx, corners);
      ctx.fillStyle = sol.base01;
      ctx.fill();
    }

    // Agent dots
    const byId = new Map<string, Building>(buildings.map((b) => [b.id, b]));
    for (const agent of agents) {
      const pos = agentGridPos(agent, byId);
      if (!pos) continue;
      const [ax, ay] = project(pos[0], pos[1]);
      ctx.beginPath();
      ctx.arc(ax, ay, AGENT_R, 0, Math.PI * 2);
      ctx.fillStyle = agent.color || sol.cyan;
      ctx.fill();
    }

    // Viewport rectangle — unproject screen corners via main camera state
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    function unproject(sx: number, sy: number): [number, number] {
      const rx = (sx - cameraX) / zoom;
      const ry = (sy - cameraY) / zoom;
      // Invert: rx = gx*COS30 + gy*COS30, ry = gx*(-SIN30) + gy*SIN30
      const gx = (rx / COS30 + ry / SIN30) / 2;
      const gy = (rx / COS30 - ry / SIN30) / 2;
      return [gx, gy];
    }

    const screenCorners: [number, number][] = [
      [0, 0], [vw, 0], [vw, vh], [0, vh],
    ];
    const vpCorners = screenCorners.map(([sx, sy]) => {
      const [gx, gy] = unproject(sx, sy);
      return project(gx, gy);
    });

    ctx.save();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    tracePoly(ctx, vpCorners);
    ctx.strokeStyle = sol.base0;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Label
    ctx.fillStyle = sol.base00;
    ctx.font = `9px ${FONT}`;
    ctx.fillText('MINIMAP', 4, H - 4);

    drawBorder(ctx);
  }, [buildings, agents, zoom, cameraX, cameraY]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        bottom: BOTTOM_STRIP_H + 8,
        right: 8,
        zIndex: 80,
        opacity: 0.9,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    />
  );
}

function tracePoly(ctx: CanvasRenderingContext2D, pts: [number, number][]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function drawBorder(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = sol.base01;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
}
