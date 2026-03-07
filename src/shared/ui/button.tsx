import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '@/shared/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border border-[rgb(var(--theme-accent-600)_/_0.24)] bg-accent-500 text-white shadow-[0_10px_24px_rgb(var(--theme-accent-500)_/_0.24)] hover:bg-accent-600',
  secondary:
    'border border-slate-200 bg-white/92 text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] hover:border-slate-300 hover:bg-white',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100/90 hover:text-slate-900',
  danger: 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
};

export function Button({
  variant = 'primary',
  fullWidth = false,
  className,
  children,
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-[14px] px-4 py-2.5 text-sm font-medium tracking-[-0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-200)_/_0.9)] disabled:cursor-not-allowed disabled:opacity-60',
        variantClasses[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
