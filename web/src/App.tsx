import { useRef, useEffect, useCallback, useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { CityRenderer } from './canvas/CityRenderer';
import { hitTestBuildings, hitTestAgents, nearestBuildingToScreen } from './canvas/HitTester';
import { useAnimationFrame } from './hooks/useAnimationFrame';
import { useCityKeyboard } from './hooks/useCityKeyboard';
import { useCityStore } from './store/cityStore';
import { useUiStore } from './store/uiStore';
import { startWs, stopWs } from './store/wsMiddleware';
import { HudOverlay } from './hud/HudOverlay';
import { ScanlineOverlay } from './hud/ScanlineOverlay';
import { useSessionPersist } from './hooks/useSessionPersist';
import { sol } from './theme/colors';

/** Minimum pixel movement before a mousedown is considered a drag (not a click). */
const DRAG_THRESHOLD = 4;

export function App(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CityRenderer | null>(null);
  const dragRef = useRef<{ active: boolean; hasDragged: boolean; startX: number; startY: number } | null>(null);
  const city = useCityStore((s) => s.city);
  const showLabels = useUiStore((s) => s.showLabels);
  const showRoads = useUiStore((s) => s.showRoads);
  const lodLevel = useUiStore((s) => s.lodLevel);
  const cursorBuildingId = useUiStore((s) => s.cursorBuildingId);
  const cursorDistrictId = useUiStore((s) => s.cursorDistrictId);
  const selectedBuildingId = useUiStore((s) => s.selectedBuildingId);
  const setCursor = useUiStore((s) => s.setCursor);
  const selectBuilding = useUiStore((s) => s.selectBuilding);
  const setCamera = useUiStore((s) => s.setCamera);
  const setZoom = useUiStore((s) => s.setZoom);
  const setFocusedAgentIndex = useUiStore((s) => s.setFocusedAgentIndex);
  const setInspectedAgentId = useUiStore((s) => s.setInspectedAgentId);
  const [canvasCursor, setCanvasCursor] = useState<string>('default');
  const [canvasFocused, setCanvasFocused] = useState<boolean>(false);

  // Mousemove: update pointer cursor and hover highlight
  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const agentIdx = hitTestAgents(renderer.camera, city.agents, city.buildings, sx, sy);
      if (agentIdx !== null) {
        setCanvasCursor('pointer');
        renderer.hoveredBuildingId = null;
        return;
      }

      const hit = hitTestBuildings(renderer.camera, city.buildings, sx, sy);
      if (hit) {
        setCanvasCursor('pointer');
        renderer.hoveredBuildingId = hit.id;
      } else {
        setCanvasCursor('default');
        renderer.hoveredBuildingId = null;
      }
    },
    [city.agents, city.buildings],
  );

  // WebSocket connection lifecycle — connect on mount, disconnect on unmount
  useWebSocket();

  // Keyboard navigation: cursor, selection, camera, toggles
  useCityKeyboard(rendererRef);

  // Persist viewport and UI state to localStorage, restore on reload
  useSessionPersist(rendererRef);

  // Focus and blur handlers for keyboard navigation indicator
  const handleCanvasFocus = () => setCanvasFocused(true);
  const handleCanvasBlur = () => setCanvasFocused(false);

  // Click handler: agents first (they render on top), then buildings.
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Suppress click if the mouse moved enough to count as a drag
      if (dragRef.current?.hasDragged) return;

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

  // Initialize renderer and connect to live backend
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

    // Mouse drag-to-pan
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      dragRef.current = { active: true, hasDragged: false, startX: e.clientX, startY: e.clientY };
      canvas.style.cursor = 'grab';
    };

    const onMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag?.active) return;
      const netDist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
      if (!drag.hasDragged && netDist < DRAG_THRESHOLD) return;
      drag.hasDragged = true;
      canvas.style.cursor = 'grabbing';
      renderer.camera.pan(e.movementX, e.movementY);
      setCamera(renderer.camera.ox, renderer.camera.oy);
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (dragRef.current) dragRef.current.active = false;
      canvas.style.cursor = 'default';
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Connect to live backend via WebSocket
    startWs();

    return () => {
      stopWs();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [setCamera, setZoom]);

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
      rendererRef.current.lodLevel = lodLevel;
    }
  }, [lodLevel]);

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

  // Sync cursor district into renderer for L3 highlight drawing
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.cursorDistrictId = cursorDistrictId;
    }
  }, [cursorDistrictId]);

  // rAF render loop
  useAnimationFrame((dt) => {
    rendererRef.current?.render(dt);
  });

  return (
    <>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        onFocus={handleCanvasFocus}
        onBlur={handleCanvasBlur}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        style={{
          display: 'block',
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          cursor: canvasCursor,
          outline: canvasFocused ? `2px solid ${sol.yellow}` : 'none',
          outlineOffset: -2,
        }}
      />
      <ScanlineOverlay />
      <HudOverlay />
    </>
  );
}
