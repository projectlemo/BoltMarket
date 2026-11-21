import { useEffect, useMemo, useState } from 'react';
import { LuSearch } from 'react-icons/lu';
import { posts, type PostMeta } from '../../content/blog';
import { listCmsPosts, type CmsPost } from '../../content/blog/loader';
import { fmt, useL, useT } from '../../i18n';
import { normalizeSearch } from '../../content/help';
import { Seo } from '../../lib/head';
import { Link, useLang } from '../../router';
import type { PageProps } from '../../routes';
import { PostCard, PostCover } from '../../components/marketing/Blocks';
import { EmptyState } from '../../components/ui/Feedback';
import { PageHero, Section } from '../../components/ui/Section';
import { formatDate } from '../../lib/format';

/** /news shows market insights, /learn shows education. CMS posts are merged in at runtime. */
export default function BlogIndex({ params }: PageProps) {
  const section = params.section === 'news' ? 'news' : 'learn';
  const category: PostMeta['category'] = section === 'news' ? 'insights' : 'learn';
  const L = useL();
  const t = useT();
  const lang = useLang();
  const [cms, setCms] = useState<CmsPost[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    void listCmsPosts(lang).then((list) => alive && setCms(list));
    return () => {
      alive = false;
    };
  }, [lang]);

  const list = useMemo(() => {
    const bundled = posts.filter((p) => p.category === category);
    const known = new Set(bundled.map((p) => p.slug));
    const extra: PostMeta[] = cms
      .filter((c) => c.category === category && !known.has(c.slug))
      .map((c) => ({
        slug: c.slug,
        category: c.category,
        date: c.published_at.slice(0, 10),
        minutes: c.reading_minutes,
        motif: category === 'learn' ? 'lots' : 'calendar',
        title: { en: c.title, ar: c.title },
        excerpt: { en: c.excerpt, ar: c.excerpt },
      }));
    const all = [...extra, ...bundled].sort((a, b) => b.date.localeCompare(a.date));
    const terms = normalizeSearch(q).split(' ').filter(Boolean);
    return terms.length ? all.filter((p) => terms.every((tm) => normalizeSearch(`${L(p.title)} ${L(p.excerpt)}`).includes(tm))) : all;
  }, [cms, category, q, L]);

  const title = section === 'news' ? L({ en: 'Market news & insights', ar: 'أخبار السوق ورؤاه' }) : L({ en: 'Learn to trade', ar: 'تعلّم التداول' });
  const subtitle =
    section === 'news'
      ? L({ en: 'How central banks, data releases and big themes move the markets you trade.', ar: 'كيف تحرّك البنوك المركزية والبيانات الاقتصادية والمواضيع الكبرى الأسواق التي تتداولها.' })
      : L({ en: 'Practical guides from your first pip to position sizing, platform skills and trading psychology.', ar: 'أدلة عملية من أول نقطة إلى تحديد حجم الصفقة ومهارات المنصة وسيكولوجية التداول.' });
  const [featured, ...rest] = list;

  return (
    <>
      <Seo title={title} description={subtitle} />
      <PageHero crumbs={[{ label: section === 'news' ? t.nav.news.label : t.nav.learn.label }]} eyebrow={section === 'news' ? t.nav.news.label : t.nav.learn.label} title={title} subtitle={subtitle}>
        <div className="relative mt-2 w-full max-w-md">
          <LuSearch className="pointer-events-none absolute inset-y-0 start-4 my-auto h-4.5 w-4.5 text-fg-subtle" aria-hidden="true" />
          <label htmlFor="blog-search" className="sr-only">
            {t.common.search}
          </label>
          <input
            id="blog-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={L({ en: 'Search articles', ar: 'ابحث في المقالات' })}
            className="h-12 w-full rounded-xl border border-line-strong bg-surface/80 ps-11 pe-4 text-fg outline-none placeholder:text-fg-subtle focus:border-bolt/70 focus:ring-4 focus:ring-bolt/15"
          />
        </div>
      </PageHero>
      <Section>
        {featured ? (
          <>
            <Link to={`/blog/${featured.slug}`} className="glass glass-hover group mb-8 grid overflow-hidden md:grid-cols-[1.1fr_1fr]">
              <PostCover motif={featured.motif} large className="min-h-56 w-full" />
              <div className="flex flex-col justify-center gap-4 p-6 sm:p-10">
                <p className="text-xs text-fg-subtle">
                  <time dateTime={featured.date}>{formatDate(featured.date, lang)}</time> · {fmt(t.common.minRead, { n: featured.minutes })}
                </p>
                <h2 className="text-2xl leading-tight font-extrabold transition group-hover:text-bolt sm:text-3xl">{L(featured.title)}</h2>
                <p className="text-fg-muted">{L(featured.excerpt)}</p>
                <span className="text-sm font-semibold text-bolt">{t.common.readArticle} →</span>
              </div>
            </Link>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState icon={<LuSearch />} title={L({ en: 'No articles match your search', ar: 'لا توجد مقالات تطابق بحثك' })} />
        )}
        <div className="mt-10 flex justify-center gap-3 text-sm">
          <Link to={section === 'news' ? '/learn' : '/news'} className="link">
            {section === 'news' ? L({ en: 'Browse education articles', ar: 'تصفّح المقالات التعليمية' }) : L({ en: 'Browse market insights', ar: 'تصفّح رؤى السوق' })}
          </Link>
        </div>
      </Section>
    </>
  );
}
