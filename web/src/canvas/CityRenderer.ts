/**
 * CityRenderer — main rAF render loop for the isometric city canvas.
 *
 * Owns the <canvas> element, draws the grid background, districts, and
 * buildings each frame using the IsometricCamera for projection.
 */

import { IsometricCamera } from './IsometricCamera';
import { drawDistricts } from './DistrictRenderer';
import { drawBuildings, drawCursorHighlight, drawHoverHighlight } from './BuildingRenderer';
import { drawRoads } from './RoadRenderer';
import { drawAgents } from './AgentRenderer';
import { drawLightningPaths } from './LightningRenderer';
import { AnimationManager } from './AnimationManager';
import type { CityState } from '../store/cityStore';
import { sol as SD } from '../theme/colors';

export class CityRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  camera: IsometricCamera;
  private city: CityState | null = null;
  private animManager = new AnimationManager();
  private hasFitted = false;
  showLabels = true;
  showRoads = false;
  cursorBuildingId: string | null = null;
  selectedBuildingId: string | null = null;
  hoveredBuildingId: string | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.camera = new IsometricCamera(canvas.width, canvas.height);
  }

  setCity(city: CityState): void {
    this.city = city;
    if (!this.hasFitted && (city.buildings.length > 0 || city.districts.length > 0)) {
      this.hasFitted = true;
      const dpr = window.devicePixelRatio || 1;
      this.fitCity(this.canvas.width / dpr, this.canvas.height / dpr);
    }
  }

  /**
   * Fit camera to show all buildings and districts in the given viewport.
   * Computes the grid bounding box and delegates to camera.fitToGridBounds().
   * No-ops on empty city.
   */
  fitCity(viewW: number, viewH: number): void {
    if (!this.city) return;
    const { buildings, districts } = this.city;

    let minGX = Infinity, minGY = Infinity;
    let maxGX = -Infinity, maxGY = -Infinity;
    let maxGZ = 0;

    for (const b of buildings) {
      minGX = Math.min(minGX, b.gx);
      minGY = Math.min(minGY, b.gy);
      maxGX = Math.max(maxGX, b.gx + b.gw);
      maxGY = Math.max(maxGY, b.gy + b.gh);
      maxGZ = Math.max(maxGZ, b.gz);
    }

    for (const d of districts) {
      minGX = Math.min(minGX, d.gx);
      minGY = Math.min(minGY, d.gy);
      maxGX = Math.max(maxGX, d.gx + d.gw);
      maxGY = Math.max(maxGY, d.gy + d.gh);
    }

    if (!isFinite(minGX)) return; // empty city

    this.camera.fitToGridBounds(minGX, minGY, maxGX, maxGY, maxGZ, viewW, viewH);
  }

  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera.resize(width, height);
  }

  /** Render one frame. Called from the rAF loop. */
  render(_dt: number): void {
    const { ctx } = this;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);

    // 1. Clear
    ctx.fillStyle = SD.base03;
    ctx.fillRect(0, 0, w, h);

    // 2. Grid background (matching .sd-paper::before)
    this.drawGrid(w, h);

    if (!this.city) return;

    // 3. District outlines (back-to-front by gx+gy)
    drawDistricts(ctx, this.camera, this.city.districts);

    // 3b. Roads (ground plane, drawn before buildings so they sit underneath)
    if (this.showRoads) {
      drawRoads(ctx, this.camera, this.city.roads, this.city.buildings, this.selectedBuildingId);
    }

    // 3c. Lightning paths from error origin to affected dependencies
    drawLightningPaths(ctx, this.camera, this.city.buildings, this.city.roads, performance.now());

    // 4. Buildings (back-to-front by gx+gy for occlusion)
    drawBuildings(ctx, this.camera, this.city.buildings, this.showLabels, performance.now());

    // 5. Agents — UFOs hover above or fly between buildings
    if (this.city.agents.length > 0) {
      drawAgents(ctx, this.camera, this.city.agents, this.city.buildings, performance.now(), this.animManager);
    }

    // 6. Hover highlight (subtle glow on mouseover)
    if (this.hoveredBuildingId && this.hoveredBuildingId !== this.cursorBuildingId) {
      const hoveredBuilding = this.city.buildings.find(
        (b) => b.id === this.hoveredBuildingId,
      );
      if (hoveredBuilding) {
        drawHoverHighlight(ctx, this.camera, hoveredBuilding);
      }
    }

    // 7. Cursor highlight (drawn after all buildings so it's never occluded)
    if (this.cursorBuildingId) {
      const cursorBuilding = this.city.buildings.find(
        (b) => b.id === this.cursorBuildingId,
      );
      if (cursorBuilding) {
        drawCursorHighlight(ctx, this.camera, cursorBuilding);
      }
    }

    // 8. Vignette
    this.drawVignette(w, h);
  }

  private drawGrid(w: number, h: number): void {
    const { ctx } = this;

    function strokeGrid(step: number, alpha: number): void {
      ctx.strokeStyle = `rgba(138,144,151,${alpha})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let x = 0; x < w; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = 0; y < h; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
    }

    strokeGrid(12, 0.035); // Fine grid
    strokeGrid(60, 0.07);  // Coarse grid
  }

  private drawVignette(w: number, h: number): void {
    const { ctx } = this;
    const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.8);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

}
