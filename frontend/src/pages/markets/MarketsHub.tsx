import { instruments, markets, sessions } from '../../config/markets';
import { useL, useT } from '../../i18n';
import { Seo } from '../../lib/head';
import { Link } from '../../router';
import { CtaButtons } from '../../components/marketing/Blocks';
import { InstrumentRange, MarketHub, marketMeta } from '../../components/marketing/MarketHub';
import { CtaBand, PageHero, Section, SectionHeading } from '../../components/ui/Section';

export default function MarketsHub() {
  const L = useL();
  const t = useT();
  return (
    <>
      <Seo
        title={L({ en: 'Markets', ar: 'الأسواق' })}
        description={L({
          en: `Trade ${instruments.length} instruments across forex, indices, crypto, metals and energy on MetaTrader 5 with Bolt Markets.`,
          ar: `تداول ${instruments.length} أداة مالية في الفوركس والمؤشرات والعملات الرقمية والمعادن والطاقة على ميتاتريدر 5 مع Bolt Markets.`,
        })}
      />
      <PageHero
        crumbs={[{ label: t.nav.markets.label }]}
        eyebrow={L({ en: 'Markets', ar: 'الأسواق' })}
        title={L({ en: 'Every market, one account', ar: 'كل الأسواق في حساب واحد' })}
        subtitle={L({
          en: `${instruments.length} instruments across four asset classes, all tradable from a single MetaTrader 5 login.`,
          ar: `${instruments.length} أداة مالية ضمن أربع فئات من الأصول، جميعها متاحة للتداول ببيانات دخول واحدة على ميتاتريدر 5.`,
        })}
        actions={<CtaButtons />}
      />
      <Section>
        <InstrumentRange />
      </Section>
      <Section>
        <SectionHeading title={L({ en: 'Live board', ar: 'لوحة الأسعار' })} />
        <MarketHub />
      </Section>
      <Section>
        <SectionHeading title={L({ en: 'When each market trades', ar: 'متى يُتداول كل سوق' })} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {markets.map((m) => {
            const Icon = marketMeta[m].icon;
            return (
              <Link key={m} to={marketMeta[m].to} className="glass glass-hover flex flex-col gap-3 p-6">
                <Icon className="h-6 w-6 text-bolt" aria-hidden="true" />
                <h3 className="text-lg font-bold">{L(marketMeta[m].title)}</h3>
                <p className="text-sm text-fg-muted">{L(sessions[m])}</p>
              </Link>
            );
          })}
        </div>
        <p className="mt-4 text-center text-xs text-fg-subtle">
          {L({
            en: 'Exact sessions and holiday hours for every symbol are shown in MetaTrader 5 under Specification.',
            ar: 'تظهر الجلسات الدقيقة وساعات العطل لكل رمز في ميتاتريدر 5 ضمن «المواصفات».',
          })}
        </p>
      </Section>
      <CtaBand title={L({ en: 'Trade them all from one login', ar: 'تداولها جميعًا ببيانات دخول واحدة' })} actions={<CtaButtons />} />
    </>
  );
}
