import { useState } from 'react';
import { Globe, Check, X, Loader2, Trash2 } from 'lucide-react';
import { getRelativeTime } from '@lib/history';
import type { HistoryEntry } from '@lib/history';

interface HistoryItemProps {
  entry: HistoryEntry;
  onRemove: (id: string) => void;
}

export function HistoryItem({ entry, onRemove }: HistoryItemProps) {
  const [imgError, setImgError] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showError, setShowError] = useState(false);

  let domain = '';
  try {
    domain = new URL(entry.url).hostname.replace('www.', '');
  } catch {
    domain = entry.url;
  }

  const handleRemove = () => {
    setIsRemoving(true);
    // Allow the exit animation to play before actually removing
    setTimeout(() => onRemove(entry.id), 200);
  };

  const handleTitleClick = () => {
    browser.tabs.create({ url: entry.url });
  };

  return (
    <div
      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 hover:bg-bg-tertiary ${
        isRemoving ? 'translate-x-4 opacity-0' : 'animate-[fadeSlideIn_0.2s_ease-out]'
      }`}
    >
      {/* Favicon */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-tertiary">
        {entry.favicon && !imgError ? (
          <img
            src={entry.favicon}
            alt=""
            width={16}
            height={16}
            className="h-4 w-4"
            onError={() => setImgError(true)}
          />
        ) : (
          <Globe className="h-4 w-4 text-text-muted" />
        )}
      </div>

      {/* Title & domain */}
      <div className="min-w-0 flex-1">
        <button
          className="block w-full cursor-pointer truncate text-left text-[13px] font-semibold leading-snug text-text-primary transition hover:text-accent"
          onClick={handleTitleClick}
          title={entry.title}
        >
          {entry.title}
        </button>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-text-muted">
          <span className="truncate">{domain}</span>
          <span>·</span>
          <span className="shrink-0">{getRelativeTime(entry.clippedAt)}</span>
        </div>
      </div>

      {/* Status badge */}
      <div className="shrink-0">
        <StatusBadge
          status={entry.status}
          errorMessage={entry.errorMessage}
          showError={showError}
          onToggleError={() => setShowError((v) => !v)}
        />
      </div>

      {/* Delete button */}
      <button
        className="shrink-0 cursor-pointer rounded-md p-1 text-text-muted opacity-0 transition hover:bg-error/15 hover:text-error group-hover:opacity-100"
        onClick={handleRemove}
        title="Remove from history"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function StatusBadge({
  status,
  errorMessage,
  showError,
  onToggleError,
}: {
  status: HistoryEntry['status'];
  errorMessage?: string;
  showError: boolean;
  onToggleError: () => void;
}) {
  if (status === 'processing') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">
        <Loader2 className="h-3 w-3 animate-spin" />
        Clipping…
      </span>
    );
  }

  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
        <Check className="h-3 w-3" />
        Saved
      </span>
    );
  }

  // Error status
  return (
    <div className="relative">
      <button
        className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-error/15 px-2 py-0.5 text-[10px] font-medium text-error transition hover:bg-error/25"
        onClick={onToggleError}
        title={errorMessage ?? 'Unknown error'}
      >
        <X className="h-3 w-3" />
        Failed
      </button>
      {showError && errorMessage && (
        <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-border bg-bg-secondary p-2 text-[11px] text-text-secondary shadow-lg">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
