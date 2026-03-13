interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

export function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: TabButtonProps) {
  return (
    <button
      className={`relative flex flex-1 cursor-pointer flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${
        active
          ? 'text-accent'
          : 'text-text-muted hover:text-text-secondary'
      }`}
      onClick={onClick}
    >
      <div className='relative'>
        {icon}
        {badge !== undefined && (
          <span className='absolute -right-2.5 -top-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-warning px-1 text-[9px] font-bold text-bg-primary'>
            {badge}
          </span>
        )}
      </div>
      {label}
      {active && (
        <div className='absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-accent' />
      )}
    </button>
  );
}
