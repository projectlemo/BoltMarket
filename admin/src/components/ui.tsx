import clsx from 'clsx';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { LuChevronLeft, LuChevronRight, LuCircleAlert, LuCircleCheck, LuX } from 'react-icons/lu';
import { qrPath } from '../../../frontend/src/lib/qr';
import type { ApiError } from '../lib/api';

// --- buttons ------------------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  size = 'md',
  busy,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; busy?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
        variant === 'primary' && 'bg-bolt text-bolt-ink hover:bg-bolt-300',
        variant === 'secondary' && 'border border-line-strong bg-surface-2 text-fg hover:bg-surface-3',
        variant === 'ghost' && 'text-fg-muted hover:bg-white/5 hover:text-fg',
        variant === 'danger' && 'border border-down/40 bg-down/10 text-down hover:bg-down/20',
        className,
      )}
    >
      {busy && <span className="spinner" aria-hidden />}
      {children}
    </button>
  );
}

// --- form fields --------------------------------------------------------------------------------------

export function Field({ label, error, hint, children, id }: { label: string; error?: string; hint?: string; children: ReactNode; id: string }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-down" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({ label, error, hint, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} id={id}>
      <input id={id} className={clsx('input', error && 'border-down')} aria-invalid={!!error || undefined} {...rest} />
    </Field>
  );
}

export function TextArea({ label, error, hint, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} id={id}>
      <textarea id={id} className={clsx('input min-h-24', error && 'border-down')} aria-invalid={!!error || undefined} {...rest} />
    </Field>
  );
}

export function Select({
  label,
  error,
  options,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; options: { value: string; label: string }[] }) {
  const id = useId();
  return (
    <Field label={label} error={error} id={id}>
      <select id={id} className="input" {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex items-center gap-2 text-sm text-fg-muted">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input h-10 w-auto py-0 pe-8" aria-label={label}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// --- display ------------------------------------------------------------------------------------------

const TONES: Record<string, string> = {
  green: 'bg-up/12 text-up border-up/30',
  red: 'bg-down/12 text-down border-down/30',
  yellow: 'bg-bolt/12 text-bolt border-bolt/30',
  orange: 'bg-warn/12 text-warn border-warn/30',
  blue: 'bg-info/12 text-info border-info/30',
  grey: 'bg-white/5 text-fg-muted border-line-strong',
};

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  active: 'green', approved: 'green', completed: 'green', accepted: 'green', published: 'green', funded: 'green', answered: 'blue', handled: 'grey',
  pending: 'orange', awaiting_payment: 'orange', processing: 'blue', pending_activation: 'orange', draft: 'grey', open: 'yellow', new: 'yellow',
  uploaded: 'blue', phase1: 'blue', phase2: 'blue',
  suspended: 'red', rejected: 'red', failed: 'red', disabled: 'red', cancelled: 'grey', closed: 'grey', none: 'grey',
};

export function Badge({ children, tone = 'grey' }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return <span className={clsx('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap', TONES[tone])}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? 'grey'}>{status.replace(/_/g, ' ')}</Badge>;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-fg-subtle" role="status">
      <span className="spinner h-5 w-5" aria-hidden />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function ErrorNote({ error, onRetry }: { error: ApiError | string | null | undefined; onRetry?: () => void }) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-down/30 bg-down/10 px-4 py-3 text-sm text-down">
      <LuCircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-semibold underline">
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-fg-subtle">{children}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-fg-subtle">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, actions, children, className }: { title: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('card', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <h2 className="text-base font-bold">{title}</h2>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Dl({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{k}</dt>
          <dd className="mt-0.5 break-words">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

// --- table -----------------------------------------------------------------------------------------------

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export function Table<T extends { id: number }>({ rows, columns, onRow, empty }: { rows: T[]; columns: Column<T>[]; onRow?: (row: T) => void; empty: ReactNode }) {
  if (!rows.length) return <div>{empty}</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead className="border-b border-line bg-surface-2/60">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={clsx('th', c.className)} scope="col">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRow ? () => onRow(row) : undefined}
              onKeyDown={onRow ? (e) => (e.key === 'Enter' ? onRow(row) : undefined) : undefined}
              tabIndex={onRow ? 0 : undefined}
              className={clsx('border-b border-line last:border-0', onRow && 'cursor-pointer hover:bg-white/[0.03] focus:bg-white/[0.04]')}
            >
              {columns.map((c) => (
                <td key={c.key} className={clsx('td', c.className)}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-fg-subtle">
      <span>
        {total.toLocaleString('en-US')} result{total === 1 ? '' : 's'} · page {page} of {pages}
      </span>
      <span className="flex gap-2">
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <LuChevronLeft className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <LuChevronRight className="h-4 w-4" />
        </Button>
      </span>
    </div>
  );
}

// --- modal ---------------------------------------------------------------------------------------------------

export function Modal({ title, open, onClose, children, wide }: { title: string; open: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className={clsx('m-auto w-[calc(100%-2rem)] rounded-2xl border border-line-strong bg-surface p-0 text-fg backdrop:bg-black/70', wide ? 'max-w-3xl' : 'max-w-lg')}
    >
      {open && (
        <div>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-lg font-bold">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-fg-subtle hover:bg-white/5 hover:text-fg" aria-label="Close">
              <LuX className="h-5 w-5" />
            </button>
          </div>
          <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

// --- toasts ---------------------------------------------------------------------------------------------------

interface Toast {
  id: number;
  kind: 'ok' | 'error';
  text: string;
}

const ToastCtx = createContext<(kind: Toast['kind'], text: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-2xl [animation:toast-in_.2s_ease-out]',
              t.kind === 'ok' ? 'border-up/30 bg-surface-2 text-fg' : 'border-down/40 bg-surface-2 text-down',
            )}
          >
            {t.kind === 'ok' ? <LuCircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-up" /> : <LuCircleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

// --- misc --------------------------------------------------------------------------------------------------------

export function Stat({ label, value, hint, href, tone }: { label: string; value: ReactNode; hint?: ReactNode; href?: string; tone?: 'attention' }) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{label}</p>
      <p className={clsx('mt-2 font-display text-2xl font-extrabold tabular-nums', tone === 'attention' && 'text-bolt')}>{value}</p>
      {hint && <p className="mt-1 text-xs text-fg-subtle">{hint}</p>}
    </>
  );
  return href ? (
    <a href={`#${href}`} className="card block p-5 transition-colors hover:border-line-strong hover:bg-surface-2">
      {body}
    </a>
  ) : (
    <div className="card p-5">{body}</div>
  );
}

export function QrCode({ value, size = 176 }: { value: string; size?: number }) {
  const { path, viewBox } = useMemo(() => qrPath(value), [value]);
  return (
    <svg role="img" aria-label="QR code for your authenticator app" viewBox={`0 0 ${viewBox} ${viewBox}`} width={size} height={size} className="rounded-xl bg-white" shapeRendering="crispEdges">
      <path d={path} fill="#0A0A0A" />
    </svg>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="input h-10 w-full sm:w-72" />;
}
