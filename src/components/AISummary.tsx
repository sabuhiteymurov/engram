import type { AIStatus } from '../hooks/useAI';
import type { DownloadProgress } from '../lib/ai';

interface AISummaryProps {
  status: AIStatus;
  summary: string | null;
  isLoading: boolean;
  downloadProgress?: DownloadProgress | null;
  onRecheckStatus?: () => void;
  onDownload?: () => void;
}

export function AISummary({
  status,
  summary,
  isLoading,
  downloadProgress,
  onRecheckStatus,
  onDownload,
}: AISummaryProps) {
  return (
    <section className='overflow-hidden rounded-xl border border-border bg-bg-secondary'>
      <div className='flex items-center justify-between bg-bg-tertiary px-3 py-2 text-[13px] font-medium'>
        <span>🤖 AI Summary</span>
        <StatusBadge status={status} onRecheck={onRecheckStatus} />
      </div>
      <div className='min-h-[80px] p-3 text-[13px] leading-relaxed'>
        <SummaryContent
          status={status}
          summary={summary}
          isLoading={isLoading}
          downloadProgress={downloadProgress}
          onDownload={onDownload}
        />
      </div>
    </section>
  );
}

function StatusBadge({
  status,
  onRecheck,
}: {
  status: AIStatus;
  onRecheck?: () => void;
}) {
  const config: Record<AIStatus, { className: string; text: string }> = {
    checking: {
      className: 'bg-accent/15 text-accent',
      text: 'Checking...',
    },
    available: {
      className: 'bg-success/15 text-success',
      text: 'AI Ready',
    },
    downloadable: {
      className: 'bg-warning/15 text-warning',
      text: 'Model Not Downloaded',
    },
    downloading: {
      className: 'bg-accent/15 text-accent',
      text: 'Downloading...',
    },
    unavailable: {
      className: 'bg-error/15 text-error',
      text: 'AI Unavailable',
    },
  };

  const { className, text } = config[status];

  // Show recheck button for downloadable status
  if (status === 'downloadable' && onRecheck) {
    return (
      <button
        onClick={onRecheck}
        className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition hover:opacity-80 ${className}`}
        title='Click to check if model is ready'
      >
        {text}
        <span className='text-[9px]'>🔄</span>
      </button>
    );
  }

  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${className}`}
    >
      {text}
    </span>
  );
}

function SummaryContent({
  status,
  summary,
  isLoading,
  downloadProgress,
  onDownload,
}: {
  status: AIStatus;
  summary: string | null;
  isLoading: boolean;
  downloadProgress?: DownloadProgress | null;
  onDownload?: () => void;
}) {
  if (isLoading) {
    return (
      <div className='flex items-center gap-2 text-text-secondary'>
        <div className='h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent' />
        <span>Generating summary...</span>
      </div>
    );
  }

  if (summary) {
    return <p>{summary}</p>;
  }

  if (status === 'downloading') {
    const hasProgress = downloadProgress && downloadProgress.total > 0;
    const progressPercent = hasProgress
      ? Math.round((downloadProgress.loaded / downloadProgress.total) * 100)
      : 0;

    return (
      <div className='space-y-2'>
        <div className='flex items-center gap-2 text-text-secondary'>
          <div className='h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent' />
          <span>Downloading Gemini Nano model...</span>
        </div>
        <div className='space-y-1'>
          <div className='h-2 overflow-hidden rounded-full bg-bg-tertiary'>
            {hasProgress ? (
              <div
                className='h-full bg-accent transition-all duration-300'
                style={{ width: `${progressPercent}%` }}
              />
            ) : (
              <div className='h-full w-full animate-pulse bg-accent/50' />
            )}
          </div>
          {hasProgress && (
            <p className='text-[11px] text-text-muted'>{progressPercent}%</p>
          )}
        </div>
        <p className='text-[11px] text-text-muted'>
          This may take a few minutes. You can continue using Chrome.
        </p>
      </div>
    );
  }

  if (status === 'downloadable') {
    return (
      <div className='space-y-2'>
        <p className='text-text-secondary'>
          Gemini Nano AI model needs to be downloaded (~1-2 GB).
        </p>
        {onDownload && (
          <button
            onClick={onDownload}
            className='inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-[12px] font-medium text-white transition hover:bg-accent-hover active:scale-[0.98]'
          >
            <span>⬇️</span>
            <span>Download Model</span>
          </button>
        )}
        <p className='text-[11px] text-text-muted'>
          Or clip without AI summary using the button below.
        </p>
      </div>
    );
  }

  const placeholderText: Record<AIStatus, string> = {
    available: 'Summary will be generated when you clip.',
    unavailable: 'Enable Gemini Nano in chrome://flags to use AI features.',
    checking: 'Checking AI availability...',
    downloadable: '', // handled above
    downloading: '', // handled above
  };

  return <p className='italic text-text-muted'>{placeholderText[status]}</p>;
}
