import type { ReactNode } from 'react';

/**
 * Placeholder shown when a list/section has no rows. Optional `action` slot for
 * a CTA (e.g. "Add contact"). Pure presentational.
 */
export interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, message, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className ?? ''}`}
      data-testid="empty-state"
    >
      {icon && <div className="mb-3 text-green-800/40">{icon}</div>}
      <p className="font-serif text-lg text-green-900">{title}</p>
      {message && <p className="mt-1 text-sm text-green-800/70 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
