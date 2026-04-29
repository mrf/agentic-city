// Solarized-dark (further desaturated) palette + helpers for Sketch A v2.

const SD = {
  // Solarized base, desaturated ~30%
  base03:  '#0d1014', // deep bg
  base02:  '#161b21', // surface bg
  base01:  '#3a4148', // muted line
  base00:  '#525a62', // body line
  base0:   '#8a9097', // body fg
  base1:   '#9ea4ab', // emphasized fg
  base2:   '#d8d6c8',
  base3:   '#f0eada',

  // Accents (desaturated solarized)
  yellow:  '#a9923a',
  orange:  '#b06a3a',
  red:     '#a14a48',
  magenta: '#9c5070',
  violet:  '#6a6aa0',
  blue:    '#4a7a9c',
  cyan:    '#4a8a8a',
  green:   '#6a8a4a',

  // even softer (for line work)
  blueDim:  '#365a72',
  cyanDim:  '#345e5e',
  greenDim: '#4a6638',

  mono: '"JetBrains Mono","IBM Plex Mono",monospace',
};

if (typeof document !== 'undefined' && !document.getElementById('sd-styles')) {
  const s = document.createElement('style');
  s.id = 'sd-styles';
  s.textContent = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');

.sd-paper { background: ${SD.base03}; color: ${SD.base0}; font-family: ${SD.mono}; }
.sd-paper::before {
  content:''; position:absolute; inset:0; pointer-events:none;
  background-image:
    linear-gradient(rgba(138,144,151,0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(138,144,151,0.035) 1px, transparent 1px),
    linear-gradient(rgba(138,144,151,0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(138,144,151,0.07) 1px, transparent 1px);
  background-size: 12px 12px, 12px 12px, 60px 60px, 60px 60px;
  z-index: 0;
}
.sd-paper::after {
  content:''; position:absolute; inset:0; pointer-events:none; z-index:1;
  background: radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%);
}
.sd-content { position: relative; z-index: 2; }

@keyframes sd-blink { 0%,49%{opacity:1} 50%,100%{opacity:.25} }
.sd-blink { animation: sd-blink 1.1s steps(1) infinite; }

@keyframes sd-pulse {
  0%,100% { opacity:.45; transform: scale(1); }
  50% { opacity:.95; transform: scale(1.08); }
}
.sd-pulse { animation: sd-pulse 1.6s ease-in-out infinite; transform-origin: center; }

@keyframes sd-beam {
  0%,100% { opacity:.35; }
  50% { opacity:.85; }
}
.sd-beam { animation: sd-beam 1.4s ease-in-out infinite; }

@keyframes sd-hover {
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}
.sd-ufo { /* hover removed — UFOs sit still */ }

/* Agent travel — dashed line drawing itself */
@keyframes sd-trail-draw {
  to { stroke-dashoffset: -200; }
}
.sd-trail { animation: sd-trail-draw 6s linear infinite; }

/* (sd-fly anims kept; rotation is killed via inline offset-rotate:0deg) */
@keyframes sd-fly-1 {
  0%   { offset-distance: 0%; }
  45%  { offset-distance: 100%; }
  55%  { offset-distance: 100%; }
  100% { offset-distance: 0%; }
}
@keyframes sd-fly-2 {
  0%   { offset-distance: 100%; }
  50%  { offset-distance: 0%; }
  100% { offset-distance: 100%; }
}

/* Subtle scanline */
@keyframes sd-scan { 0% { transform: translateY(-10%); } 100% { transform: translateY(110%); } }
.sd-scan {
  position:absolute; left:0; right:0; height:1px; pointer-events:none;
  background: linear-gradient(180deg, transparent, rgba(138,144,151,0.18), transparent);
  animation: sd-scan 14s linear infinite;
}

/* Code-edit pulse on building roof */
@keyframes sd-edit {
  0% { r: 1; opacity: .9; }
  100% { r: 9; opacity: 0; }
}
.sd-edit-ring { animation: sd-edit 1.4s ease-out infinite; transform-box: fill-box; }

/* Test ripple */
@keyframes sd-roof-tick { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
.sd-roof-tick { animation: sd-roof-tick 0.9s ease-in-out infinite; }
`;
  document.head.appendChild(s);
}

window.SD = SD;
