interface HeaderProps {
  onSettingsClick: () => void;
}

export function Header({ onSettingsClick }: HeaderProps) {
  return (
    <header className='flex items-center justify-between border-b border-border bg-bg-secondary p-4'>
      <div className='flex items-center gap-2'>
        <span className='text-2xl text-accent'>◈</span>
        <span className='text-lg font-semibold tracking-tight'>Engram</span>
      </div>
      <button
        className='cursor-pointer rounded-lg p-1 text-lg transition hover:bg-bg-tertiary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'
        title='Settings'
        onClick={onSettingsClick}
      >
        ⚙️
      </button>
    </header>
  );
}
