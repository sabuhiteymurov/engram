interface SpinnerProps {
  size?: 'small' | 'medium';
  text?: string;
}

export function Spinner({ size = 'medium', text }: SpinnerProps) {
  const spinnerClassName =
    size === 'small'
      ? 'h-4 w-4 border-2'
      : 'h-8 w-8 border-[3px]';

  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-text-secondary">
      <div
        className={`${spinnerClassName} animate-spin rounded-full border-border border-t-accent`}
      />
      {text && <span>{text}</span>}
    </div>
  );
}

