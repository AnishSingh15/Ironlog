'use client';

import { cn } from '@/lib/cn';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { ComponentPropsWithoutRef, ElementRef, forwardRef } from 'react';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 rounded-md bg-surface-3 px-2.5 py-1.5 text-xs font-medium text-text-primary shadow-[var(--il-shadow-float)]',
        'data-[state=delayed-open]:animate-fade-in',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = 'TooltipContent';
