'use client';

import { useTheme } from 'next-themes';
import { Toaster as SonnerToaster } from 'sonner';

export { toast } from 'sonner';

export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            'rounded-lg! border! border-border-default! bg-surface-1! text-text-primary! shadow-[var(--il-shadow-float)]!',
          description: 'text-text-secondary!',
          actionButton: 'bg-accent! text-accent-foreground!',
        },
      }}
    />
  );
}
