/**
 * OcclusionDetector — pure logic for finding which buildings occlude a focused building.
 *
 * A building B_front occludes B_back when:
 *   1. B_front has a strictly higher sort key (gx+gy) — it is drawn later / visually in front.
 *   2. B_front's grid footprint overlaps B_back's footprint — they share visual screen area.
 *
 * This is a conservative grid-space approximation. It detects the common case (footprint
 * overlap in top-down view) without requiring screen-space polygon intersection.
 */

import type { Building } from '../store/cityStore';

/**
 * Return the IDs of all buildings that visually occlude `focused`.
 * Used by the X-ray effect: when the keyboard cursor lands on a building that
 * is behind another building, the occluding buildings are faded so the user
 * can see the building they have focused.
 */
export function findOccluders(focused: Building, buildings: Building[]): Set<string> {
  const result = new Set<string>();
  const focusedKey = focused.gx + focused.gy;

  for (const b of buildings) {
    if (b.id === focused.id) continue;
    // Only consider buildings drawn after (in front of) the focused building.
    if (b.gx + b.gy <= focusedKey) continue;
    // Grid footprint overlap: both axes must overlap.
    const overlapX = b.gx < focused.gx + focused.gw && b.gx + b.gw > focused.gx;
    const overlapY = b.gy < focused.gy + focused.gh && b.gy + b.gh > focused.gy;
    if (overlapX && overlapY) {
      result.add(b.id);
    }
  }

  return result;
}

/**
 * Compute the passive occlusion map for the entire building set.
 *
 * Returns a Map from building ID → Set of occluder IDs, for every building
 * that has at least one building in front of it (higher gx+gy sort key) whose
 * footprint overlaps. Buildings with no occluders are absent from the map.
 *
 * Used by the always-on occlusion fade effect: back buildings ghost at reduced
 * opacity in the screen region covered by their occluders.
 */
export function findPassiveOccluders(buildings: Building[]): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();

  // Sort by painter key (gx+gy) so all potential occluders of buildings[i]
  // appear at indices j > i, eliminating redundant pair checks.
  const sorted = [...buildings].sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));

  for (let i = 0; i < sorted.length; i++) {
    const back = sorted[i];
    const backKey = back.gx + back.gy;

    for (let j = i + 1; j < sorted.length; j++) {
      const front = sorted[j];
      // Equal sort keys mean neither is definitively in front.
      if (front.gx + front.gy <= backKey) continue;
      // Grid footprint overlap: both axes must overlap.
      const overlapX = front.gx < back.gx + back.gw && front.gx + front.gw > back.gx;
      const overlapY = front.gy < back.gy + back.gh && front.gy + front.gh > back.gy;
      if (overlapX && overlapY) {
        let set = result.get(back.id);
        if (!set) {
          set = new Set<string>();
          result.set(back.id, set);
        }
        set.add(front.id);
      }
    }
  }

  return result;
}
