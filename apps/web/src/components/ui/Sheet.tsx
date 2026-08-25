'use client';

import { cn } from '@/lib/cn';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Close as CloseIcon } from '@mui/icons-material';
import { ComponentPropsWithoutRef, ElementRef, forwardRef } from 'react';
import { DialogOverlay } from './Dialog';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;

// Slides up from the bottom - the mobile-friendly counterpart to Dialog, used for
// action sheets and pickers (see DESIGN.md primitive inventory).
export const SheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto',
        'rounded-t-xl border-t border-border-default bg-surface-1 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]',
        'data-[state=open]:animate-slide-up focus:outline-none',
        className
      )}
      {...props}
    >
      <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-border-strong" />
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <CloseIcon fontSize="small" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = 'SheetContent';

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex flex-col gap-1', className)} {...props} />;
}

export const SheetTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-base font-semibold text-text-primary', className)}
    {...props}
  />
));
SheetTitle.displayName = 'SheetTitle';
