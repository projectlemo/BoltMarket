import { site } from '../../config/site';
import { bodies, postBySlug, posts, type Motif, type PostCategory } from './index';

/** A post as rendered by the article page, whether bundled or published from the CMS. */
export interface Article {
  slug: string;
  category: PostCategory;
  date: string;
  minutes: number;
  motif: Motif;
  title: string;
  excerpt: string;
  body: string;
  source: 'bundled' | 'cms';
}

export type ArticleData = { found: true; article: Article } | { found: false };

/** Shape returned by GET /api/v1/blog/posts and /api/v1/blog/posts/{slug}. */
export interface CmsPost {
  slug: string;
  language: 'en' | 'ar';
  category: PostCategory;
  title: string;
  excerpt: string;
  body_md?: string;
  published_at: string;
  reading_minutes: number;
}

const wordsPerMinute = 220;
export const readingMinutes = (md: string) => Math.max(1, Math.round(md.split(/\s+/).length / wordsPerMinute));

async function fetchJson<T>(path: string): Promise<T | null> {
  if (!site.apiUrl) return null;
  try {
    const res = await fetch(`${site.apiUrl}/api/v1${path}`, { headers: { Accept: 'application/json' } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function loadArticle(slug: string, lang: 'en' | 'ar'): Promise<ArticleData> {
  // CMS edits of starter articles take precedence when the API is reachable.
  const cms = await fetchJson<CmsPost>(`/blog/posts/${encodeURIComponent(slug)}?lang=${lang}`);
  if (cms?.body_md) {
    const meta = postBySlug(slug);
    return {
      found: true,
      article: {
        slug,
        category: cms.category,
        date: cms.published_at.slice(0, 10),
        minutes: cms.reading_minutes || readingMinutes(cms.body_md),
        motif: meta?.motif ?? (cms.category === 'learn' ? 'lots' : 'calendar'),
        title: cms.title,
        excerpt: cms.excerpt,
        body: cms.body_md,
        source: 'cms',
      },
    };
  }
  const meta = postBySlug(slug);
  const loader = bodies[slug]?.[lang];
  if (!meta || !loader) return { found: false };
  const body = (await loader()).default;
  return {
    found: true,
    article: { slug, category: meta.category, date: meta.date, minutes: meta.minutes, motif: meta.motif, title: meta.title[lang], excerpt: meta.excerpt[lang], body, source: 'bundled' },
  };
}

/** Published CMS posts (for listings), newest first. */
export async function listCmsPosts(lang: 'en' | 'ar'): Promise<CmsPost[]> {
  const res = await fetchJson<{ items: CmsPost[] }>(`/blog/posts?lang=${lang}&limit=100`);
  return res?.items ?? [];
}

/** Slugs to prerender: bundled posts plus CMS posts published at build time. */
export async function allSlugs(): Promise<string[]> {
  const slugs = new Set(posts.map((p) => p.slug));
  for (const lang of ['en', 'ar'] as const) for (const p of await listCmsPosts(lang)) slugs.add(p.slug);
  return [...slugs];
}
