/**
 * Tiny head manager. During prerender the <Seo> data is collected and serialised into
 * the static HTML; in the browser the same tags are applied on every navigation.
 */
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { site } from '../config/site';
import { BASE, toHref, useRouter, type Lang } from '../router';

export interface HeadInput {
  title: string;
  description?: string;
  noindex?: boolean;
  type?: 'website' | 'article';
  jsonLd?: Record<string, unknown>[];
  publishedTime?: string;
}

export type HeadData = HeadInput & { lang: Lang; path: string; private?: boolean };

export interface HeadCollector {
  data: HeadData | null;
}

const HeadCtx = createContext<HeadCollector | null>(null);

export function HeadProvider({ collector, children }: { collector?: HeadCollector; children: ReactNode }) {
  return <HeadCtx.Provider value={collector ?? null}>{children}</HeadCtx.Provider>;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const fullTitle = (title: string) => (title === site.brand ? title : `${title} | ${site.brand}`);

export function absoluteUrl(path: string, lang: Lang) {
  if (!site.url) return '';
  return site.url + toHref(path, lang).slice(BASE.length);
}

/** Serialise head tags (everything except <title>, which is handled separately). */
export function headTags(d: HeadData): string {
  const tags: string[] = [];
  const noindex = d.noindex || d.private;
  if (d.description) tags.push(`<meta data-h name="description" content="${esc(d.description)}">`);
  if (noindex) tags.push(`<meta data-h name="robots" content="noindex, nofollow">`);
  const canonical = absoluteUrl(d.path, d.lang);
  if (canonical && !noindex) {
    tags.push(`<link data-h rel="canonical" href="${canonical}">`);
    tags.push(`<link data-h rel="alternate" hreflang="en" href="${absoluteUrl(d.path, 'en')}">`);
    tags.push(`<link data-h rel="alternate" hreflang="ar" href="${absoluteUrl(d.path, 'ar')}">`);
    tags.push(`<link data-h rel="alternate" hreflang="x-default" href="${absoluteUrl(d.path, 'en')}">`);
  }
  const ogTitle = esc(fullTitle(d.title));
  tags.push(`<meta data-h property="og:title" content="${ogTitle}">`);
  if (d.description) tags.push(`<meta data-h property="og:description" content="${esc(d.description)}">`);
  tags.push(`<meta data-h property="og:type" content="${d.type ?? 'website'}">`);
  tags.push(`<meta data-h property="og:site_name" content="${site.brand}">`);
  tags.push(`<meta data-h property="og:locale" content="${d.lang === 'ar' ? 'ar_AR' : 'en_US'}">`);
  if (canonical) tags.push(`<meta data-h property="og:url" content="${canonical}">`);
  if (site.url) {
    tags.push(`<meta data-h property="og:image" content="${site.url}/og-image.png">`);
    tags.push(`<meta data-h name="twitter:image" content="${site.url}/og-image.png">`);
  }
  tags.push(`<meta data-h name="twitter:card" content="summary_large_image">`);
  if (d.publishedTime) tags.push(`<meta data-h property="article:published_time" content="${esc(d.publishedTime)}">`);
  for (const ld of d.jsonLd ?? []) {
    tags.push(`<script data-h type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`);
  }
  return tags.join('\n    ');
}

function applyHead(d: HeadData) {
  document.title = fullTitle(d.title);
  document.head.querySelectorAll('[data-h]').forEach((n) => n.remove());
  const tpl = document.createElement('template');
  tpl.innerHTML = headTags(d);
  document.head.append(tpl.content);
}

export function Seo(props: HeadInput) {
  const collector = useContext(HeadCtx);
  const { state } = useRouter();
  const data: HeadData = { ...props, lang: state.lang, path: state.path, private: state.match.route.private };
  if (collector && typeof window === 'undefined') collector.data = data;
  const key = JSON.stringify(data);
  useEffect(() => {
    applyHead(JSON.parse(key) as HeadData);
  }, [key]);
  return null;
}
