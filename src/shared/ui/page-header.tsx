import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}

export function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            {eyebrow}
          </p>
        ) : null}
        <h1 className={eyebrow ? 'mt-1.5 text-[28px] font-semibold tracking-[-0.04em] text-slate-950' : 'text-[28px] font-semibold tracking-[-0.04em] text-slate-950'}>
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-sm leading-6 text-slate-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div> : null}
    </div>
  );
}
