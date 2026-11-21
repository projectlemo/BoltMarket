import clsx from 'clsx';
import type { ReactNode } from 'react';
import { LuCheck, LuX } from 'react-icons/lu';
import { useL } from '../../i18n';
import { checkPassword } from '../../lib/validate';

export function AuthCard({ title, subtitle, children, footer }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold">{title}</h1>
        {subtitle ? <p className="text-fg-muted">{subtitle}</p> : null}
      </div>
      {children}
      {footer ? <div className="text-center text-sm text-fg-muted">{footer}</div> : null}
    </div>
  );
}

export function PasswordChecklist({ value }: { value: string }) {
  const L = useL();
  const c = checkPassword(value);
  const items: [boolean, string][] = [
    [c.length, L({ en: 'At least 10 characters', ar: '10 أحرف على الأقل' })],
    [c.letter, L({ en: 'A letter', ar: 'حرف واحد على الأقل' })],
    [c.number, L({ en: 'A number', ar: 'رقم واحد على الأقل' })],
    [c.notCommon, L({ en: 'Not a common password', ar: 'ليست كلمة مرور شائعة' })],
  ];
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs" aria-live="polite">
      {items.map(([ok, label]) => (
        <li key={label} className={clsx('flex items-center gap-1.5', ok && value ? 'text-up' : 'text-fg-subtle')}>
          {ok && value ? <LuCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <LuX className="h-3.5 w-3.5" aria-hidden="true" />}
          {label}
        </li>
      ))}
    </ul>
  );
}

/** Accept only same-site, relative redirect targets (prevents open redirects). */
export function safeNext(raw: string | null, fallback = '/portal'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('://')) return fallback;
  return raw;
}
