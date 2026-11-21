/**
 * Starter articles (original content).
 *  - Metadata: posts.json (also read by the backend: `python -m app.cli seed-blog`).
 *  - Bodies: <slug>.<lang>.md, loaded on demand.
 * Posts published later from the admin panel are served by the API and merged in at runtime.
 */
import data from './posts.json';

export type PostCategory = 'learn' | 'insights';
export type Motif = 'pairs' | 'lots' | 'risk' | 'mt5' | 'spread' | 'margin' | 'mind' | 'bank' | 'gold' | 'calendar';

export interface PostMeta {
  slug: string;
  category: PostCategory;
  date: string;
  minutes: number;
  title: { en: string; ar: string };
  excerpt: { en: string; ar: string };
  motif: Motif;
}

export const posts = data as PostMeta[];

export const postBySlug = (slug: string) => posts.find((p) => p.slug === slug);

type Loader = () => Promise<{ default: string }>;

/** Lazy Markdown bodies: one chunk per article and language. */
export const bodies: Record<string, { en: Loader; ar: Loader }> = {
  'reading-the-economic-calendar': {
    en: () => import('./reading-the-economic-calendar.en.md?raw'),
    ar: () => import('./reading-the-economic-calendar.ar.md?raw'),
  },
  'trading-gold-what-drives-the-price': {
    en: () => import('./trading-gold-what-drives-the-price.en.md?raw'),
    ar: () => import('./trading-gold-what-drives-the-price.ar.md?raw'),
  },
  'how-central-banks-move-currencies': {
    en: () => import('./how-central-banks-move-currencies.en.md?raw'),
    ar: () => import('./how-central-banks-move-currencies.ar.md?raw'),
  },
  'trading-psychology': {
    en: () => import('./trading-psychology.en.md?raw'),
    ar: () => import('./trading-psychology.ar.md?raw'),
  },
  'margin-calls-and-stop-outs': {
    en: () => import('./margin-calls-and-stop-outs.en.md?raw'),
    ar: () => import('./margin-calls-and-stop-outs.ar.md?raw'),
  },
  'understanding-spreads-and-commissions': {
    en: () => import('./understanding-spreads-and-commissions.en.md?raw'),
    ar: () => import('./understanding-spreads-and-commissions.ar.md?raw'),
  },
  'metatrader-5-beginners-guide': {
    en: () => import('./metatrader-5-beginners-guide.en.md?raw'),
    ar: () => import('./metatrader-5-beginners-guide.ar.md?raw'),
  },
  'risk-management-basics': {
    en: () => import('./risk-management-basics.en.md?raw'),
    ar: () => import('./risk-management-basics.ar.md?raw'),
  },
  'pips-lots-and-leverage': {
    en: () => import('./pips-lots-and-leverage.en.md?raw'),
    ar: () => import('./pips-lots-and-leverage.ar.md?raw'),
  },
  'what-is-forex-trading': {
    en: () => import('./what-is-forex-trading.en.md?raw'),
    ar: () => import('./what-is-forex-trading.ar.md?raw'),
  },
};
