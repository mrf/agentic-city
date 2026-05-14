/**
 * Typography tokens — font family and sizes from sd-helpers.jsx and sketch-A-v2.jsx.
 */

/** Monospace font stack used throughout the UI and canvas labels. */
export const FONT_FAMILY = '"JetBrains Mono", "IBM Plex Mono", monospace';

/** Font sizes in pixels. */
export const FONT_SIZE = {
  /** Canvas building/district labels (sketch-A-v2, DistrictRenderer, BuildingRenderer). */
  label: 10,
  /** HUD panel text — top bar, rails, bottom strip. */
  hud: 11,
} as const;
