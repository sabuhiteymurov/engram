interface VaultAccessPromptProps {
  vaultName: string | null;
  onGrantAccess: () => void;
  onOpenSettings: () => void;
}

export function VaultAccessPrompt({
  vaultName,
  onGrantAccess,
  onOpenSettings,
}: VaultAccessPromptProps) {
  return (
    <div className='rounded-xl border border-border bg-bg-secondary p-4 text-center'>
      <p className='mb-3 text-[13px] text-text-secondary'>
        This extension needs access to your export folder to save clips.
      </p>
      <div className='flex gap-2'>
        <button
          className='inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'
          onClick={onGrantAccess}
        >
          🔓 Grant Access
          {vaultName ? ` to ${vaultName}` : ''}
        </button>
        <button
          className='inline-flex cursor-pointer items-center justify-center rounded-xl border border-border bg-bg-tertiary px-4 py-3 text-sm font-semibold text-text-primary transition hover:bg-bg-primary active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'
          onClick={onOpenSettings}
          title='Open Settings'
        >
          ⚙️
        </button>
      </div>
    </div>
  );
}
