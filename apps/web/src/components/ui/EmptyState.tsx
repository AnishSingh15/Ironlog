import { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-default px-6 py-12 text-center">
      {icon && <div className="mb-3 text-text-tertiary">{icon}</div>}
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-text-secondary">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
