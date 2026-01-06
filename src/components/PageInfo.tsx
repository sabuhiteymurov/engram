interface PageInfoProps {
  title: string;
  siteName: string;
  readingTime?: number | null;
}

export function PageInfo({ title, siteName, readingTime }: PageInfoProps) {
  return (
    <section className="flex gap-3 rounded-xl border border-border bg-bg-secondary p-3">
      <div className="text-2xl">📄</div>
      <div className="min-w-0">
        <h2 className="text-sm font-medium leading-snug">
          <span className="block truncate">{title}</span>
        </h2>
        <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-text-secondary">
          <span>{siteName}</span>
          {readingTime && <span>• {readingTime} min read</span>}
        </div>
      </div>
    </section>
  );
}

