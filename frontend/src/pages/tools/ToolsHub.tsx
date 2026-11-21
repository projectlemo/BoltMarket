import { LuArrowRight, LuCalculator, LuCalendarDays, LuGauge, LuPercent, LuTrendingUp } from 'react-icons/lu';
import { useL, useT } from '../../i18n';
import { Seo } from '../../lib/head';
import { Link } from '../../router';
import { CtaButtons } from '../../components/marketing/Blocks';
import { CtaBand, PageHero, Section } from '../../components/ui/Section';

export default function ToolsHub() {
  const L = useL();
  const t = useT();
  const items = [
    { to: '/tools/lot-size-calculator', icon: LuCalculator, text: t.nav.tools.lot },
    { to: '/tools/pip-calculator', icon: LuPercent, text: t.nav.tools.pip },
    { to: '/tools/margin-calculator', icon: LuGauge, text: t.nav.tools.margin },
    { to: '/tools/profit-calculator', icon: LuTrendingUp, text: t.nav.tools.profit },
    { to: '/tools/economic-calendar', icon: LuCalendarDays, text: t.nav.tools.calendar },
  ];
  return (
    <>
      <Seo
        title={L({ en: 'Trading tools', ar: 'أدوات التداول' })}
        description={L({ en: 'Free lot size, pip value, margin and profit calculators plus an economic calendar.', ar: 'حاسبات مجانية لحجم اللوت وقيمة النقطة والهامش والربح، إضافة إلى المفكرة الاقتصادية.' })}
      />
      <PageHero
        crumbs={[{ label: t.nav.tools.label }]}
        eyebrow={t.nav.tools.label}
        title={L({ en: 'Do the maths before the market does', ar: 'احسب أرقامك قبل أن يحسبها السوق' })}
        subtitle={L({ en: 'Free calculators for sizing and planning every trade, and a calendar of the events that move prices.', ar: 'حاسبات مجانية لتحديد حجم كل صفقة والتخطيط لها، ومفكرة بالأحداث التي تحرّك الأسعار.' })}
      />
      <Section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ to, icon: Icon, text }) => (
            <Link key={to} to={to} className="glass glass-hover group flex flex-col gap-4 p-6">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-bolt text-bolt-ink">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="text-xl font-bold">{text[0]}</span>
              <span className="text-sm text-fg-muted">{text[1]}</span>
              <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-bolt">
                {L({ en: 'Open tool', ar: 'افتح الأداة' })}
                <LuArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </Section>
      <CtaBand title={L({ en: 'Put your plan into practice', ar: 'طبّق خطتك عمليًا' })} actions={<CtaButtons />} />
    </>
  );
}
