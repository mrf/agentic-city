import { useEffect } from 'react';
import { useCityStore } from '../store/cityStore';
import { useCoverageHistoryStore } from '../store/coverageHistoryStore';

/** Polling interval for coverage history in milliseconds (10 s). */
const POLL_INTERVAL_MS = 10_000;

/**
 * Fetches coverage history on mount and whenever the city state timestamp
 * changes (i.e., after each metrics refresh), with a 10-second minimum
 * interval to avoid hammering the API.
 */
export function useCoverageHistory(): void {
  const ts = useCityStore((s) => s.city.ts);
  const fetchHistory = useCoverageHistoryStore((s) => s.fetch);

  // Initial fetch on mount.
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Refetch when city state is updated, throttled to POLL_INTERVAL_MS.
  useEffect(() => {
    const timer = setTimeout(fetchHistory, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [ts, fetchHistory]);
}
