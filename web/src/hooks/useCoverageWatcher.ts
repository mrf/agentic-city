/**
 * Coverage regression detection.
 *
 * Detects when aggregate coverage drops by at least COVERAGE_DROP_MIN_DELTA
 * and surfaces the affected file IDs for a dispatch suggestion.
 *
 * The threshold matches the coverageColor green boundary (80%) used elsewhere
 * in the UI. A suggestion fires whenever coverage decreases — regardless of
 * whether it crosses the 80% line — because any regression warrants attention.
 */

import { useEffect, useRef } from 'react';
import { useCityStore } from '../store/cityStore';
import type { Building, ActivityEvent } from '../store/cityStore';
import { useUiStore } from '../store/uiStore';
import type { CoverageDropSuggestion } from '../store/uiStore';

/** Minimum aggregate coverage drop (as a fraction) required to trigger a suggestion. */
export const COVERAGE_DROP_MIN_DELTA = 0.01; // 1 percentage point

export interface CoverageDropResult {
  affectedFileIds: string[];
}

/**
 * Pure function: compares previous and next building coverage lists against
 * aggregate coverage numbers and returns affected file IDs when a regression
 * is detected. Exported for unit testing.
 *
 * Returns null when:
 *  - Either aggregate is unknown (< 0)
 *  - The drop is less than COVERAGE_DROP_MIN_DELTA
 *  - Coverage did not drop (stayed the same or increased)
 */
export function detectCoverageDrop(
  prevBuildings: Array<{ id: string; coverage: number }>,
  nextBuildings: Array<{ id: string; coverage: number }>,
  prevAggregateCoverage: number,
  nextAggregateCoverage: number,
): CoverageDropResult | null {
  if (prevAggregateCoverage < 0 || nextAggregateCoverage < 0) return null;
  if (nextAggregateCoverage > prevAggregateCoverage - COVERAGE_DROP_MIN_DELTA) return null;

  const prevMap = new Map(prevBuildings.map((b) => [b.id, b.coverage]));
  const affectedFileIds = nextBuildings
    .filter((b) => {
      const prev = prevMap.get(b.id);
      return prev !== undefined && prev >= 0 && b.coverage >= 0 && b.coverage < prev;
    })
    .map((b) => b.id);

  return { affectedFileIds };
}

/** Hook: watches building coverage and emits a suggestion when regression is detected. */
export function useCoverageWatcher(): void {
  const prevRef = useRef<{ buildings: Building[]; coverage: number } | null>(null);

  const buildings = useCityStore((s) => s.city.buildings);
  const coverage = useCityStore((s) => s.city.stats.coverage);
  const patchCity = useCityStore((s) => s.patchCity);
  const activities = useCityStore((s) => s.city.activities);

  const setCoverageDropSuggestion = useUiStore((s) => s.setCoverageDropSuggestion);
  // Track whether a suggestion is active via a ref to avoid adding it to deps.
  const hasSuggestionRef = useRef(false);
  const coverageDropSuggestion = useUiStore((s) => s.coverageDropSuggestion);
  hasSuggestionRef.current = coverageDropSuggestion !== null;

  // Keep activities in a ref so the effect closure always sees the latest value.
  const activitiesRef = useRef<ActivityEvent[]>(activities);
  activitiesRef.current = activities;

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = { buildings, coverage };

    if (prev === null) return;
    if (hasSuggestionRef.current) return;

    const result = detectCoverageDrop(
      prev.buildings, buildings, prev.coverage, coverage,
    );
    if (result === null) return;

    const suggestion: CoverageDropSuggestion = {
      affectedFileIds: result.affectedFileIds,
      triggeredAt: Date.now(),
    };
    setCoverageDropSuggestion(suggestion);

    // Append a local activity so the RightRail log reflects the regression.
    const event: ActivityEvent = {
      ts: new Date().toISOString(),
      who: 'CI',
      message: `coverage dropped — suggest add-test for ${result.affectedFileIds.length} file(s)`,
      color: '',
      severity: 'warn',
    };
    patchCity({ activities: [...activitiesRef.current, event] });
  }, [buildings, coverage, setCoverageDropSuggestion, patchCity]);
}
