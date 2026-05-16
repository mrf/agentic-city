/**
 * CityRenderer — main rAF render loop for the isometric city canvas.
 *
 * Owns the <canvas> element, draws the grid background, districts, and
 * buildings each frame using the IsometricCamera for projection.
 *
 * L2↔L3 LOD transitions are animated as 300 ms ease-in-out crossfades.
 * Both LOD layers are rendered to an offscreen canvas and composited at
 * complementary alphas so neither layer internally overrides globalAlpha.
 */

import { IsometricCamera } from './IsometricCamera';
import { drawDistricts } from './DistrictRenderer';
import {
  drawBuildings,
  drawDistrictBuildings,
  drawCursorHighlight,
  drawHoverHighlight,
} from './BuildingRenderer';
import { findOccluders } from './OcclusionDetector';
import { drawRoads } from './RoadRenderer';
import { drawAgents } from './AgentRenderer';
import { drawLightningPaths } from './LightningRenderer';
import { AnimationManager } from './AnimationManager';
import type { CityState, DistrictBuilding } from '../store/cityStore';
import { selectDistrictBuildings } from '../store/cityStore';
import type { LodLevel } from '../store/uiStore';
import { sol as SD } from '../theme/colors';

/** Duration of the L2↔L3 crossfade in milliseconds. */
const LOD_TRANSITION_MS = 300;

interface LodTransition {
  fromLevel: LodLevel;
  toLevel: LodLevel;
  startTime: number;
}

/** Smooth ease-in-out cubic: 0 → 1 as t goes 0 → 1. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class CityRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  camera: IsometricCamera;
  private city: CityState | null = null;
  private districtBuildings: DistrictBuilding[] = [];
  private animManager = new AnimationManager();
  private hasFitted = false;
  showLabels = true;
  showRoads = false;
  cursorBuildingId: string | null = null;
  cursorDistrictId: string | null = null;
  selectedBuildingId: string | null = null;
  hoveredBuildingId: string | null = null;

  // LOD transition state — backing field + animated crossfade.
  private _lodLevel: LodLevel = 'L2';
  private _lodTransition: LodTransition | null = null;
  /** Offscreen canvas used to composite each LOD layer at partial alpha. */
  private _transOffscreen: HTMLCanvasElement | null = null;

  get lodLevel(): LodLevel { return this._lodLevel; }
  set lodLevel(next: LodLevel) {
    if (next !== this._lodLevel) {
      this._lodTransition = {
        fromLevel: this._lodLevel,
        toLevel: next,
        startTime: performance.now(),
      };
      this._lodLevel = next;
    }
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.camera = new IsometricCamera(canvas.width, canvas.height);
  }

  setCity(city: CityState): void {
    this.city = city;
    this.districtBuildings = selectDistrictBuildings(city.districts, city.buildings, city.agents);
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
    const now = performance.now();
    drawLightningPaths(ctx, this.camera, this.city.buildings, this.city.roads, now);

    // --- Compute LOD transition progress ---
    // transitioning = true during the 300 ms crossfade window.
    // fromAlpha fades 1→0, toAlpha fades 0→1.
    let transitioning = false;
    let fromLevel: LodLevel = this._lodLevel;
    let toLevel: LodLevel = this._lodLevel;
    let fromAlpha = 0;
    let toAlpha = 1;

    if (this._lodTransition) {
      const raw = Math.min(1, (now - this._lodTransition.startTime) / LOD_TRANSITION_MS);
      if (raw >= 1) {
        this._lodTransition = null;
      } else {
        transitioning = true;
        fromLevel = this._lodTransition.fromLevel;
        toLevel   = this._lodTransition.toLevel;
        const t   = easeInOutCubic(raw);
        fromAlpha = 1 - t;
        toAlpha   = t;
      }
    }

    // 4. Buildings — crossfade during transition, normal single-pass otherwise.
    //    L2 occluder X-ray is computed once and reused for both passes when
    //    fromLevel or toLevel is L2.
    const occluderIds = this.computeOccluderIds();

    if (transitioning) {
      this.compositeOffscreen(fromAlpha, (off) => this.drawBuildingLayer(off, fromLevel, occluderIds, now));
      this.compositeOffscreen(toAlpha,   (off) => this.drawBuildingLayer(off, toLevel, occluderIds, now));
    } else if (this._lodLevel === 'L3') {
      drawDistrictBuildings(ctx, this.camera, this.districtBuildings, this.showLabels, now);
    } else {
      drawBuildings(ctx, this.camera, this.city.buildings, this.showLabels, now, occluderIds);
    }

    // 5. Agents — UFOs hover above or fly between buildings (all LOD levels).
    //    During LOD transition, agents crossfade between their L2 and L3 positions.
    if (this.city.agents.length > 0) {
      if (transitioning) {
        this.compositeOffscreen(fromAlpha, (off) => {
          drawAgents(off, this.camera, this.city!.agents, this.city!.buildings, now, this.animManager, fromLevel, this.districtBuildings);
        });
        this.compositeOffscreen(toAlpha, (off) => {
          drawAgents(off, this.camera, this.city!.agents, this.city!.buildings, now, this.animManager, toLevel, this.districtBuildings);
        });
      } else {
        drawAgents(
          ctx, this.camera, this.city.agents, this.city.buildings,
          now, this.animManager, this._lodLevel, this.districtBuildings,
        );
      }
    }

    // 6. Hover highlight — suppressed during transition to avoid visual confusion.
    if (!transitioning && this._lodLevel !== 'L3'
        && this.hoveredBuildingId && this.hoveredBuildingId !== this.cursorBuildingId) {
      const hoveredBuilding = this.city.buildings.find(
        (b) => b.id === this.hoveredBuildingId,
      );
      if (hoveredBuilding) {
        drawHoverHighlight(ctx, this.camera, hoveredBuilding);
      }
    }

    // 7. Cursor highlight — suppressed during transition; snaps to new LOD when done.
    if (!transitioning) {
      if (this._lodLevel === 'L3') {
        const target = this.cursorDistrictId
          ? this.districtBuildings.find((d) => d.id === this.cursorDistrictId)
          : undefined;
        if (target) drawCursorHighlight(ctx, this.camera, target);
      } else {
        const target = this.cursorBuildingId
          ? this.city.buildings.find((b) => b.id === this.cursorBuildingId)
          : undefined;
        if (target) drawCursorHighlight(ctx, this.camera, target);
      }
    }

    // 8. Vignette
    this.drawVignette(w, h);
  }

  /**
   * Draw into the offscreen buffer via `drawFn`, then composite the result
   * onto the main canvas at the given `alpha`. This avoids globalAlpha
   * conflicts with per-draw-call alpha operations inside renderers.
   */
  private compositeOffscreen(alpha: number, drawFn: (ctx: CanvasRenderingContext2D) => void): void {
    const dpr = window.devicePixelRatio || 1;
    const offCtx = this.getTransitionCtx();

    offCtx.setTransform(1, 0, 0, 1, 0, 0);
    offCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawFn(offCtx);

    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(this._transOffscreen!, 0, 0);
    this.ctx.restore();
  }

  /** Draw the building/district layer for the given LOD level onto the provided context. */
  private drawBuildingLayer(
    ctx: CanvasRenderingContext2D,
    level: LodLevel,
    occluderIds: ReadonlySet<string>,
    now: number,
  ): void {
    if (!this.city) return;
    if (level === 'L3') {
      drawDistrictBuildings(ctx, this.camera, this.districtBuildings, this.showLabels, now);
    } else {
      drawBuildings(ctx, this.camera, this.city.buildings, this.showLabels, now, occluderIds);
    }
  }

  /** Return (and size-match) the shared offscreen canvas context. */
  private getTransitionCtx(): CanvasRenderingContext2D {
    const { width, height } = this.canvas;
    if (!this._transOffscreen) {
      this._transOffscreen = document.createElement('canvas');
    }
    if (this._transOffscreen.width !== width || this._transOffscreen.height !== height) {
      this._transOffscreen.width  = width;
      this._transOffscreen.height = height;
    }
    const off = this._transOffscreen.getContext('2d');
    if (!off) throw new Error('LOD transition offscreen canvas unavailable');
    return off;
  }

  /**
   * Compute the set of building IDs that occlude the cursor or selected building.
   * These buildings will be rendered faded (X-ray effect) so the focused building
   * is visible even when it is behind a taller or larger neighbour.
   */
  private computeOccluderIds(): Set<string> {
    if (!this.city) return new Set();
    const { buildings } = this.city;
    const result = new Set<string>();

    const addOccludersFor = (focusId: string): void => {
      const focused = buildings.find((b) => b.id === focusId);
      if (!focused) return;
      for (const id of findOccluders(focused, buildings)) {
        result.add(id);
      }
    };

    if (this.cursorBuildingId) addOccludersFor(this.cursorBuildingId);
    if (this.selectedBuildingId && this.selectedBuildingId !== this.cursorBuildingId) {
      addOccludersFor(this.selectedBuildingId);
    }

    return result;
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
