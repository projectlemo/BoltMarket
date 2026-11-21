import { LuCheck } from 'react-icons/lu';
import { accountCopy, accountTypes, PLATFORM_NAME } from '../../config/accounts';
import { instruments } from '../../config/markets';
import { useL, useT } from '../../i18n';
import { usd } from '../../lib/format';
import { Seo } from '../../lib/head';
import { AccountComparison } from '../../components/marketing/AccountComparison';
import { CtaButtons } from '../../components/marketing/Blocks';
import { Accordion, faqJsonLd } from '../../components/ui/Disclosure';
import { CtaBand, PageHero, Section, SectionHeading } from '../../components/ui/Section';

export default function TradingAccounts() {
  const L = useL();
  const t = useT();
  const inst = accountTypes.find((a) => a.raw);
  const rows: [string, (a: (typeof accountTypes)[number]) => string][] = [
    [L({ en: 'Minimum deposit', ar: 'الحد الأدنى للإيداع' }), (a) => usd(a.minDeposit)],
    [L({ en: 'Spreads from', ar: 'السبريد ابتداءً من' }), (a) => `${a.spreadFrom.toFixed(1)} ${t.common.pips}`],
    [L({ en: 'Pricing model', ar: 'نموذج التسعير' }), (a) => (a.raw ? L({ en: 'Raw spread + commission', ar: 'سبريد خام + عمولة' }) : L({ en: 'Spread only', ar: 'سبريد فقط' }))],
    [L({ en: 'Commission', ar: 'العمولة' }), (a) => (a.commissionPerLot ? `${usd(a.commissionPerLot)} ${t.common.perLot}` : t.common.none)],
    [L({ en: 'Maximum leverage', ar: 'أقصى رافعة مالية' }), (a) => `1:${a.maxLeverage}`],
    [L({ en: 'Platform', ar: 'المنصة' }), () => PLATFORM_NAME],
    [L({ en: 'Instruments', ar: 'الأدوات المالية' }), () => L({ en: `All ${instruments.length}`, ar: `جميع الأدوات (${instruments.length})` })],
    [L({ en: 'Demo account', ar: 'حساب تجريبي' }), () => t.common.yes],
  ];
  const faq = [
    {
      q: L({ en: 'Can I open more than one account?', ar: 'هل يمكنني فتح أكثر من حساب؟' }),
      a: L({
        en: 'Yes. You can hold several live and demo MT5 accounts of different types under one client profile and see them all in the portal.',
        ar: 'نعم. يمكنك امتلاك عدة حسابات حقيقية وتجريبية من أنواع مختلفة ضمن ملف عميل واحد، وتظهر جميعها في البوابة.',
      }),
    },
    {
      q: L({ en: 'How is the Institutional commission calculated?', ar: 'كيف تُحتسب عمولة حساب المؤسسات؟' }),
      a: L({
        en: `It is ${inst ? usd(inst.commissionPerLot) : ''} per standard lot (100,000 units of the base currency), scaled to your trade size. The exact charge for every trade appears in your MT5 history.`,
        ar: `تبلغ ${inst ? usd(inst.commissionPerLot) : ''} لكل لوت قياسي (100,000 وحدة من العملة الأساسية)، وتتناسب مع حجم صفقتك. تظهر القيمة الدقيقة لكل صفقة في سجل ميتاتريدر 5.`,
      }),
    },
    {
      q: L({ en: 'Are spreads fixed?', ar: 'هل السبريد ثابت؟' }),
      a: L({
        en: 'No. Spreads are variable. The figures shown are minimums; spreads can widen around news, at the daily rollover and in thin markets.',
        ar: 'لا، السبريد متغيّر. الأرقام المعروضة هي الحد الأدنى، وقد يتسع السبريد عند الأخبار وعند التبييت اليومي وفي الأسواق ضعيفة السيولة.',
      }),
    },
    {
      q: L({ en: 'Can I switch account types later?', ar: 'هل يمكنني تغيير نوع الحساب لاحقًا؟' }),
      a: L({
        en: 'Open a new MT5 account of the type you want from the client portal at any time. Your existing accounts stay open until you ask us to close them.',
        ar: 'افتح حساب ميتاتريدر 5 جديدًا من النوع الذي تريده من بوابة العملاء في أي وقت، وتبقى حساباتك الحالية مفتوحة حتى تطلب إغلاقها.',
      }),
    },
  ];
  return (
    <>
      <Seo
        title={L({ en: 'Trading accounts', ar: 'حسابات التداول' })}
        description={L({
          en: 'Compare Standard, Pro and Institutional accounts: minimum deposit, spreads, commission and leverage, with an interactive cost estimator.',
          ar: 'قارن بين حسابات ستاندرد وبرو والمؤسسات: الحد الأدنى للإيداع والسبريد والعمولة والرافعة، مع أداة تفاعلية لتقدير التكلفة.',
        })}
        jsonLd={[faqJsonLd(faq)]}
      />
      <PageHero
        crumbs={[{ label: t.nav.trading.label }, { label: t.nav.trading.accounts[0] }]}
        eyebrow={L({ en: 'Accounts', ar: 'الحسابات' })}
        title={L({ en: 'Three ways to price your trades', ar: 'ثلاث طرق لتسعير صفقاتك' })}
        subtitle={L({
          en: 'Spread-only pricing on Standard and Pro, or raw spreads with a fixed commission on Institutional. Compare them side by side and estimate what each would cost you.',
          ar: 'تسعير بالسبريد فقط في حسابي ستاندرد وبرو، أو سبريد خام مع عمولة ثابتة في حساب المؤسسات. قارن بينها جنبًا إلى جنب وقدّر تكلفة كل منها عليك.',
        })}
      />
      <Section>
        <AccountComparison detailed />
      </Section>
      <Section>
        <SectionHeading title={L({ en: 'Full specifications', ar: 'المواصفات الكاملة' })} />
        <div className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="px-5 py-4 text-start text-xs tracking-wide text-fg-subtle uppercase">
                    {L({ en: 'Specification', ar: 'المواصفة' })}
                  </th>
                  {accountTypes.map((a) => (
                    <th key={a.id} scope="col" className="px-5 py-4 text-start font-display text-base font-bold">
                      {L(accountCopy[a.id].name)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, get]) => (
                  <tr key={label} className="border-b border-line/60 last:border-0">
                    <th scope="row" className="px-5 py-3.5 text-start font-medium text-fg-muted">
                      {label}
                    </th>
                    {accountTypes.map((a) => (
                      <td key={a.id} className="num px-5 py-3.5 text-fg">
                        {get(a)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>
      <Section>
        <SectionHeading title={L({ en: 'Which account is right for you?', ar: 'أي حساب يناسبك؟' })} />
        <div className="grid gap-4 md:grid-cols-3">
          {accountTypes.map((a) => (
            <div key={a.id} className="glass flex flex-col gap-3 p-6">
              <h3 className="text-xl font-bold">{L(accountCopy[a.id].name)}</h3>
              <p className="flex gap-2 text-fg-muted">
                <LuCheck className="mt-1 h-4 w-4 shrink-0 text-bolt" aria-hidden="true" />
                {L(accountCopy[a.id].bestFor)}
              </p>
              <p className="text-sm text-fg-subtle">
                {a.id === 'standard'
                  ? L({ en: 'Choose it to start with a small deposit and keep costs simple: the spread is the whole cost.', ar: 'اختره لتبدأ بإيداع صغير وتكاليف بسيطة: السبريد هو كامل التكلفة.' })
                  : a.id === 'pro'
                    ? L({ en: 'Choose it when you trade often and tighter spreads save more than the higher entry costs.', ar: 'اختره إذا كنت تتداول كثيرًا وكان السبريد الأضيق يوفّر لك أكثر من متطلبات الإيداع الأعلى.' })
                    : L({ en: 'Choose it for large or frequent volume, where raw spreads plus commission are usually cheapest.', ar: 'اختره للأحجام الكبيرة أو المتكررة، حيث يكون السبريد الخام مع العمولة الأرخص عادةً.' })}
              </p>
            </div>
          ))}
        </div>
      </Section>
      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading title={t.common.faq} />
          <Accordion items={faq} />
        </div>
      </Section>
      <CtaBand title={L({ en: 'Open the account that fits you', ar: 'افتح الحساب الذي يناسبك' })} actions={<CtaButtons />} />
    </>
  );
}
