import clsx from 'clsx';
import type { ReactNode } from 'react';
import { BoltIcon, BoltLines } from './Brand';
import { Link } from '../../router';
import { useT } from '../../i18n';
import { LuChevronRight } from 'react-icons/lu';

export function Section({
  id,
  className,
  children,
  bleed = false,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
  bleed?: boolean;
}) {
  return (
    <section id={id} className={clsx('relative py-16 sm:py-20 lg:py-24', className)}>
      {bleed ? children : <div className="container-x">{children}</div>}
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="eyebrow">
      <BoltIcon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  action,
  as: Tag = 'h2',
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: 'center' | 'start';
  action?: ReactNode;
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
}) {
  const center = align === 'center';
  return (
    <div
      className={clsx(
        'mb-10 flex flex-col gap-4 sm:mb-12',
        center ? 'items-center text-center' : 'items-start text-start md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className={clsx('flex flex-col gap-4', center ? 'max-w-3xl items-center' : 'max-w-2xl items-start')}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Tag className="text-3xl leading-[1.12] font-bold text-fg sm:text-4xl lg:text-[2.75rem]">{title}</Tag>
        {subtitle ? <p className="text-base leading-relaxed text-fg-muted sm:text-lg">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const t = useT();
  return (
    <nav aria-label={t.a11y.breadcrumb} className="mb-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-fg-subtle">
        {items.map((c, i) => (
          <li key={c.label} className="flex items-center gap-1.5">
            {c.to ? (
              <Link to={c.to} className="transition hover:text-fg">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-fg-muted">
                {c.label}
              </span>
            )}
            {i < items.length - 1 ? <LuChevronRight className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Hero used by every inner page. */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  actions,
  aside,
  crumbs,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  crumbs?: Crumb[];
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-line/60">
      <div className="bg-grid absolute inset-0" aria-hidden="true" />
      <div className="bg-glow absolute inset-0" aria-hidden="true" />
      <BoltLines className="absolute inset-x-0 bottom-0 h-40 w-full opacity-60" />
      <div className="container-x relative pt-10 pb-16 sm:pt-14 sm:pb-20 lg:pt-16 lg:pb-24">
        {crumbs ? <Breadcrumbs items={crumbs} /> : null}
        <div className={clsx('grid items-center gap-10', aside ? 'lg:grid-cols-[1.1fr_0.9fr] lg:gap-14' : '')}>
          <div className="flex max-w-3xl flex-col items-start gap-5">
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            <h1 className="text-4xl leading-[1.06] font-extrabold text-fg sm:text-5xl lg:text-6xl">{title}</h1>
            {subtitle ? <p className="max-w-2xl text-lg leading-relaxed text-fg-muted">{subtitle}</p> : null}
            {actions ? <div className="mt-2 flex flex-wrap gap-3">{actions}</div> : null}
            {children}
          </div>
          {aside ? <div className="relative">{aside}</div> : null}
        </div>
      </div>
    </section>
  );
}

/** Closing call-to-action band. */
export function CtaBand({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions: ReactNode }) {
  return (
    <Section>
      <div className="relative overflow-hidden rounded-[2rem] border border-bolt/25 bg-[radial-gradient(120%_120%_at_0%_0%,rgb(255_212_0/0.16),transparent_55%),linear-gradient(180deg,#151515,#0d0d0d)] px-6 py-14 text-center sm:px-12 sm:py-20">
        <BoltLines className="absolute inset-0 h-full w-full opacity-70" />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-5">
          <h2 className="text-3xl leading-tight font-extrabold sm:text-5xl">{title}</h2>
          {subtitle ? <p className="text-lg text-fg-muted">{subtitle}</p> : null}
          <div className="mt-3 flex flex-wrap justify-center gap-3">{actions}</div>
        </div>
      </div>
    </Section>
  );
}

/** Icon + title + text feature tile. */
export function Feature({ icon, title, children, className }: { icon: ReactNode; title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={clsx('glass glass-hover flex flex-col gap-3 p-6', className)}>
      <span className="grid h-11 w-11 place-items-center rounded-xl border border-bolt/25 bg-bolt/10 text-bolt [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <h3 className="text-lg font-bold text-fg">{title}</h3>
      <div className="text-[0.95rem] leading-relaxed text-fg-muted">{children}</div>
    </div>
  );
}

/** Small key fact chip: value + label. */
export function Fact({ value, label }: { value: ReactNode; label: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
      <span className="num font-display text-xl font-extrabold text-fg sm:text-2xl">{value}</span>
      <span className="text-xs text-fg-subtle sm:text-sm">{label}</span>
    </div>
  );
}
