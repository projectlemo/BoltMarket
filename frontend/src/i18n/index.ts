import { useLang, type Lang } from '../router';
import { en } from './en';
import { ar } from './ar';

export type Dict = typeof en;
export type { Lang };

const dicts: Record<Lang, Dict> = { en, ar };

export const dictFor = (lang: Lang): Dict => dicts[lang];

/** Shared UI dictionary for the current language. */
export function useT(): Dict {
  return dicts[useLang()];
}

/** Localised value picker: `const L = useL(); L({ en: 'Hi', ar: 'مرحبا' })`. */
export function useL() {
  const lang = useLang();
  return <T,>(v: { en: T; ar: T }): T => v[lang];
}

/** "{n} min read" → fmt(str, { n: 4 }) */
export function fmt(str: string, vars: Record<string, string | number>) {
  return str.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

export const dirOf = (lang: Lang) => (lang === 'ar' ? 'rtl' : 'ltr');

/** Locale used for numbers: Arabic text with Latin digits, the convention on trading platforms. */
export const numberLocale = (lang: Lang) => (lang === 'ar' ? 'ar-u-nu-latn' : 'en-US');
