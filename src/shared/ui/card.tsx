import type { HTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '@/shared/lib/cn';

export function Card({ className, children, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn(
        'rounded-[24px] border border-white/70 bg-white/88 p-6 shadow-soft backdrop-blur-sm',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
