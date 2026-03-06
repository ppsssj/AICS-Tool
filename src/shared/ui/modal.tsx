import type { PropsWithChildren, ReactNode } from 'react';
import { Button } from '@/shared/ui/button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, description, footer, children }: PropsWithChildren<ModalProps>) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/28 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] border border-white/80 bg-[rgba(255,255,255,0.94)] shadow-float">
        <div className="flex items-start justify-between border-b border-slate-200/80 px-7 py-5">
          <div>
            <h3 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-950">{title}</h3>
            {description ? <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{description}</p> : null}
          </div>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-7 py-6">{children}</div>
        {footer ? <div className="border-t border-slate-200/80 px-7 py-5">{footer}</div> : null}
      </div>
    </div>
  );
}
