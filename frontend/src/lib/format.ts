import type { Lang } from '../router';

/**
 * Deterministic formatters: identical output in Node (prerender) and every browser,
 * so prerendered HTML always hydrates cleanly. Digits stay Latin in Arabic, as on MT5.
 */
export function group(n: number, decimals = 0): string {
  const fixed = Math.abs(n).toFixed(decimals);
  const [int, dec] = fixed.split('.');
  const g = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-' : '') + g + (dec ? '.' + dec : '');
}

const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', JPY: '¥' };

export function money(n: number, currency = 'USD', decimals = 0): string {
  const sym = SYMBOLS[currency];
  const body = group(Math.abs(n), decimals);
  const sign = n < 0 ? '-' : '';
  return sym ? `${sign}${sym}${body}` : `${sign}${body} ${currency}`;
}

export const usd = (n: number, decimals = 0) => money(n, 'USD', decimals);

/** $10K, $100K, $1M */
export function compactUsd(n: number): string {
  if (n >= 1_000_000) return `$${trim(n / 1_000_000)}M`;
  if (n >= 1_000) return `$${trim(n / 1_000)}K`;
  return `$${n}`;
}
const trim = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1).replace(/\.0$/, ''));

export const price = (n: number, digits: number) => n.toFixed(digits);

export function pct(n: number, decimals = 2): string {
  return `${n > 0 ? '+' : ''}${n.toFixed(decimals)}%`;
}

const MONTHS: Record<Lang, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
};

/** "2026-11-02" → "2 November 2026" / "2 نوفمبر 2026" */
export function formatDate(iso: string, lang: Lang): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[lang][Number(m[2]) - 1]} ${m[1]}`;
}

/** Client-only: full date-time in the user's locale (portal tables). */
export function formatDateTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function leverageLabel(n: number) {
  return `1:${n}`;
}
