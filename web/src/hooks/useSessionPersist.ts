/**
 * useSessionPersist — restores and saves viewport/UI state to localStorage.
 *
 * State is keyed by repo name (from cityStore.repoInfo.name).
 * Restored once per repo name change, saved with a 500 ms debounce.
 *
 * What persists:
 *  - Camera position (ox, oy) and zoom (scale)
 *  - Selected building ID
 *  - Panel focus zone (modal resets to 'city')
 *  - Visibility toggles: showRoads, showLabels, showMinimap
 */

import { useEffect, useRef } from 'react';
import { useCityStore } from '../store/cityStore';
import { useUiStore } from '../store/uiStore';
import { loadSession, saveSession } from '../store/sessionPersist';
import type { CityRenderer } from '../canvas/CityRenderer';

export function useSessionPersist(
  rendererRef: React.RefObject<CityRenderer | null>,
): void {
  const repoName = useCityStore((s) => s.city.repoInfo.name);
  const restoredForRepo = useRef('');

  // Restore saved session when repo name becomes available and renderer is ready
  useEffect(() => {
    if (!repoName || restoredForRepo.current === repoName) return;
    const renderer = rendererRef.current;
    if (!renderer) return;

    const saved = loadSession(repoName);
    if (saved) {
      renderer.camera.ox = saved.cameraOx;
      renderer.camera.oy = saved.cameraOy;
      renderer.camera.scale = saved.cameraScale;

      useUiStore.setState({
        selectedBuildingId: saved.selectedBuildingId,
        focusZone: saved.focusZone === 'modal' ? 'city' : saved.focusZone,
        showRoads: saved.showRoads,
        showLabels: saved.showLabels,
        showMinimap: saved.showMinimap,
        zoom: saved.cameraScale,
        cameraX: saved.cameraOx,
        cameraY: saved.cameraOy,
      });
    }

    restoredForRepo.current = repoName;
  }, [repoName, rendererRef]);

  // Save session on uiStore changes (debounced 500 ms)
  useEffect(() => {
    if (!repoName) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleSave = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        // Guard against stale closure: if the repo changed before this timer
        // fired (possible when React's async commit hasn't run cleanup yet),
        // skip the save to avoid persisting new-repo state under the old key.
        if (useCityStore.getState().city.repoInfo.name !== repoName) {
          timer = null;
          return;
        }
        const ui = useUiStore.getState();
        const cam = rendererRef.current?.camera;
        saveSession(repoName, {
          cameraOx: cam?.ox ?? ui.cameraX,
          cameraOy: cam?.oy ?? ui.cameraY,
          cameraScale: cam?.scale ?? ui.zoom,
          selectedBuildingId: ui.selectedBuildingId,
          focusZone: ui.focusZone,
          showRoads: ui.showRoads,
          showLabels: ui.showLabels,
          showMinimap: ui.showMinimap,
        });
        timer = null;
      }, 500);
    };

    const unsub = useUiStore.subscribe(scheduleSave);

    return () => {
      if (timer !== null) clearTimeout(timer);
      unsub();
    };
  }, [repoName, rendererRef]);
}
