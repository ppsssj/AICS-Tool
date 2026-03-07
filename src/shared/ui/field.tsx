import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-2.5 text-sm text-slate-700">
      <span className="text-[13px] font-semibold tracking-[-0.01em] text-slate-700">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-5 text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('w-full rounded-[16px] border border-slate-200 bg-white/92 px-4 py-3 text-sm text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-[rgb(var(--theme-accent-200)_/_0.95)] focus:bg-white focus:ring-4 focus:ring-[rgb(var(--theme-accent-100)_/_0.72)]', props.className)} {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('w-full rounded-[16px] border border-slate-200 bg-white/92 px-4 py-3 text-sm text-slate-900 outline-none transition-all duration-200 focus:border-[rgb(var(--theme-accent-200)_/_0.95)] focus:bg-white focus:ring-4 focus:ring-[rgb(var(--theme-accent-100)_/_0.72)]', props.className)} {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('min-h-[140px] w-full rounded-[18px] border border-slate-200 bg-white/92 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-[rgb(var(--theme-accent-200)_/_0.95)] focus:bg-white focus:ring-4 focus:ring-[rgb(var(--theme-accent-100)_/_0.72)]', props.className)} {...props} />;
}
