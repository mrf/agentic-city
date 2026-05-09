/** Isometric camera — projection math, pan, zoom, screen-to-grid conversion. */

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

export interface CameraState {
  ox: number; // screen-space origin x
  oy: number; // screen-space origin y
  scale: number;
}

const MIN_SCALE = 0.15;
const MAX_SCALE = 40.0;
const PAN_SPEED = 20; // pixels per key press

export class IsometricCamera {
  ox: number;
  oy: number;
  scale: number;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.ox = canvasWidth / 2;
    this.oy = canvasHeight / 3;
    this.scale = 1.0;
  }

  /** Project grid coords (gx, gy, gz) to screen [sx, sy]. */
  project(gx: number, gy: number, gz = 0): [number, number] {
    return [
      this.ox + (gx * COS30 + gy * COS30) * this.scale,
      this.oy + (gx * -SIN30 + gy * SIN30) * this.scale - gz * this.scale * 0.55,
    ];
  }

  /** Inverse project screen coords to grid (gz=0 plane). */
  unproject(sx: number, sy: number): [number, number] {
    const rx = (sx - this.ox) / this.scale;
    const ry = (sy - this.oy) / this.scale;
    // Solve the 2x2 system from project():
    //   rx = gx*COS30 + gy*COS30
    //   ry = gx*(-SIN30) + gy*SIN30
    const gx = (rx / COS30 + ry / SIN30) / 2;
    const gy = (rx / COS30 - ry / SIN30) / 2;
    return [gx, gy];
  }

  pan(dx: number, dy: number): void {
    this.ox += dx;
    this.oy += dy;
  }

  panByKey(key: 'up' | 'down' | 'left' | 'right'): void {
    const d = PAN_SPEED;
    switch (key) {
      case 'up':    this.oy += d; break;
      case 'down':  this.oy -= d; break;
      case 'left':  this.ox += d; break;
      case 'right': this.ox -= d; break;
    }
  }

  zoom(delta: number): void {
    this.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, this.scale + delta));
  }

  /** Zoom centered on a screen point (sx, sy) so that point stays fixed. */
  zoomAt(delta: number, sx: number, sy: number): void {
    const oldScale = this.scale;
    this.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, this.scale + delta));
    const ratio = this.scale / oldScale;
    this.ox = sx - (sx - this.ox) * ratio;
    this.oy = sy - (sy - this.oy) * ratio;
  }

  zoomIn(): void {
    this.zoom(0.1);
  }

  zoomOut(): void {
    this.zoom(-0.1);
  }

  resetZoom(): void {
    this.scale = 1.0;
  }

  resize(width: number, height: number): void {
    this.ox = width / 2;
    this.oy = height / 3;
  }

  getState(): CameraState {
    return { ox: this.ox, oy: this.oy, scale: this.scale };
  }
}
