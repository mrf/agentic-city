import { useRef, useEffect } from 'react';
import { CityRenderer } from './canvas/CityRenderer';
import { useAnimationFrame } from './hooks/useAnimationFrame';
import { useCityKeyboard } from './hooks/useCityKeyboard';
import { useCityStore } from './store/cityStore';
import type { CityState } from './store/cityStore';
import { useUiStore } from './store/uiStore';

/** Generate a small demo city for development. */
function makeDemoCity(): CityState {
  return {
    repoInfo: {
      name: 'agent-city',
      branch: 'main',
      headCommit: 'abc1234',
      ciStatus: 'unknown',
    },
    districts: [
      { id: 'src/api', label: 'API/', parentId: '', gx: 0, gy: 0, gw: 20, gh: 14 },
      { id: 'src/canvas', label: 'CANVAS/', parentId: '', gx: 22, gy: 0, gw: 16, gh: 14 },
      { id: 'src/store', label: 'STORE/', parentId: '', gx: 0, gy: 16, gw: 14, gh: 10 },
      { id: 'internal', label: 'INTERNAL/', parentId: '', gx: 16, gy: 16, gw: 22, gh: 14 },
    ],
    buildings: [
      { id: 'src/api/server.go', districtId: 'src/api', label: 'server.go', language: 'go', loc: 240, coverage: -1, status: 'unknown', editing: false, exports: 5, gx: 2, gy: 2, gw: 6, gh: 5, gz: 8 },
      { id: 'src/api/handlers.go', districtId: 'src/api', label: 'handlers.go', language: 'go', loc: 180, coverage: -1, status: 'unknown', editing: false, exports: 8, gx: 10, gy: 2, gw: 5, gh: 4, gz: 6 },
      { id: 'src/api/schema.ts', districtId: 'src/api', label: 'schema.ts', language: 'ts', loc: 120, coverage: 0.72, status: 'ok', editing: false, exports: 3, gx: 2, gy: 8, gw: 4, gh: 4, gz: 4 },
      { id: 'src/canvas/renderer.ts', districtId: 'src/canvas', label: 'renderer.ts', language: 'ts', loc: 320, coverage: -1, status: 'unknown', editing: false, exports: 2, gx: 24, gy: 2, gw: 7, gh: 5, gz: 10 },
      { id: 'src/canvas/camera.ts', districtId: 'src/canvas', label: 'camera.ts', language: 'ts', loc: 90, coverage: -1, status: 'unknown', editing: false, exports: 1, gx: 24, gy: 8, gw: 4, gh: 4, gz: 3 },
      { id: 'src/store/city.ts', districtId: 'src/store', label: 'city.ts', language: 'ts', loc: 80, coverage: -1, status: 'unknown', editing: false, exports: 2, gx: 2, gy: 18, gw: 4, gh: 3, gz: 3 },
      { id: 'src/store/ui.ts', districtId: 'src/store', label: 'ui.ts', language: 'ts', loc: 60, coverage: -1, status: 'unknown', editing: false, exports: 2, gx: 8, gy: 18, gw: 3, gh: 3, gz: 2 },
      { id: 'internal/layout.go', districtId: 'internal', label: 'layout.go', language: 'go', loc: 400, coverage: 0.85, status: 'ok', editing: false, exports: 4, gx: 18, gy: 18, gw: 8, gh: 6, gz: 13 },
      { id: 'internal/scanner.go', districtId: 'internal', label: 'scanner.go', language: 'go', loc: 200, coverage: -1, status: 'unknown', editing: false, exports: 3, gx: 28, gy: 18, gw: 5, gh: 5, gz: 7 },
      { id: 'internal/tracker.py', districtId: 'internal', label: 'tracker.py', language: 'py', loc: 150, coverage: 0.45, status: 'warn', editing: false, exports: 2, gx: 18, gy: 26, gw: 5, gh: 3, gz: 5 },
    ],
    roads: [],
    agents: [],
    activities: [],
    stats: {
      fileCount: 10,
      totalLoc: 1840,
      coverage: -1,
      openPrs: 0,
      bugCount: 0,
      testsPassing: 0,
      testsTotal: 0,
    },
    ts: Date.now(),
  };
}

export function App(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CityRenderer | null>(null);
  const city = useCityStore((s) => s.city);
  const setCity = useCityStore((s) => s.setCity);
  const showLabels = useUiStore((s) => s.showLabels);
  const cursorBuildingId = useUiStore((s) => s.cursorBuildingId);

  // Keyboard navigation: cursor, selection, camera, toggles
  useCityKeyboard(rendererRef);

  // Initialize renderer and load demo data
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new CityRenderer(canvas);
    rendererRef.current = renderer;

    const resize = () => {
      renderer.resize(window.innerWidth, window.innerHeight);
    };
    resize();
    window.addEventListener('resize', resize);

    // Load demo city
    setCity(makeDemoCity());

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, [setCity]);

  // Push city state and UI flags into renderer when they change
  useEffect(() => {
    rendererRef.current?.setCity(city);
  }, [city]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.showLabels = showLabels;
    }
  }, [showLabels]);

  // Sync cursor building into renderer for highlight drawing
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.cursorBuildingId = cursorBuildingId;
    }
  }, [cursorBuildingId]);

  // rAF render loop
  useAnimationFrame((dt) => {
    rendererRef.current?.render(dt);
  });

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        cursor: 'default',
      }}
    />
  );
}
