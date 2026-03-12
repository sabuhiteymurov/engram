import { useState, useEffect, useCallback } from 'react';
import {
  getHistory,
  setHistory,
  removeHistoryEntry,
  clearHistory,
  type HistoryEntry,
} from '@lib/history';

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

interface UseHistoryReturn {
  entries: HistoryEntry[];
  isLoading: boolean;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

export function useHistory(): UseHistoryReturn {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load history on mount and clean up stale processing entries (crash recovery)
  useEffect(() => {
    getHistory()
      .then(async (loaded) => {
        const now = Date.now();
        let hasStale = false;

        const cleaned = loaded.map((entry) => {
          if (
            entry.status === 'processing' &&
            now - new Date(entry.clippedAt).getTime() > STALE_THRESHOLD_MS
          ) {
            hasStale = true;
            return {
              ...entry,
              status: 'error' as const,
              errorMessage: 'Clip was interrupted. Please try again.',
            };
          }
          return entry;
        });

        if (hasStale) {
          await setHistory(cleaned);
        }

        setEntries(cleaned);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Listen for storage changes so popup auto-updates when background writes
  useEffect(() => {
    function onChanged(
      changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
      area: string,
    ) {
      if (area === 'local' && changes.clipHistory) {
        setEntries(
          (changes.clipHistory.newValue as HistoryEntry[] | undefined) ?? [],
        );
      }
    }
    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, []);

  const remove = useCallback(async (id: string) => {
    await removeHistoryEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearAll = useCallback(async () => {
    await clearHistory();
    setEntries([]);
  }, []);

  return { entries, isLoading, remove, clearAll };
}
