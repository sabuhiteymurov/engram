import type { Template } from '@lib/types';

interface ClipSettingsProps {
  vaultName: string | null;
  folderPath: string;
  templates: Template[];
  selectedTemplate: Template;
  onTemplateChange: (template: Template) => void;
}

export function ClipSettings({
  vaultName,
  folderPath,
  templates,
  selectedTemplate,
  onTemplateChange,
}: ClipSettingsProps) {
  return (
    <section className='flex flex-col gap-2 rounded-xl border border-border bg-bg-secondary p-3'>
      <SettingRow label='📁 Export:' value={vaultName || 'Not selected'} />
      <SettingRow label='📂 Folder:' value={folderPath || '/'} />
      <div className='flex items-center justify-between text-[13px]'>
        <span className='text-text-secondary'>📝 Template:</span>
        <select
          className='cursor-pointer rounded-lg border border-border bg-bg-tertiary px-2 py-1 text-[13px] text-text-primary focus:border-accent focus:outline-none'
          value={selectedTemplate.id}
          onChange={(e) => {
            const template = templates.find((t) => t.id === e.target.value);
            if (template) onTemplateChange(template);
          }}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-center justify-between text-[13px]'>
      <span className='text-text-secondary'>{label}</span>
      <span className='max-w-[200px] truncate font-medium text-text-primary'>
        {value}
      </span>
    </div>
  );
}
