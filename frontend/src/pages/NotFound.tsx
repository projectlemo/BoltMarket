import { LuArrowRight } from 'react-icons/lu';
import { ButtonLink } from '../components/ui/Button';
import { BoltIcon } from '../components/ui/Brand';
import { Seo } from '../lib/head';
import { useT } from '../i18n';

export default function NotFound() {
  const t = useT();
  return (
    <section className="container-x flex min-h-[60vh] flex-col items-center justify-center gap-6 py-24 text-center">
      <Seo title={t.notFound.title} noindex />
      <span className="grid h-16 w-16 place-items-center rounded-2xl border border-bolt/30 bg-bolt/10 text-bolt">
        <BoltIcon className="h-8 w-8" />
      </span>
      <p className="font-display text-7xl font-extrabold text-fg/90">404</p>
      <h1 className="text-3xl font-bold">{t.notFound.title}</h1>
      <p className="max-w-md text-fg-muted">{t.notFound.text}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink to="/">
          {t.notFound.home}
          <LuArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
        </ButtonLink>
        <ButtonLink to="/help" variant="secondary">
          {t.common.helpCenter}
        </ButtonLink>
      </div>
    </section>
  );
}
