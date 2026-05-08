/**
 * CityRenderer — main rAF render loop for the isometric city canvas.
 *
 * Owns the <canvas> element, draws the grid background, districts, and
 * buildings each frame using the IsometricCamera for projection.
 */

import { IsometricCamera } from './IsometricCamera';
import { drawBuildings } from './BuildingRenderer';
import type { CityState, District } from '../store/cityStore';

// Solarized Dark palette (desaturated) from sd-helpers.jsx
const SD = {
  base03: '#0d1014',
  base02: '#161b21',
  base01: '#3a4148',
  base00: '#525a62',
  base0: '#8a9097',
  base1: '#9ea4ab',
  blue: '#4a7a9c',
  cyan: '#4a8a8a',
  green: '#6a8a4a',
  yellow: '#a9923a',
  orange: '#b06a3a',
  red: '#a14a48',
  blueDim: '#365a72',
  cyanDim: '#345e5e',
} as const;

export class CityRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  camera: IsometricCamera;
  private city: CityState | null = null;
  showLabels = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.camera = new IsometricCamera(canvas.width, canvas.height);
  }

  setCity(city: CityState): void {
    this.city = city;
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
    const sortedDistricts = [...this.city.districts].sort(
      (a, b) => a.gx + a.gy - (b.gx + b.gy)
    );
    for (const d of sortedDistricts) {
      this.drawDistrict(d);
    }

    // 4. Buildings (back-to-front by gx+gy for occlusion)
    drawBuildings(ctx, this.camera, this.city.buildings, this.showLabels);

    // 5. Vignette
    this.drawVignette(w, h);
  }

  private drawGrid(w: number, h: number): void {
    const { ctx } = this;

    // Fine grid (12px)
    ctx.strokeStyle = 'rgba(138,144,151,0.035)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x < w; x += 12) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y < h; y += 12) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Coarse grid (60px)
    ctx.strokeStyle = 'rgba(138,144,151,0.07)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x < w; x += 60) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y < h; y += 60) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  private drawDistrict(d: District): void {
    const { ctx } = this;
    const cam = this.camera;

    // Draw a dashed diamond outline for the district
    const tl = cam.project(d.gx, d.gy);
    const tr = cam.project(d.gx + d.gw, d.gy);
    const br = cam.project(d.gx + d.gw, d.gy + d.gh);
    const bl = cam.project(d.gx, d.gy + d.gh);

    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = SD.base01;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tl[0], tl[1]);
    ctx.lineTo(tr[0], tr[1]);
    ctx.lineTo(br[0], br[1]);
    ctx.lineTo(bl[0], bl[1]);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // District label
    const center = cam.project(d.gx + d.gw / 2, d.gy + d.gh / 2);
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = SD.base01;
    ctx.textAlign = 'center';
    ctx.fillText(d.label, center[0], center[1]);
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
