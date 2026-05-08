import type { CSSProperties } from 'react';

const SCANLINE_RGBA = `rgba(138,144,151,0.18)`;

const S: Record<string, CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
    zIndex: 50,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '1px',
    background: `linear-gradient(180deg, transparent, ${SCANLINE_RGBA}, transparent)`,
    animation: 'ac-scanline 14s linear infinite',
  },
};

/** Animated 1px scanline bar drifting top-to-bottom over the canvas. */
export function ScanlineOverlay(): JSX.Element {
  return (
    <>
      <style>{`
        @keyframes ac-scanline {
          0%   { transform: translateY(-10vh); }
          100% { transform: translateY(110vh); }
        }
      `}</style>
      <div style={S.container}>
        <div style={S.bar} />
      </div>
    </>
  );
}
