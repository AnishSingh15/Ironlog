import { clsx } from 'clsx';
import { HTMLAttributes } from 'react';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx('animate-pulse rounded-md bg-surface-2', className)}
      aria-hidden="true"
      {...props}
    />
  );
}
