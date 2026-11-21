import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useHydrated } from '../../lib/hydration';
import { Link } from '../../router';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap select-none transition duration-200 ease-out disabled:pointer-events-none disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary:
    'btn-shine bg-bolt text-bolt-ink hover:bg-bolt-300 active:bg-bolt-600 shadow-[0_0_0_1px_rgb(255_212_0/0.45),0_10px_30px_-10px_rgb(255_212_0/0.55)] hover:shadow-[0_0_0_1px_rgb(255_212_0/0.7),0_14px_36px_-8px_rgb(255_212_0/0.6)]',
  secondary: 'bg-white/[0.06] text-fg border border-white/12 hover:bg-white/[0.1] hover:border-white/25',
  ghost: 'text-fg-muted hover:text-fg hover:bg-white/[0.06]',
  outline: 'border border-bolt/50 text-bolt hover:bg-bolt/10 hover:border-bolt',
  danger: 'bg-down/15 text-down border border-down/30 hover:bg-down/25',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-[0.95rem]',
  lg: 'h-13 px-7 text-base',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return clsx(base, variants[variant], sizes[size], extra);
}

interface Common {
  variant?: Variant;
  size?: Size;
  className?: string;
  children?: ReactNode;
}

interface LinkButtonProps extends Common {
  to: string;
  onClick?: () => void;
  'aria-label'?: string;
}

interface NativeButtonProps extends Common, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  loading?: boolean;
  /** The form works without JavaScript (has an action), so it may be submitted before hydration. */
  allowNative?: boolean;
}

/** Link styled as a button (internal routes or external URLs). */
export function ButtonLink({ to, variant, size, className, children, onClick, ...aria }: LinkButtonProps) {
  return (
    <Link to={to} className={buttonClass(variant, size, className)} onClick={onClick} {...aria}>
      {children}
    </Link>
  );
}

export function Button({ variant, size, className, children, loading, type, disabled, allowNative, ...rest }: NativeButtonProps) {
  const hydrated = useHydrated();
  return (
    <button
      {...rest}
      type={type ?? 'button'}
      // Submit buttons wait for hydration so a form is never submitted natively.
      disabled={disabled || loading || (type === 'submit' && !allowNative && !hydrated)}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
