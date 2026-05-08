import { useRef, useEffect, useCallback } from 'react';
import { CityRenderer } from './canvas/CityRenderer';
import { hitTestBuildings, hitTestAgents, nearestBuildingToScreen } from './canvas/HitTester';
import { useAnimationFrame } from './hooks/useAnimationFrame';
import { useCityKeyboard } from './hooks/useCityKeyboard';
import { useCityStore } from './store/cityStore';
import type { CityState } from './store/cityStore';
import { useUiStore } from './store/uiStore';
import { HudOverlay } from './hud/HudOverlay';
import { ScanlineOverlay } from './hud/ScanlineOverlay';
import { useSessionPersist } from './hooks/useSessionPersist';

/** Generate a small demo city for development. */
function makeDemoCity(): CityState {
  return {
    repoInfo: {
      name: 'agentic-city',
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
      { id: 'src/api/server.go', districtId: 'src/api', label: 'server.go', language: 'go', loc: 240, coverage: 0.32, status: 'err', editing: false, exports: 5, gx: 2, gy: 2, gw: 6, gh: 5, gz: 8 },
      { id: 'src/api/handlers.go', districtId: 'src/api', label: 'handlers.go', language: 'go', loc: 180, coverage: 0.61, status: 'warn', editing: true, exports: 8, gx: 10, gy: 2, gw: 5, gh: 4, gz: 6 },
      { id: 'src/api/schema.ts', districtId: 'src/api', label: 'schema.ts', language: 'ts', loc: 120, coverage: 0.72, status: 'ok', editing: false, exports: 3, gx: 2, gy: 8, gw: 4, gh: 4, gz: 4 },
      { id: 'src/canvas/renderer.ts', districtId: 'src/canvas', label: 'renderer.ts', language: 'ts', loc: 320, coverage: -1, status: 'unknown', editing: false, exports: 2, gx: 24, gy: 2, gw: 7, gh: 5, gz: 10 },
      { id: 'src/canvas/camera.ts', districtId: 'src/canvas', label: 'camera.ts', language: 'ts', loc: 90, coverage: -1, status: 'unknown', editing: false, exports: 1, gx: 24, gy: 8, gw: 4, gh: 4, gz: 3 },
      { id: 'src/store/city.ts', districtId: 'src/store', label: 'city.ts', language: 'ts', loc: 80, coverage: -1, status: 'unknown', editing: false, exports: 2, gx: 2, gy: 18, gw: 4, gh: 3, gz: 3 },
      { id: 'src/store/ui.ts', districtId: 'src/store', label: 'ui.ts', language: 'ts', loc: 60, coverage: -1, status: 'unknown', editing: false, exports: 2, gx: 8, gy: 18, gw: 3, gh: 3, gz: 2 },
      { id: 'internal/layout.go', districtId: 'internal', label: 'layout.go', language: 'go', loc: 400, coverage: 0.85, status: 'ok', editing: false, exports: 4, gx: 18, gy: 18, gw: 8, gh: 6, gz: 13 },
      { id: 'internal/scanner.go', districtId: 'internal', label: 'scanner.go', language: 'go', loc: 200, coverage: -1, status: 'unknown', editing: false, exports: 3, gx: 28, gy: 18, gw: 5, gh: 5, gz: 7 },
      { id: 'internal/tracker.py', districtId: 'internal', label: 'tracker.py', language: 'py', loc: 150, coverage: 0.45, status: 'warn', editing: false, exports: 2, gx: 18, gy: 26, gw: 5, gh: 3, gz: 5 },
    ],
    roads: [
      { fromId: 'src/canvas/renderer.ts', toId: 'src/canvas/camera.ts',  weight: 1, confidence: 'exact' },
      { fromId: 'src/api/handlers.go',    toId: 'src/api/server.go',     weight: 2, confidence: 'exact' },
      { fromId: 'src/api/server.go',      toId: 'internal/layout.go',   weight: 1, confidence: 'inferred' },
      { fromId: 'src/store/city.ts',      toId: 'src/api/schema.ts',     weight: 1, confidence: 'exact' },
      { fromId: 'src/store/ui.ts',        toId: 'src/store/city.ts',     weight: 1, confidence: 'exact' },
      { fromId: 'internal/scanner.go',    toId: 'internal/layout.go',   weight: 1, confidence: 'inferred' },
      { fromId: 'internal/tracker.py',    toId: 'internal/scanner.go',  weight: 1, confidence: 'weak' },
      { fromId: 'src/canvas/renderer.ts', toId: 'src/store/city.ts',    weight: 1, confidence: 'weak' },
    ],
    agents: [
      { id: 'ac-001', color: '#4a7a9c', mode: 'writing', task: 'refactor auth middleware', progress: 0.62, modelTier: 'opus', targetId: 'src/api/server.go', locationConfidence: 'exact' },
      { id: 'ac-002', color: '#6a8a4a', mode: 'thinking', task: 'fix coverage gap in scanner', progress: 0.15, modelTier: 'sonnet', targetId: 'internal/scanner.go', locationConfidence: 'inferred' },
      { id: 'ac-003', color: '#a9923a', mode: 'running', task: 'run test suite', progress: 0.80, modelTier: 'haiku', targetId: 'internal/layout.go', locationConfidence: 'exact' },
      { id: 'ac-004', color: '#9c5070', mode: 'waiting', task: 'waiting for CI', progress: 1.0, modelTier: 'sonnet', targetId: 'src/canvas/renderer.ts', locationConfidence: 'weak' },
      { id: 'ac-005', color: '#a14a48', mode: 'error', task: 'add OpenAPI schema', progress: 0.30, modelTier: 'haiku', targetId: 'src/api/schema.ts', locationConfidence: 'exact', errorMsg: 'typecheck failed' },
    ],
    activities: [
      { ts: new Date(Date.now() - 5000).toISOString(), who: 'ac-001', message: 'extracted AuthMiddleware into pkg/auth', color: '#4a7a9c', severity: 'success' },
      { ts: new Date(Date.now() - 12000).toISOString(), who: 'ac-003', message: 'all 142 tests pass', color: '#a9923a', severity: 'success' },
      { ts: new Date(Date.now() - 28000).toISOString(), who: 'ac-005', message: 'typecheck failed: missing type annotation', color: '#a14a48', severity: 'error' },
      { ts: new Date(Date.now() - 45000).toISOString(), who: 'ac-002', message: 'reading internal/scanner.go', color: '#6a8a4a', severity: 'info' },
      { ts: new Date(Date.now() - 90000).toISOString(), who: 'ac-001', message: 'created pkg/auth/middleware.go', color: '#4a7a9c', severity: 'info' },
      { ts: new Date(Date.now() - 120000).toISOString(), who: 'ac-004', message: 'pushed branch, waiting for CI', color: '#9c5070', severity: 'warn' },
    ],
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
  const showRoads = useUiStore((s) => s.showRoads);
  const cursorBuildingId = useUiStore((s) => s.cursorBuildingId);
  const selectedBuildingId = useUiStore((s) => s.selectedBuildingId);
  const setCursor = useUiStore((s) => s.setCursor);
  const selectBuilding = useUiStore((s) => s.selectBuilding);
  const setCamera = useUiStore((s) => s.setCamera);
  const setZoom = useUiStore((s) => s.setZoom);
  const setFocusedAgentIndex = useUiStore((s) => s.setFocusedAgentIndex);
  const setInspectedAgentId = useUiStore((s) => s.setInspectedAgentId);

  // Keyboard navigation: cursor, selection, camera, toggles
  useCityKeyboard(rendererRef);

  // Persist viewport and UI state to localStorage, restore on reload
  useSessionPersist(rendererRef);

  // Click handler: agents first (they render on top), then buildings.
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      // Check agents first — UFOs float above buildings
      const agentIdx = hitTestAgents(renderer.camera, city.agents, city.buildings, sx, sy);
      if (agentIdx !== null) {
        setFocusedAgentIndex(agentIdx);
        setInspectedAgentId(city.agents[agentIdx].id);
        return;
      }

      const hit = hitTestBuildings(renderer.camera, city.buildings, sx, sy);
      if (hit) {
        setFocusedAgentIndex(null);
        setInspectedAgentId(null);
        setCursor(hit.id);
        selectBuilding(hit.id);
      } else {
        const nearest = nearestBuildingToScreen(renderer.camera, city.buildings, sx, sy);
        if (nearest) setCursor(nearest.id);
      }
    },
    [city.agents, city.buildings, setCursor, selectBuilding, setFocusedAgentIndex, setInspectedAgentId],
  );

  // Initialize renderer and load demo data
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new CityRenderer(canvas);
    rendererRef.current = renderer;

    const resize = () => {
      renderer.resize(window.innerWidth, window.innerHeight);
      setCamera(renderer.camera.ox, renderer.camera.oy);
      setZoom(renderer.camera.scale);
    };
    resize();
    window.addEventListener('resize', resize);

    // Mouse wheel zoom — centers on cursor position
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      renderer.camera.zoomAt(delta * renderer.camera.scale, sx, sy);
      setZoom(renderer.camera.scale);
      setCamera(renderer.camera.ox, renderer.camera.oy);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // Load demo city
    setCity(makeDemoCity());

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [setCity, setCamera, setZoom]);

  // Push city state and UI flags into renderer when they change
  useEffect(() => {
    rendererRef.current?.setCity(city);
  }, [city]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.showLabels = showLabels;
    }
  }, [showLabels]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.showRoads = showRoads;
    }
  }, [showRoads]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.selectedBuildingId = selectedBuildingId;
    }
  }, [selectedBuildingId]);

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
    <>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
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
      <ScanlineOverlay />
      <HudOverlay />
    </>
  );
}
