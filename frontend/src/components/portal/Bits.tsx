import { useMemo, useState } from 'react';
import { LuCheck, LuChevronLeft, LuChevronRight, LuCopy } from 'react-icons/lu';
import { numberLocale, useL, useT } from '../../i18n';
import { qrPath } from '../../lib/qr';
import { useLang } from '../../router';
import { Badge } from '../ui/Feedback';

type Tone = 'neutral' | 'bolt' | 'up' | 'down' | 'info' | 'warn';

/** Portal pages render client-side only, so Intl formatting is safe here. */
export function useMoney() {
  const lang = useLang();
  return (n: number | null | undefined, currency = 'USD') =>
    n === null || n === undefined
      ? '—'
      : new Intl.NumberFormat(numberLocale(lang), { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function StatusBadge({ s }: { s: { label: { en: string; ar: string }; tone: Tone } }) {
  const L = useL();
  return <Badge tone={s.tone}>{L(s.label)}</Badge>;
}

export function CopyButton({ value, label, className }: { value: string; label?: string; className?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        });
      }}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-fg-muted transition hover:bg-white/[0.06] hover:text-fg ${className ?? ''}`}
      aria-label={`${t.common.copy}${label ? ` ${label}` : ''}`}
    >
      {copied ? <LuCheck className="h-3.5 w-3.5 text-up" aria-hidden="true" /> : <LuCopy className="h-3.5 w-3.5" aria-hidden="true" />}
      {copied ? t.common.copied : t.common.copy}
    </button>
  );
}

export function QrCode({ value, size = 176, label }: { value: string; size?: number; label: string }) {
  const { path, viewBox } = useMemo(() => qrPath(value), [value]);
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${viewBox} ${viewBox}`} width={size} height={size} className="rounded-xl bg-white" shapeRendering="crispEdges">
      <path d={path} fill="#0A0A0A" />
    </svg>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const L = useL();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-3 pt-4 text-sm" aria-label={L({ en: 'Pagination', ar: 'ترقيم الصفحات' })}>
      <span className="text-fg-subtle">
        {L({ en: `Page ${page} of ${pages}`, ar: `الصفحة ${page} من ${pages}` })}
      </span>
      <span className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-line hover:bg-white/5 disabled:opacity-40" aria-label={L({ en: 'Previous page', ar: 'الصفحة السابقة' })}>
          <LuChevronLeft className="h-4 w-4 rtl:-scale-x-100" />
        </button>
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-line hover:bg-white/5 disabled:opacity-40" aria-label={L({ en: 'Next page', ar: 'الصفحة التالية' })}>
          <LuChevronRight className="h-4 w-4 rtl:-scale-x-100" />
        </button>
      </span>
    </nav>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-down/30 bg-down/10 p-4 text-sm">
      <span className="text-fg-muted">{message}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="font-semibold text-fg hover:text-bolt">
          {t.common.retry}
        </button>
      ) : null}
    </div>
  );
}
