import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
} from 'react';

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
