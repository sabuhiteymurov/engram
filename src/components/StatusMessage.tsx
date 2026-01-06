type StatusType = 'success' | 'error' | 'info';

interface StatusMessageProps {
  message: string;
  type?: StatusType;
}

function getStatusType(message: string): StatusType {
  if (message.startsWith('Error')) return 'error';
  if (message.startsWith('✅')) return 'success';
  return 'info';
}

export function StatusMessage({ message, type }: StatusMessageProps) {
  const statusType = type || getStatusType(message);

  const typeClassName: Record<StatusType, string> = {
    success:
      'bg-success/15 text-success border-success/30',
    error:
      'bg-error/15 text-error border-error/30',
    info:
      'bg-accent/15 text-accent border-accent/30',
  };

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-[13px] font-medium ${typeClassName[statusType]}`}
    >
      {message}
    </div>
  );
}

