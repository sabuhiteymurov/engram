import { useState } from 'react';
import { Clock } from 'lucide-react';
import { HistoryItem } from './HistoryItem';
import type { HistoryEntry } from '@lib/history';

interface HistoryViewProps {
  entries: HistoryEntry[];
  isLoading: boolean;
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

export function HistoryView({
  entries,
  isLoading,
  onRemove,
  onClearAll,
}: HistoryViewProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClearAll = () => {
    onClearAll();
    setConfirmClear(false);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-text-secondary">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
        <span className="text-sm">Loading history…</span>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-tertiary">
          <Clock className="h-7 w-7 text-text-muted" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            No clips yet
          </h3>
          <p className="mt-1 text-[12px] text-text-muted">
            Your clipping history will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg-primary px-4 py-2">
        <h2 className="text-[13px] font-semibold text-text-primary">
          History
          <span className="ml-1.5 text-[11px] font-normal text-text-muted">
            ({entries.length})
          </span>
        </h2>
        {confirmClear ? (
          <span className="flex items-center gap-1.5 text-[12px]">
            <span className="text-text-secondary">Are you sure?</span>
            <button
              className="cursor-pointer font-medium text-error transition hover:text-error/80"
              onClick={handleClearAll}
            >
              Yes
            </button>
            <span className="text-text-muted">/</span>
            <button
              className="cursor-pointer font-medium text-text-secondary transition hover:text-text-primary"
              onClick={() => setConfirmClear(false)}
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            className="cursor-pointer text-[12px] font-medium text-error/80 transition hover:text-error"
            onClick={() => setConfirmClear(true)}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Scrollable list */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1 py-1">
        {entries.map((entry) => (
          <HistoryItem key={entry.id} entry={entry} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}
