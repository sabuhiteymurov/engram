interface FooterProps {
  onPreviewClick: () => void;
  onSettingsClick: () => void;
  previewDisabled: boolean;
}

export function Footer({ onPreviewClick, onSettingsClick, previewDisabled }: FooterProps) {
  return (
    <footer className="flex gap-2 border-t border-border bg-bg-secondary p-3">
      <button
        className="flex-1 cursor-pointer rounded-lg border border-border bg-bg-tertiary px-2 py-2 text-[13px] text-text-secondary transition hover:bg-bg-primary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-bg-tertiary disabled:hover:text-text-secondary"
        onClick={onPreviewClick}
        disabled={previewDisabled}
      >
        Preview
      </button>
      <button
        className="flex-1 cursor-pointer rounded-lg border border-border bg-bg-tertiary px-2 py-2 text-[13px] text-text-secondary transition hover:bg-bg-primary hover:text-text-primary"
        onClick={onSettingsClick}
      >
        Settings
      </button>
    </footer>
  );
}

