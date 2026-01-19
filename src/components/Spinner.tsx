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

export function BrandedLoader() {
  return (
    <div className="flex min-h-[500px] flex-col items-center justify-center bg-bg-primary px-6">
      <div className="relative mb-8">
        <div className="absolute -inset-4 animate-pulse rounded-full bg-accent/20 blur-xl" />
        <div className="absolute -inset-2 animate-[pulse_2s_ease-in-out_infinite_0.5s] rounded-full bg-accent/10 blur-lg" />

        <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl shadow-lg shadow-accent/30">
          <img
            src="/icon/600.png"
            alt="Engram"
            className="h-full w-full object-cover"
          />
        </div>
      </div>

      <h1 className="mb-2 text-2xl font-bold tracking-tight text-text-primary">
        Engram
      </h1>
      <p className="mb-8 text-sm text-text-muted">
        Local-first AI web clipper
      </p>

      <div className="flex items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
        <span className="text-sm text-text-secondary">Loading</span>
      </div>
    </div>
  );
}
