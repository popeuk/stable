import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}

/** Inviting, never discouraging empty states (section 16.2). */
export function EmptyState({ title, body, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      {icon && (
        <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]">
          {icon}
        </div>
      )}
      <h2 className="font-[family-name:var(--font-fraunces)] text-xl text-primary">
        {title}
      </h2>
      <p className="mt-2 max-w-xs text-sm text-secondary">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
