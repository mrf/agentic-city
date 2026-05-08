/**
 * CityRenderer — main rAF render loop for the isometric city canvas.
 *
 * Owns the <canvas> element, draws the grid background, districts, and
 * buildings each frame using the IsometricCamera for projection.
 */

import { IsometricCamera } from './IsometricCamera';
import { drawDistricts } from './DistrictRenderer';
import type { CityState, Building } from '../store/cityStore';

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

const LANG_COLORS: Record<string, string> = {
  ts: SD.blue,
  tsx: SD.blue,
  js: SD.yellow,
  jsx: SD.yellow,
  go: SD.cyan,
  py: SD.green,
  rs: SD.orange,
  sql: SD.blueDim,
  md: SD.base00,
};

export class CityRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  camera: IsometricCamera;
  private city: CityState | null = null;

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
    drawDistricts(ctx, this.camera, this.city.districts);

    // 4. Buildings (back-to-front by gx+gy for occlusion)
    const sortedBuildings = [...this.city.buildings].sort(
      (a, b) => a.gx + a.gy - (b.gx + b.gy)
    );
    for (const b of sortedBuildings) {
      this.drawBuilding(b);
    }

    // 5. Vignette
    this.drawVignette(w, h);
  }

  private drawGrid(w: number, h: number): void {
    const { ctx } = this;

    const strokeGrid = (step: number, alpha: number): void => {
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
    };

    strokeGrid(12, 0.035); // Fine grid
    strokeGrid(60, 0.07);  // Coarse grid
  }

  private drawBuilding(b: Building): void {
    const { ctx } = this;
    const cam = this.camera;
    const color = LANG_COLORS[b.language] ?? SD.base00;

    // Four corners of the footprint on the ground plane
    const fl = cam.project(b.gx, b.gy);
    const fr = cam.project(b.gx + b.gw, b.gy);
    const br = cam.project(b.gx + b.gw, b.gy + b.gh);
    const bl = cam.project(b.gx, b.gy + b.gh);

    // Four corners of the roof
    const rl = cam.project(b.gx, b.gy, b.gz);
    const rr = cam.project(b.gx + b.gw, b.gy, b.gz);
    const rbr = cam.project(b.gx + b.gw, b.gy + b.gh, b.gz);
    const rbl = cam.project(b.gx, b.gy + b.gh, b.gz);

    // Right face
    ctx.fillStyle = this.darken(color, 0.6);
    ctx.beginPath();
    ctx.moveTo(fr[0], fr[1]);
    ctx.lineTo(br[0], br[1]);
    ctx.lineTo(rbr[0], rbr[1]);
    ctx.lineTo(rr[0], rr[1]);
    ctx.closePath();
    ctx.fill();

    // Left face
    ctx.fillStyle = this.darken(color, 0.4);
    ctx.beginPath();
    ctx.moveTo(bl[0], bl[1]);
    ctx.lineTo(br[0], br[1]);
    ctx.lineTo(rbr[0], rbr[1]);
    ctx.lineTo(rbl[0], rbl[1]);
    ctx.closePath();
    ctx.fill();

    // Roof
    ctx.fillStyle = this.darken(color, 0.8);
    ctx.beginPath();
    ctx.moveTo(rl[0], rl[1]);
    ctx.lineTo(rr[0], rr[1]);
    ctx.lineTo(rbr[0], rbr[1]);
    ctx.lineTo(rbl[0], rbl[1]);
    ctx.closePath();
    ctx.fill();

    // Wireframe edges
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    // Roof outline
    ctx.beginPath();
    ctx.moveTo(rl[0], rl[1]);
    ctx.lineTo(rr[0], rr[1]);
    ctx.lineTo(rbr[0], rbr[1]);
    ctx.lineTo(rbl[0], rbl[1]);
    ctx.closePath();
    ctx.stroke();

    // Visible vertical edges
    ctx.beginPath();
    ctx.moveTo(fr[0], fr[1]);
    ctx.lineTo(rr[0], rr[1]);
    ctx.moveTo(br[0], br[1]);
    ctx.lineTo(rbr[0], rbr[1]);
    ctx.moveTo(bl[0], bl[1]);
    ctx.lineTo(rbl[0], rbl[1]);
    ctx.stroke();

    // Visible base edges (front-right and front-left)
    ctx.beginPath();
    ctx.moveTo(fr[0], fr[1]);
    ctx.lineTo(br[0], br[1]);
    ctx.moveTo(bl[0], bl[1]);
    ctx.lineTo(br[0], br[1]);
    ctx.stroke();
  }

  private drawVignette(w: number, h: number): void {
    const { ctx } = this;
    const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.8);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  /** Darken a hex color by a factor (0 = black, 1 = original). */
  private darken(hex: string, factor: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
  }
}
