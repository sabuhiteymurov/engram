import type { AIStatus } from '../hooks/useAI';

interface AISummaryProps {
  status: AIStatus;
  summary: string | null;
  isLoading: boolean;
  onRecheckStatus?: () => void;
}

export function AISummary({
  status,
  summary,
  isLoading,
  onRecheckStatus,
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
    downloading: {
      className: 'bg-warning/15 text-warning',
      text: 'Model Not Downloaded',
    },
    unavailable: {
      className: 'bg-error/15 text-error',
      text: 'AI Unavailable',
    },
  };

  const { className, text } = config[status];

  // Show recheck button for downloading status
  if (status === 'downloading' && onRecheck) {
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
}: {
  status: AIStatus;
  summary: string | null;
  isLoading: boolean;
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
    return (
      <div className='space-y-2'>
        <p className='text-text-secondary'>
          Chrome will download the Gemini Nano AI model (~1-2 GB) on first use.
        </p>
        <div className='rounded-lg bg-bg-tertiary p-2 text-[12px]'>
          <p className='font-medium text-text-primary'>To download now:</p>
          <ol className='mt-1 list-inside list-decimal space-y-0.5 text-text-muted'>
            <li>
              Open{' '}
              <code className='rounded bg-bg-primary px-1'>
                chrome://components
              </code>
            </li>
            <li>Find "Optimization Guide On Device Model"</li>
            <li>Click "Check for update"</li>
          </ol>
        </div>
        <p className='text-[11px] text-text-muted'>
          You can still clip without AI summary using the button below.
        </p>
      </div>
    );
  }

  const placeholderText: Record<AIStatus, string> = {
    available: 'Summary will be generated when you clip.',
    unavailable: 'Enable Gemini Nano in chrome://flags to use AI features.',
    checking: 'Checking AI availability...',
    downloading: '', // handled above
  };

  return <p className='italic text-text-muted'>{placeholderText[status]}</p>;
}
