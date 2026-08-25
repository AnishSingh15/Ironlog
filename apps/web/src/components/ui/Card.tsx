import { clsx } from 'clsx';
import { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg';
}

export function Card({ className, padding = 'md', ...props }: CardProps) {
  const paddingClasses = { sm: 'p-4', md: 'p-5', lg: 'p-6' }[padding];
  return (
    <div
      className={clsx(
        'rounded-xl border border-border-default bg-surface-1 shadow-[var(--il-shadow-float)]',
        paddingClasses,
        className
      )}
      {...props}
    />
  );
}
