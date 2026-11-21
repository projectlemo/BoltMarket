import { LuFileText, LuTriangleAlert } from 'react-icons/lu';
import { legalMeta, type LegalData, type LegalDoc } from '../../content/legal';
import { site } from '../../config/site';
import { useL, useT } from '../../i18n';
import { Seo } from '../../lib/head';
import { Link, isActivePath, useRouter } from '../../router';
import type { PageProps } from '../../routes';
import { Prose, useHeadings } from '../../components/ui/Prose';
import { PageHero, Section } from '../../components/ui/Section';

export default function LegalPage({ params, data }: PageProps) {
  const L = useL();
  const t = useT();
  const { state } = useRouter();
  const doc = (params.doc as LegalDoc) || 'terms';
  const meta = legalMeta[doc];
  const res = data as LegalData | null | undefined;
  const markdown = res?.markdown ?? '';
  const headings = useHeadings(markdown);

  return (
    <>
      <Seo title={L(meta.title)} description={L(meta.summary)} />
      <PageHero crumbs={[{ label: t.footer.cols.legal }, { label: L(meta.title) }]} eyebrow={t.footer.cols.legal} title={L(meta.title)} subtitle={L(meta.summary)} />
      <Section className="pt-10 sm:pt-12 lg:pt-14">
        <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
            <nav aria-label={t.footer.cols.legal} className="glass p-3">
              <ul className="flex flex-col gap-1">
                {(Object.keys(legalMeta) as LegalDoc[]).map((d) => {
                  const active = isActivePath(state.path, legalMeta[d].path, true);
                  return (
                    <li key={d}>
                      <Link
                        to={legalMeta[d].path}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${active ? 'bg-bolt/10 font-semibold text-bolt' : 'text-fg-muted hover:bg-white/5 hover:text-fg'}`}
                      >
                        <LuFileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {L(legalMeta[d].title)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            {headings.length ? (
              <nav aria-label={t.common.onThisPage} className="hidden px-3 lg:block">
                <p className="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">{t.common.onThisPage}</p>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {headings
                    .filter((h) => h.level === 2)
                    .map((h) => (
                      <li key={h.id}>
                        <a href={`#${h.id}`} className="text-fg-subtle transition hover:text-fg">
                          {h.text}
                        </a>
                      </li>
                    ))}
                </ul>
              </nav>
            ) : null}
          </aside>
          <div className="min-w-0 max-w-3xl">
            {!site.features.legalReviewed ? (
              <div role="note" className="mb-8 flex gap-3 rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm">
                <LuTriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden="true" />
                <p className="text-fg-muted">
                  <strong className="text-fg">{L({ en: 'Draft for legal review.', ar: 'مسودة بانتظار المراجعة القانونية.' })} </strong>
                  {L({
                    en: 'This document has not yet been approved by a qualified lawyer. Items in square brackets must be completed before it takes effect.',
                    ar: 'لم يعتمد محامٍ مؤهل هذه الوثيقة بعد، ويجب استكمال البنود الواردة بين أقواس معقوفة قبل سريانها.',
                  })}
                </p>
              </div>
            ) : null}
            {state.lang === 'ar' ? (
              <p className="mb-6 text-sm text-fg-subtle">
                {L({ en: '', ar: 'هذه ترجمة للتيسير، ويسود النص الإنجليزي عند أي اختلاف.' })}{' '}
                <Link to={meta.path} lang="en" className="link">
                  English
                </Link>
              </p>
            ) : null}
            <Prose markdown={markdown} />
          </div>
        </div>
      </Section>
    </>
  );
}
