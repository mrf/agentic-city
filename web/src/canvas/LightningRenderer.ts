/**
 * LightningRenderer — jagged red lightning paths from the error origin
 * building to downstream affected dependencies, per sketch-D.
 *
 * Lightning is drawn when any building has status 'CRIT'. Paths run from
 * the CRIT building's roof center to each connected 'err' building's roof
 * center, with a random midpoint offset for the jagged effect.
 */

import type { IsometricCamera } from './IsometricCamera';
import type { Building, Road } from '../store/cityStore';
import { sol as SD } from '../theme/colors';

/** Seeded PRNG from building id pair — stable jag per connection. */
function stableJag(fromId: string, toId: string): [number, number] {
  let h = 5381;
  const combined = fromId + toId;
  for (let i = 0; i < combined.length; i++) {
    h = ((h * 33) ^ combined.charCodeAt(i)) >>> 0;
  }
  const x = ((h & 0xffff) / 0xffff - 0.5) * 16;
  const y = (((h >>> 16) & 0xffff) / 0xffff - 0.5) * 16;
  return [x, y];
}

/**
 * Draw jagged red lightning paths from CRIT building(s) to err buildings
 * that are connected via the dependency road graph. Blinks at 1.1s.
 */
export function drawLightningPaths(
  ctx: CanvasRenderingContext2D,
  camera: IsometricCamera,
  buildings: Building[],
  roads: Road[],
  time: number,
): void {
  // Only draw when alarm-state buildings exist
  const critBuildings = buildings.filter((b) => b.status === 'CRIT');
  if (critBuildings.length === 0) return;

  // Blink timing — visible half the cycle
  const phase = (time % 1100) / 1100;
  if (phase >= 0.5) return;

  const buildingMap = new Map(buildings.map((b) => [b.id, b]));

  // Find target buildings: directly connected via roads to a CRIT building,
  // or any err building for visual effect
  const errBuildings = buildings.filter(
    (b) => b.status === 'err' && !critBuildings.includes(b),
  );

  ctx.save();
  ctx.strokeStyle = SD.red;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const origin of critBuildings) {
    const from = camera.project(
      origin.gx + origin.gw / 2,
      origin.gy + origin.gh / 2,
      origin.gz,
    );

    // Draw to directly-connected buildings via roads
    const connectedIds = new Set<string>();
    for (const road of roads) {
      if (road.fromId === origin.id) connectedIds.add(road.toId);
      if (road.toId === origin.id) connectedIds.add(road.fromId);
    }

    // Also include all err buildings for visual drama
    for (const b of errBuildings) connectedIds.add(b.id);

    for (const targetId of connectedIds) {
      const target = buildingMap.get(targetId);
      if (!target) continue;

      const to = camera.project(
        target.gx + target.gw / 2,
        target.gy + target.gh / 2,
        target.gz,
      );

      const [jx, jy] = stableJag(origin.id, targetId);
      const mx = (from[0] + to[0]) / 2 + jx;
      const my = (from[1] + to[1]) / 2 + jy;

      // Glow layer (wider, dimmer)
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.moveTo(from[0], from[1]);
      ctx.lineTo(mx, my);
      ctx.lineTo(to[0], to[1]);
      ctx.stroke();

      // Core line (narrow, bright)
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(from[0], from[1]);
      ctx.lineTo(mx, my);
      ctx.lineTo(to[0], to[1]);
      ctx.stroke();
    }
  }

  ctx.restore();
}
