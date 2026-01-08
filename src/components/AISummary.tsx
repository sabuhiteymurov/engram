import type { AIStatus } from '../hooks/useAI';

interface AISummaryProps {
  status: AIStatus;
  summary: string | null;
  isLoading: boolean;
}

export function AISummary({ status, summary, isLoading }: AISummaryProps) {
  return (
    <section className='overflow-hidden rounded-xl border border-border bg-bg-secondary'>
      <div className='flex items-center justify-between bg-bg-tertiary px-3 py-2 text-[13px] font-medium'>
        <span>🤖 AI Summary</span>
        <StatusBadge status={status} />
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

function StatusBadge({ status }: { status: AIStatus }) {
  const config: Record<AIStatus, { className: string; text: string }> = {
    checking: {
      className: 'bg-accent/15 text-accent',
      text: 'Checking...',
    },
    available: {
      className: 'bg-success/15 text-success',
      text: 'AI Ready',
    },
    unavailable: {
      className: 'bg-warning/15 text-warning',
      text: 'AI Unavailable',
    },
  };

  const { className, text } = config[status];
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

  const placeholderText = {
    available: 'Summary will be generated when you clip.',
    unavailable: 'Enable Gemini Nano in chrome://flags to use AI features.',
    checking: 'Checking AI availability...',
  };

  return <p className='italic text-text-muted'>{placeholderText[status]}</p>;
}
