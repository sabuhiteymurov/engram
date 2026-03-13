import { useState } from 'react';
import type { ReviewSynthesis, ProductInfo } from '@lib/types';
import type { SynthesisProgress } from '@lib/ai';

interface ReviewSynthesisProps {
  product: ProductInfo | null;
  synthesis: ReviewSynthesis | null;
  progress: SynthesisProgress | null;
  isLoading: boolean;
  error: string | null;
  onSynthesize: () => void;
  onCopy?: () => Promise<boolean>;
  onSave?: () => Promise<boolean>;
}

export function ReviewSynthesisPanel({
  product,
  synthesis,
  progress,
  isLoading,
  error,
  onSynthesize,
  onCopy,
  onSave,
}: ReviewSynthesisProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  if (!synthesis && !isLoading) {
    return (
      <section className="rounded-xl border border-border bg-bg-secondary">
        <div className="flex items-center justify-between bg-bg-tertiary px-3 py-2 text-[13px] font-medium">
          <span>🛒 Product Detected</span>
          <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
            Amazon
          </span>
        </div>
        <div className="p-3">
          {product && (
            <p className="mb-3 text-[13px] text-text-secondary line-clamp-2">
              {product.title}
            </p>
          )}
          {error && (
            <p className="mb-3 text-[12px] text-error">{error}</p>
          )}
          <button
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#10b981_0%,#059669_100%)] px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(16,185,129,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(16,185,129,0.4)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
            onClick={onSynthesize}
            disabled={isLoading}
          >
            <span>Synthesize Reviews</span>
            <span className="text-base">🔍</span>
          </button>
        </div>
      </section>
    );
  }

  if (isLoading && progress) {
    return (
      <section className="rounded-xl border border-border bg-bg-secondary">
        <div className="flex items-center justify-between bg-bg-tertiary px-3 py-2 text-[13px] font-medium">
          <span>🔄 Analyzing Reviews</span>
        </div>
        <div className="p-3">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
            <span className="text-[13px] text-text-secondary">
              {progress.message}
            </span>
          </div>
          {progress.total > 0 && (
            <div className="h-1.5 overflow-hidden rounded-full bg-bg-tertiary">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                }}
              />
            </div>
          )}
        </div>
      </section>
    );
  }

  if (synthesis) {
    return (
      <section className="rounded-xl border border-border bg-bg-secondary">
        <div className="flex items-center justify-between bg-bg-tertiary px-3 py-2 text-[13px] font-medium">
          <span>📊 Review Synthesis</span>
          <span className="text-[10px] text-text-muted">
            {synthesis.reviewsAnalyzed} reviews analyzed
          </span>
        </div>

        <div className="space-y-3 p-3">
          <div className="rounded-lg bg-bg-tertiary p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                The Verdict
              </span>
              <SentimentBadge score={synthesis.sentimentScore} />
            </div>
            <p className="text-[13px] leading-relaxed text-text-primary">
              {synthesis.verdict}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
              <h4 className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
                <span>✓</span> Pros
              </h4>
              <ul className="space-y-1">
                {synthesis.pros.slice(0, 4).map((pro, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-1 text-[12px] leading-tight text-text-secondary"
                  >
                    <span className="mt-0.5 text-emerald-400">•</span>
                    <span>{pro.point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2">
              <h4 className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-red-400">
                <span>✗</span> Cons
              </h4>
              <ul className="space-y-1">
                {synthesis.cons.slice(0, 4).map((con, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-1 text-[12px] leading-tight text-text-secondary"
                  >
                    <span className="mt-0.5 text-red-400">•</span>
                    <span>{con.point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {synthesis.qualityAlerts.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
              <h4 className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber-400">
                <span>⚠️</span> Quality Alert
              </h4>
              <ul className="space-y-1">
                {synthesis.qualityAlerts.map((alert, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-1 text-[12px] leading-tight text-amber-200"
                  >
                    <span className="mt-0.5">
                      {alert.severity === 'critical' ? '🚨' : '⚠️'}
                    </span>
                    <span>{alert.issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {onCopy && (
              <button
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-[12px] font-medium text-text-secondary transition hover:bg-bg-primary active:scale-[0.98]"
                onClick={async () => {
                  const success = await onCopy();
                  if (success) {
                    setCopyStatus('copied');
                    setTimeout(() => setCopyStatus('idle'), 2000);
                  }
                }}
              >
                {copyStatus === 'copied' ? (
                  <>
                    <span>✓</span> Copied!
                  </>
                ) : (
                  <>
                    <span>📋</span> Copy Markdown
                  </>
                )}
              </button>
            )}
            {onSave && (
              <button
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[12px] font-medium text-white transition hover:bg-accent-hover active:scale-[0.98]"
                onClick={onSave}
              >
                <span>💾</span> Save to Vault
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  return null;
}

function SentimentBadge({ score }: { score: number }) {
  let color: string;
  let label: string;

  if (score >= 75) {
    color = 'bg-emerald-500/15 text-emerald-400';
    label = 'Positive';
  } else if (score >= 50) {
    color = 'bg-amber-500/15 text-amber-400';
    label = 'Mixed';
  } else {
    color = 'bg-red-500/15 text-red-400';
    label = 'Negative';
  }

  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${color}`}>
      {label} ({score}%)
    </span>
  );
}
