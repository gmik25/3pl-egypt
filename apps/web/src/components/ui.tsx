import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
} from 'react';
import type { LucideIcon } from 'lucide-react';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const styles: Record<string, string> = {
    primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-500 dark:bg-brand-600 dark:hover:bg-brand-500',
    secondary: 'bg-surface-muted text-ink hover:bg-line/70',
    danger: 'bg-red-600 text-white shadow-sm hover:bg-red-500',
    ghost: 'bg-transparent text-body hover:bg-surface-muted',
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    />
  );
}

const fieldStyles =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint shadow-sm transition focus:border-accent focus:ring-2 focus:ring-accent/30 outline-none disabled:opacity-60';

export function TextField({
  label,
  error,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-body mb-1.5">{label}</span>}
      <input {...props} className={`${fieldStyles} ${className}`} />
      {error && <span className="block text-xs text-red-600 dark:text-red-400 mt-1">{error}</span>}
    </label>
  );
}

export function Select({
  label,
  children,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-body mb-1.5">{label}</span>}
      <select {...props} className={`${fieldStyles} bg-surface ${className}`}>
        {children}
      </select>
    </label>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-surface rounded-xl shadow-card border border-line ${className}`}>{children}</div>;
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue' }) {
  const tones: Record<string, string> = {
    slate: 'bg-surface-muted text-body',
    green: 'bg-green-500/15 text-green-700 dark:text-green-400',
    red: 'bg-red-500/15 text-red-700 dark:text-red-400',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    blue: 'bg-accent/15 text-accent',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function Alert({ children, tone = 'red' }: { children: ReactNode; tone?: 'red' | 'green' | 'amber' }) {
  const tones: Record<string, string> = {
    red: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300',
    green: 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
  };
  return <div className={`rounded-lg border px-3 py-2 text-sm ${tones[tone]}`}>{children}</div>;
}

// ---- Loading skeletons + empty state ----

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-muted ${className}`} />;
}

/** Skeleton placeholder for a table/list while data loads. */
export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="p-4 space-y-3.5" aria-hidden>
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={`h-3 ${i === 0 ? 'w-1/4' : 'flex-1'}`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-4 ${c === 0 ? 'w-1/4' : 'flex-1'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton placeholder shaped like a content card. */
export function CardSkeleton({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <Card className={`p-6 ${className}`}>
      <Skeleton className="h-4 w-1/3 mb-4" />
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </Card>
  );
}

/** A grid of stat-card skeletons (dashboards). */
export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-5">
          <Skeleton className="h-3 w-1/2 mb-3" />
          <Skeleton className="h-7 w-2/3" />
        </Card>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className = '',
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 py-12 ${className}`}>
      {Icon && (
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-muted mb-3">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="text-sm text-muted mt-1 max-w-sm">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
