/**
 * Solarized dark palette (desaturated ~30%) — single source of truth.
 * Sourced from code-sim/project/sketches/sd-helpers.jsx.
 */
export const sol = {
  // Base tones
  base03:  '#0d1014', // deep bg
  base02:  '#161b21', // surface bg
  base01:  '#3a4148', // muted line
  base00:  '#525a62', // body line
  base0:   '#8a9097', // body fg
  base1:   '#9ea4ab', // emphasized fg
  base2:   '#d8d6c8',
  base3:   '#f0eada',

  // Accent colors (desaturated solarized)
  yellow:  '#a9923a',
  orange:  '#b06a3a',
  red:     '#a14a48',
  magenta: '#9c5070',
  violet:  '#6a6aa0',
  blue:    '#4a7a9c',
  cyan:    '#4a8a8a',
  green:   '#6a8a4a',

  // Dim variants (for line work)
  blueDim:  '#365a72',
  cyanDim:  '#345e5e',
  greenDim: '#4a6638',
} as const;
