import type { PropsWithChildren } from 'react';
import { cn } from '@/shared/lib/cn';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border border-slate-200 bg-slate-50 text-slate-600',
  success: 'border border-emerald-200/70 bg-emerald-50 text-success',
  warning: 'border border-amber-200/70 bg-amber-50 text-warning',
  danger: 'border border-rose-200/70 bg-rose-50 text-danger',
  info: 'border border-[rgb(var(--theme-accent-200)_/_0.8)] bg-accent-50 text-accent-700',
};

interface BadgeProps {
  tone?: BadgeTone;
  className?: string;
}

export function Badge({ tone = 'neutral', className, children }: PropsWithChildren<BadgeProps>) {
  return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.01em]', toneClasses[tone], className)}>{children}</span>;
}
