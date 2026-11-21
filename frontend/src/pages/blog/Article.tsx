import { LuArrowLeft, LuCalculator } from 'react-icons/lu';
import { posts } from '../../content/blog';
import type { ArticleData } from '../../content/blog/loader';
import { fmt, useL, useT } from '../../i18n';
import { formatDate } from '../../lib/format';
import { Seo, absoluteUrl } from '../../lib/head';
import { site } from '../../config/site';
import { Link, useLang, useRouter } from '../../router';
import type { PageProps } from '../../routes';
import { CtaButtons, PostCard, PostCover } from '../../components/marketing/Blocks';
import { ButtonLink } from '../../components/ui/Button';
import { Prose, useHeadings } from '../../components/ui/Prose';
import { CtaBand, Section } from '../../components/ui/Section';
import { LangSwitch } from '../../components/layout/Header';

export default function Article({ data }: PageProps) {
  const L = useL();
  const t = useT();
  const lang = useLang();
  const { state } = useRouter();
  const res = data as ArticleData | undefined;
  const headings = useHeadings(res?.found ? res.article.body : '');

  if (!res?.found) {
    return (
      <Section>
        <Seo title={L({ en: 'Article not found', ar: 'المقال غير موجود' })} noindex />
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
          <h1 className="text-3xl font-bold">{L({ en: 'This article is not available', ar: 'هذا المقال غير متاح' })}</h1>
          <p className="text-fg-muted">
            {L({ en: 'It may have been unpublished, or it is not available in this language.', ar: 'ربما أُلغي نشره، أو أنه غير متاح بهذه اللغة.' })}
          </p>
          <div className="flex items-center gap-3">
            <ButtonLink to="/learn">{t.nav.learn.label}</ButtonLink>
            <LangSwitch full />
          </div>
        </div>
      </Section>
    );
  }

  const a = res.article;
  const related = posts.filter((p) => p.slug !== a.slug && p.category === a.category).slice(0, 3);
  const sectionPath = a.category === 'learn' ? '/learn' : '/news';
  const sectionLabel = a.category === 'learn' ? t.nav.learn.label : t.nav.news.label;

  return (
    <>
      <Seo
        title={a.title}
        description={a.excerpt}
        type="article"
        publishedTime={a.date}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: a.title,
            description: a.excerpt,
            datePublished: a.date,
            inLanguage: lang,
            author: { '@type': 'Organization', name: site.brand },
            publisher: { '@type': 'Organization', name: site.brand },
            ...(site.url ? { mainEntityOfPage: absoluteUrl(state.path, lang) } : {}),
          },
        ]}
      />
      <article>
        <header className="relative overflow-hidden border-b border-line/60">
          <div className="bg-grid absolute inset-0" aria-hidden="true" />
          <div className="container-x relative grid items-center gap-10 py-12 lg:grid-cols-[1.3fr_1fr] lg:py-16">
            <div className="flex flex-col gap-5">
              <Link to={sectionPath} className="inline-flex items-center gap-2 text-sm font-semibold text-bolt">
                <LuArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                {sectionLabel}
              </Link>
              <h1 className="text-3xl leading-tight font-extrabold sm:text-4xl lg:text-5xl">{a.title}</h1>
              <p className="text-lg text-fg-muted">{a.excerpt}</p>
              <p className="text-sm text-fg-subtle">
                {site.brand} · <time dateTime={a.date}>{formatDate(a.date, lang)}</time> · {fmt(t.common.minRead, { n: a.minutes })}
              </p>
            </div>
            <PostCover motif={a.motif} large className="hidden aspect-[4/3] rounded-3xl border border-white/8 lg:block" />
          </div>
        </header>
        <div className="container-x grid gap-12 py-12 lg:grid-cols-[minmax(0,1fr)_16rem] lg:py-16">
          <div className="min-w-0 max-w-3xl">
            <Prose markdown={a.body} />
            <div className="mt-12 rounded-2xl border border-white/8 bg-white/[0.02] p-5 text-sm leading-relaxed text-fg-subtle">
              {L({
                en: 'This article is general information for educational purposes and is not investment advice or a recommendation to trade any instrument. Trading leveraged products carries a high risk of loss.',
                ar: 'هذا المقال معلومات عامة لأغراض تعليمية وليس نصيحة استثمارية أو توصية بتداول أي أداة. ينطوي تداول المنتجات ذات الرافعة المالية على مخاطر خسارة عالية.',
              })}
            </div>
          </div>
          <aside className="hidden lg:block">
            <div className="sticky top-24 flex flex-col gap-6">
              {headings.length ? (
                <nav aria-label={t.common.onThisPage} className="glass p-5">
                  <p className="mb-3 text-xs font-semibold tracking-wide text-fg-subtle uppercase">{t.common.onThisPage}</p>
                  <ul className="flex flex-col gap-2 text-sm">
                    {headings
                      .filter((h) => h.level === 2)
                      .map((h) => (
                        <li key={h.id}>
                          <a href={`#${h.id}`} className="text-fg-muted transition hover:text-bolt">
                            {h.text}
                          </a>
                        </li>
                      ))}
                  </ul>
                </nav>
              ) : null}
              <div className="glass flex flex-col gap-3 p-5">
                <LuCalculator className="h-5 w-5 text-bolt" aria-hidden="true" />
                <p className="font-semibold">{L({ en: 'Try the numbers', ar: 'جرّب الأرقام بنفسك' })}</p>
                <p className="text-sm text-fg-muted">{L({ en: 'Use our free calculators to size and plan your next trade.', ar: 'استخدم حاسباتنا المجانية لتحديد حجم صفقتك التالية والتخطيط لها.' })}</p>
                <ButtonLink to="/tools" size="sm" variant="secondary">
                  {t.nav.tools.label}
                </ButtonLink>
              </div>
            </div>
          </aside>
        </div>
      </article>
      {related.length ? (
        <Section className="pt-0 sm:pt-0 lg:pt-0">
          <h2 className="mb-6 text-2xl font-bold">{L({ en: 'Keep reading', ar: 'تابع القراءة' })}</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {related.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        </Section>
      ) : null}
      <CtaBand title={L({ en: 'Put it into practice', ar: 'طبّق ما تعلّمته' })} subtitle={L({ en: 'Start on a free demo, then go live when you are ready.', ar: 'ابدأ بحساب تجريبي مجاني، ثم انتقل إلى الحساب الحقيقي عندما تكون مستعدًا.' })} actions={<CtaButtons />} />
    </>
  );
}
