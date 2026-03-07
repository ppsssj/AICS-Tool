import type { HTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '@/shared/lib/cn';

export function Card({ className, children, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn(
        'rounded-[24px] border border-[rgb(var(--theme-card-border)_/_0.82)] bg-[rgb(var(--theme-card-bg)_/_0.9)] p-6 shadow-soft backdrop-blur-sm',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
