import { clsx } from 'clsx';
import { HTMLAttributes } from 'react';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

// Semantic tones map to their exact meaning only (PR = success, plateau = warning,
// missed/deload = danger) - never used decoratively. See DESIGN.md Section 3/14.
const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-text-secondary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  accent: 'bg-accent/10 text-accent',
};

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
