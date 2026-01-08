import { useEffect, useRef } from 'react';
import type { ClipResult } from '../hooks/useClip';

interface PreviewModalProps {
  isOpen: boolean;
  result: ClipResult;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
}

export function PreviewModal({
  isOpen,
  result,
  onClose,
  onSave,
  isSaving,
}: PreviewModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.75)] p-4'
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className='flex max-h-[calc(100vh-32px)] w-full flex-col overflow-hidden rounded-xl border border-border bg-bg-primary outline-none'
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className='flex items-center justify-between border-b border-border bg-bg-secondary px-4 py-3'>
          <h3 className='text-[15px] font-semibold'>📝 Preview</h3>
          <button
            className='rounded-lg p-1 text-base text-text-secondary transition hover:bg-bg-tertiary hover:text-text-primary'
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className='flex flex-1 flex-col gap-3 overflow-y-auto p-4'>
          <div className='rounded-lg bg-bg-secondary p-3'>
            <span className='mb-1 block text-[11px] font-semibold uppercase text-text-muted'>
              Filename:
            </span>
            <span className='font-mono text-[13px] text-accent'>
              {result.filename}.md
            </span>
          </div>

          {result.summary && (
            <div className='rounded-lg bg-bg-secondary p-3'>
              <span className='mb-1 block text-[11px] font-semibold uppercase text-text-muted'>
                AI Summary:
              </span>
              <p className='text-[13px] leading-relaxed text-text-secondary'>
                {result.summary}
              </p>
            </div>
          )}

          <div className='flex flex-1 flex-col'>
            <span className='mb-2 block text-[11px] font-semibold uppercase text-text-muted'>
              Markdown:
            </span>
            <pre className='max-h-[200px] flex-1 overflow-auto whitespace-pre-wrap wrap-break-word rounded-lg border border-border bg-bg-secondary p-3 font-mono text-[11px] leading-relaxed text-text-secondary'>
              {result.markdown}
            </pre>
          </div>
        </div>

        <div className='flex gap-2 border-t border-border bg-bg-secondary px-4 py-3'>
          <button
            className='inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-bg-tertiary px-5 py-3 text-sm font-semibold text-text-primary transition hover:bg-bg-primary'
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className='inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70'
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save to Vault'}
          </button>
        </div>
      </div>
    </div>
  );
}
