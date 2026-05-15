/**
 * useCameraControls — encapsulates camera state mutations (pan, zoom, reset).
 *
 * Exposes stable callbacks that mutate an IsometricCamera instance and
 * sync the result to the UI store. Import this hook wherever camera state
 * needs to change so all mutations go through one place.
 */

import { useCallback } from 'react';
import { useUiStore } from '../store/uiStore';
import type { IsometricCamera } from '../canvas/IsometricCamera';

export interface CameraControls {
  /** Sync camera position and scale to the UI store. */
  syncCamera: (cam: IsometricCamera) => void;
  /** Pan by one key step in the given direction, then sync. */
  panByKey: (cam: IsometricCamera, dir: 'up' | 'down' | 'left' | 'right') => void;
  /** Zoom in one step and sync. */
  zoomIn: (cam: IsometricCamera) => void;
  /** Zoom out one step and sync. */
  zoomOut: (cam: IsometricCamera) => void;
  /** Reset zoom to 1.0 and sync. */
  resetZoom: (cam: IsometricCamera) => void;
}

export function useCameraControls(): CameraControls {
  const setZoom = useUiStore((s) => s.setZoom);
  const setCamera = useUiStore((s) => s.setCamera);

  const syncCamera = useCallback((cam: IsometricCamera): void => {
    setZoom(cam.scale);
    setCamera(cam.ox, cam.oy);
  }, [setZoom, setCamera]);

  const panByKey = useCallback((cam: IsometricCamera, dir: 'up' | 'down' | 'left' | 'right'): void => {
    cam.panByKey(dir);
    setCamera(cam.ox, cam.oy);
  }, [setCamera]);

  const zoomIn = useCallback((cam: IsometricCamera): void => {
    cam.zoomIn();
    syncCamera(cam);
  }, [syncCamera]);

  const zoomOut = useCallback((cam: IsometricCamera): void => {
    cam.zoomOut();
    syncCamera(cam);
  }, [syncCamera]);

  const resetZoom = useCallback((cam: IsometricCamera): void => {
    cam.resetZoom();
    syncCamera(cam);
  }, [syncCamera]);

  return { syncCamera, panByKey, zoomIn, zoomOut, resetZoom };
}
