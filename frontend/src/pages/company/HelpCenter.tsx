import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { LuMessageCircle, LuSearch, LuTicket, LuX } from 'react-icons/lu';
import { helpArticles, helpCategories, searchHelp, type HelpCategory } from '../../content/help';
import { fmt, useL, useT } from '../../i18n';
import { Seo } from '../../lib/head';
import { useLang, useSearchParams } from '../../router';
import { ButtonLink } from '../../components/ui/Button';
import { Accordion, faqJsonLd } from '../../components/ui/Disclosure';
import { EmptyState } from '../../components/ui/Feedback';
import { BoltLines } from '../../components/ui/Brand';
import { Section } from '../../components/ui/Section';

export default function HelpCenter() {
  const L = useL();
  const t = useT();
  const lang = useLang();
  // Prerendered pages have no query string, so a ?q= search is applied after hydration.
  const requested = useSearchParams().get('q') ?? '';
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (requested) setQuery(requested);
  }, [requested]);
  const [cat, setCat] = useState<HelpCategory | 'all'>('all');
  const results = useMemo(() => searchHelp(query, lang, cat), [query, lang, cat]);

  return (
    <>
      <Seo
        title={t.common.helpCenter}
        description={L({
          en: 'Answers about opening and verifying your account, deposits and withdrawals, MetaTrader 5, Bolt Funded and security.',
          ar: 'إجابات عن فتح الحساب والتحقق منه والإيداع والسحب وميتاتريدر 5 وبرنامج التمويل والأمان.',
        })}
        jsonLd={[faqJsonLd(helpArticles.map((a) => ({ q: a.q[lang], a: a.a[lang] })))]}
      />
      <section className="relative overflow-hidden border-b border-line/60">
        <div className="bg-grid absolute inset-0" aria-hidden="true" />
        <div className="bg-glow absolute inset-0" aria-hidden="true" />
        <BoltLines className="absolute inset-x-0 bottom-0 h-40 w-full opacity-60" />
        <div className="container-x relative flex flex-col items-center gap-6 py-16 text-center sm:py-20">
          <h1 className="text-4xl font-extrabold sm:text-5xl">{L({ en: 'How can we help?', ar: 'كيف يمكننا مساعدتك؟' })}</h1>
          <div className="relative w-full max-w-2xl">
            <LuSearch className="pointer-events-none absolute inset-y-0 start-5 my-auto h-5 w-5 text-fg-subtle" aria-hidden="true" />
            <label htmlFor="help-search" className="sr-only">
              {t.common.search}
            </label>
            <input
              id="help-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={L({ en: 'Search: withdrawal, 2FA, MT5 password…', ar: 'ابحث: السحب، المصادقة الثنائية، كلمة مرور ميتاتريدر…' })}
              className="h-14 w-full rounded-2xl border border-line-strong bg-surface/90 ps-13 pe-12 text-base text-fg shadow-[0_20px_40px_-20px_rgb(0_0_0/0.8)] outline-none placeholder:text-fg-subtle focus:border-bolt/70 focus:ring-4 focus:ring-bolt/15"
              autoComplete="off"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={L({ en: 'Clear search', ar: 'مسح البحث' })}
                className="absolute inset-y-0 end-3 my-auto grid h-8 w-8 place-items-center rounded-lg text-fg-subtle hover:bg-white/5 hover:text-fg"
              >
                <LuX className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label={L({ en: 'Filter by topic', ar: 'تصفية حسب الموضوع' })}>
            {[{ id: 'all' as const, label: { en: 'All topics', ar: 'كل المواضيع' } }, ...helpCategories].map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={cat === c.id}
                onClick={() => setCat(c.id)}
                className={clsx(
                  'rounded-full border px-3.5 py-1.5 text-sm font-semibold transition',
                  cat === c.id ? 'border-bolt bg-bolt text-bolt-ink' : 'border-white/12 text-fg-muted hover:border-white/30 hover:text-fg',
                )}
              >
                {L(c.label)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <p className="mb-5 text-sm text-fg-subtle" aria-live="polite">
            {fmt(L({ en: '{n} answers', ar: '{n} إجابة' }), { n: results.length })}
          </p>
          {results.length ? (
            cat === 'all' && !query ? (
              <div className="flex flex-col gap-10">
                {helpCategories.map((c) => (
                  <div key={c.id}>
                    <h2 className="mb-4 text-xl font-bold">{L(c.label)}</h2>
                    <Accordion items={results.filter((a) => a.category === c.id).map((a) => ({ q: L(a.q), a: L(a.a) }))} />
                  </div>
                ))}
              </div>
            ) : (
              <Accordion items={results.map((a) => ({ q: L(a.q), a: L(a.a) }))} />
            )
          ) : (
            <EmptyState
              icon={<LuSearch />}
              title={L({ en: 'No answers match your search', ar: 'لا توجد إجابات تطابق بحثك' })}
              action={
                <ButtonLink to="/company/contact" variant="secondary">
                  {t.common.contactUs}
                </ButtonLink>
              }
            >
              {L({ en: 'Try different words, or send us a message.', ar: 'جرّب كلمات مختلفة أو أرسل لنا رسالة.' })}
            </EmptyState>
          )}
        </div>
      </Section>

      <Section>
        <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
          <div className="glass flex flex-col gap-3 p-6">
            <LuTicket className="h-6 w-6 text-bolt" aria-hidden="true" />
            <h2 className="text-lg font-bold">{L({ en: 'Already a client?', ar: 'هل أنت عميل حالي؟' })}</h2>
            <p className="text-sm text-fg-muted">{L({ en: 'Open a support ticket from the portal and track the reply.', ar: 'افتح تذكرة دعم من البوابة وتابع الرد عليها.' })}</p>
            <ButtonLink to="/portal/support" variant="secondary" className="mt-auto self-start">
              {L({ en: 'Open a ticket', ar: 'افتح تذكرة' })}
            </ButtonLink>
          </div>
          <div className="glass flex flex-col gap-3 p-6">
            <LuMessageCircle className="h-6 w-6 text-bolt" aria-hidden="true" />
            <h2 className="text-lg font-bold">{L({ en: 'Still need help?', ar: 'ما زلت بحاجة إلى مساعدة؟' })}</h2>
            <p className="text-sm text-fg-muted">{L({ en: 'Write to us and the right team will reply by email.', ar: 'راسلنا وسيرد عليك الفريق المختص عبر البريد.' })}</p>
            <ButtonLink to="/company/contact" variant="secondary" className="mt-auto self-start">
              {t.common.contactUs}
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
