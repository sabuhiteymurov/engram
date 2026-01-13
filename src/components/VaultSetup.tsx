interface VaultSetupProps {
  onSelectVault: () => void;
}

export function VaultSetup({ onSelectVault }: VaultSetupProps) {
  return (
    <section className="rounded-xl border border-border bg-bg-secondary p-6 text-center">
      <p className="mb-4 text-text-secondary">
        Select an export folder to start clipping.
      </p>
      <button
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover"
        onClick={onSelectVault}
      >
        📁 Select Export Folder
      </button>
    </section>
  );
}

