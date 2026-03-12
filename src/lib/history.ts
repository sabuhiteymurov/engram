// History storage using chrome.storage.local (MV3 compatible)

export interface HistoryEntry {
  id: string;
  title: string;
  url: string;
  favicon: string;
  template: string;
  status: 'processing' | 'success' | 'error';
  errorMessage?: string;
  clippedAt: string;
  fileSize?: number;
}

const HISTORY_KEY = 'clipHistory';

export async function getHistory(): Promise<HistoryEntry[]> {
  const result = await browser.storage.local.get(HISTORY_KEY);
  return (result[HISTORY_KEY] as HistoryEntry[] | undefined) ?? [];
}

export async function setHistory(entries: HistoryEntry[]): Promise<void> {
  await browser.storage.local.set({ [HISTORY_KEY]: entries });
}

export async function addHistoryEntry(entry: HistoryEntry): Promise<void> {
  const history = await getHistory();
  history.unshift(entry);
  await browser.storage.local.set({ [HISTORY_KEY]: history });
}

export async function updateHistoryEntry(
  id: string,
  updates: Partial<Pick<HistoryEntry, 'status' | 'errorMessage' | 'fileSize'>>,
): Promise<void> {
  const history = await getHistory();
  const index = history.findIndex((entry) => entry.id === id);
  if (index === -1) return;
  history[index] = { ...history[index], ...updates };
  await browser.storage.local.set({ [HISTORY_KEY]: history });
}

export async function removeHistoryEntry(id: string): Promise<void> {
  const history = await getHistory();
  await browser.storage.local.set({
    [HISTORY_KEY]: history.filter((entry) => entry.id !== id),
  });
}

export async function clearHistory(): Promise<void> {
  await browser.storage.local.set({ [HISTORY_KEY]: [] });
}

export function createHistoryEntry(
  title: string,
  url: string,
  template: string,
  favicon?: string,
): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    title,
    url,
    favicon: favicon || '',
    template,
    status: 'processing',
    clippedAt: new Date().toISOString(),
  };
}

/**
 * Returns a human-readable relative time string (no external library needed).
 */
export function getRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(isoDate).toLocaleDateString();
}
