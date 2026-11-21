import clsx from 'clsx';
import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { LuEye, LuEyeOff, LuChevronDown } from 'react-icons/lu';
import { useHydrated } from '../../lib/hydration';

const control =
  'w-full rounded-xl border bg-surface-2/80 px-4 text-fg placeholder:text-fg-subtle transition outline-none focus:border-bolt/70 focus:ring-4 focus:ring-bolt/15 disabled:opacity-60';

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
  optional,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
  htmlFor: string;
  optional?: string;
}) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
        {label}
        {optional ? <span className="ms-1.5 font-normal text-fg-subtle">({optional})</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-down">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: string;
  suffix?: ReactNode;
  fieldClassName?: string;
};

export function TextField({ label, hint, error, optional, suffix, id, className, fieldClassName, disabled, ...rest }: InputProps) {
  const auto = useId();
  const hydrated = useHydrated();
  const fid = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={fid} optional={optional} className={fieldClassName}>
      <div className="relative">
        <input
          id={fid}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
          className={clsx(control, 'h-12', error ? 'border-down/70' : 'border-line-strong', suffix ? 'pe-16' : '', className)}
          disabled={disabled || !hydrated}
          {...rest}
        />
        {suffix ? <span className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-sm text-fg-subtle">{suffix}</span> : null}
      </div>
    </Field>
  );
}

export function PasswordField({ label, hint, error, id, showLabel, hideLabel, disabled, ...rest }: InputProps & { showLabel: string; hideLabel: string }) {
  const auto = useId();
  const hydrated = useHydrated();
  const fid = id ?? auto;
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} hint={hint} error={error} htmlFor={fid}>
      <div className="relative">
        <input
          id={fid}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
          className={clsx(control, 'h-12 pe-12', error ? 'border-down/70' : 'border-line-strong')}
          disabled={disabled || !hydrated}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 end-1.5 my-1.5 grid w-10 place-items-center rounded-lg text-fg-subtle transition hover:bg-white/5 hover:text-fg"
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
        >
          {visible ? <LuEyeOff className="h-4.5 w-4.5" /> : <LuEye className="h-4.5 w-4.5" />}
        </button>
      </div>
    </Field>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  fieldClassName?: string;
  children: ReactNode;
};

export function SelectField({ label, hint, error, id, children, className, fieldClassName, disabled, ...rest }: SelectProps) {
  const auto = useId();
  const hydrated = useHydrated();
  const fid = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={fid} className={fieldClassName}>
      <div className="relative">
        <select
          id={fid}
          aria-invalid={error ? true : undefined}
          className={clsx(control, 'h-12 appearance-none pe-10', error ? 'border-down/70' : 'border-line-strong', className)}
          disabled={disabled || !hydrated}
          {...rest}
        >
          {children}
        </select>
        <LuChevronDown className="pointer-events-none absolute inset-y-0 end-3.5 my-auto h-4 w-4 text-fg-subtle" aria-hidden="true" />
      </div>
    </Field>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  fieldClassName?: string;
};

export function TextareaField({ label, hint, error, id, className, fieldClassName, disabled, ...rest }: TextareaProps) {
  const auto = useId();
  const hydrated = useHydrated();
  const fid = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={fid} className={fieldClassName}>
      <textarea
        id={fid}
        aria-invalid={error ? true : undefined}
        className={clsx(control, 'min-h-36 py-3 leading-relaxed', error ? 'border-down/70' : 'border-line-strong', className)}
        disabled={disabled || !hydrated}
        {...rest}
      />
    </Field>
  );
}

export function Checkbox({
  label,
  error,
  id,
  disabled,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string | null }) {
  const auto = useId();
  const hydrated = useHydrated();
  const fid = id ?? auto;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fid} className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-fg-muted">
        <input
          id={fid}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          className="mt-0.5 h-4.5 w-4.5 shrink-0 cursor-pointer rounded border-line-strong bg-surface-2 accent-bolt"
          disabled={disabled || !hydrated}
          {...rest}
        />
        <span>{label}</span>
      </label>
      {error ? (
        <p role="alert" className="ps-7.5 text-sm text-down">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Segmented control (radio group styled as pills). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  className?: string;
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={clsx('inline-flex rounded-xl border border-line-strong bg-surface-2/80 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <label
            key={o.value}
            className={clsx(
              'cursor-pointer rounded-lg px-3.5 py-1.5 text-sm font-semibold transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-bolt',
              active ? 'bg-bolt text-bolt-ink' : 'text-fg-muted hover:text-fg',
            )}
          >
            <input type="radio" name={name} value={o.value} checked={active} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}
