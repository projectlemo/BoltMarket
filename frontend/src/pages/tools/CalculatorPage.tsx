import { LuArrowRight } from 'react-icons/lu';
import type { ComponentType } from 'react';
import { useL, useT } from '../../i18n';
import { Seo } from '../../lib/head';
import { Link } from '../../router';
import type { PageProps } from '../../routes';
import { LotSizeCalculator, MarginCalculator, PipCalculator, ProfitCalculator } from '../../components/tools/Calculators';
import { Accordion, faqJsonLd } from '../../components/ui/Disclosure';
import { PageHero, Section, SectionHeading } from '../../components/ui/Section';
import { FeedNote, feedPossible } from '../../components/market/Prices';

type Tool = 'lot' | 'pip' | 'margin' | 'profit';
type LS = { en: string; ar: string };

const tools: Record<Tool, { path: string; Comp: ComponentType; title: LS; intro: LS; formula: LS; example: LS; faq: { q: LS; a: LS }[] }> = {
  lot: {
    path: '/tools/lot-size-calculator',
    Comp: LotSizeCalculator,
    title: { en: 'Lot size calculator', ar: 'حاسبة حجم اللوت' },
    intro: { en: 'Find the position size that risks exactly the share of your account you choose, based on your stop-loss distance.', ar: 'احسب حجم الصفقة الذي يعرّض النسبة التي تختارها من حسابك للمخاطرة بالضبط، بناءً على مسافة وقف الخسارة.' },
    formula: { en: 'Lots = (Balance × Risk %) ÷ (Stop distance × Value of one pip per lot)', ar: 'اللوتات = (الرصيد × نسبة المخاطرة) ÷ (مسافة الوقف × قيمة النقطة لكل لوت)' },
    example: { en: 'A $5,000 account risking 1% ($50) with a 25-pip stop on EUR/USD, where one pip on one lot is worth $10: 50 ÷ (25 × 10) = 0.20 lots.', ar: 'حساب بقيمة 5,000$ يخاطر بنسبة 1% (50$) مع وقف خسارة 25 نقطة على EUR/USD، حيث تساوي النقطة على اللوت الواحد 10$: 50 ÷ (25 × 10) = 0.20 لوت.' },
    faq: [
      { q: { en: 'How much should I risk per trade?', ar: 'كم ينبغي أن أخاطر في كل صفقة؟' }, a: { en: 'Many traders cap risk at 0.5–2% of their balance per trade so a losing streak cannot wipe out the account. Choose what fits your plan.', ar: 'يحدّ كثير من المتداولين المخاطرة بين 0.5% و2% من الرصيد في الصفقة الواحدة حتى لا تقضي سلسلة خسائر على الحساب. اختر ما يناسب خطتك.' } },
      { q: { en: 'Why is the result rounded down?', ar: 'لماذا تُقرَّب النتيجة إلى الأسفل؟' }, a: { en: 'Volumes must follow the instrument’s lot step. Rounding down keeps your actual risk at or below the amount you chose.', ar: 'يجب أن تتبع الأحجام خطوة اللوت الخاصة بالأداة، والتقريب إلى الأسفل يُبقي مخاطرتك الفعلية عند المبلغ الذي اخترته أو أقل منه.' } },
    ],
  },
  pip: {
    path: '/tools/pip-calculator',
    Comp: PipCalculator,
    title: { en: 'Pip value calculator', ar: 'حاسبة قيمة النقطة' },
    intro: { en: 'See what one pip or point is worth in your account currency for any instrument and trade size.', ar: 'اعرف قيمة النقطة الواحدة بعملة حسابك لأي أداة وأي حجم صفقة.' },
    formula: { en: 'Pip value = Pip size × Contract size × Lots × (Quote → account currency rate)', ar: 'قيمة النقطة = حجم النقطة × حجم العقد × اللوتات × (سعر تحويل عملة التسعير إلى عملة الحساب)' },
    example: { en: 'One lot of EUR/USD: 0.0001 × 100,000 × 1 = $10 per pip in a USD account.', ar: 'لوت واحد من EUR/USD: ‏0.0001 × 100,000 × 1 = 10$ لكل نقطة في حساب بالدولار.' },
    faq: [
      { q: { en: 'Why does pip value change with the account currency?', ar: 'لماذا تتغير قيمة النقطة بتغيّر عملة الحساب؟' }, a: { en: 'Profit is earned in the pair’s quote currency and converted into your account currency at the current rate.', ar: 'يُحتسب الربح بعملة التسعير للزوج ثم يُحوَّل إلى عملة حسابك بالسعر الحالي.' } },
      { q: { en: 'What is a pip on gold or indices?', ar: 'ما النقطة في الذهب أو المؤشرات؟' }, a: { en: 'Non-FX instruments move in points. This calculator shows the point size it uses next to each result.', ar: 'تتحرك الأدوات غير الفوركس بالنقاط السعرية، وتعرض هذه الحاسبة حجم النقطة المستخدم بجوار كل نتيجة.' } },
    ],
  },
  margin: {
    path: '/tools/margin-calculator',
    Comp: MarginCalculator,
    title: { en: 'Margin calculator', ar: 'حاسبة الهامش' },
    intro: { en: 'Work out how much margin a trade will use at your leverage, and what it does to your margin level.', ar: 'احسب الهامش الذي ستستخدمه الصفقة وفق رافعتك المالية، وأثرها على مستوى الهامش.' },
    formula: { en: 'Margin = (Contract size × Lots × Price × Quote → account rate) ÷ Leverage', ar: 'الهامش = (حجم العقد × اللوتات × السعر × سعر التحويل إلى عملة الحساب) ÷ الرافعة' },
    example: { en: 'One lot of EUR/USD at 1.1600 with 1:100 leverage: 100,000 × 1.16 ÷ 100 = $1,160.', ar: 'لوت واحد من EUR/USD عند 1.1600 برافعة 1:100: ‏100,000 × 1.16 ÷ 100 = 1,160$.' },
    faq: [
      { q: { en: 'What is margin level?', ar: 'ما مستوى الهامش؟' }, a: { en: 'Equity divided by used margin, as a percentage. If it falls to your account’s stop-out level, positions are closed automatically.', ar: 'حقوق الملكية مقسومة على الهامش المستخدم كنسبة مئوية. إذا انخفض إلى مستوى الإغلاق الإجباري لحسابك تُغلق الصفقات تلقائيًا.' } },
      { q: { en: 'Does lower margin mean lower risk?', ar: 'هل الهامش الأقل يعني مخاطرة أقل؟' }, a: { en: 'No. Margin is only the deposit to open a position; your profit or loss depends on the full position value.', ar: 'لا. الهامش مجرد ضمان لفتح الصفقة، بينما يعتمد ربحك أو خسارتك على القيمة الكاملة للصفقة.' } },
    ],
  },
  profit: {
    path: '/tools/profit-calculator',
    Comp: ProfitCalculator,
    title: { en: 'Profit calculator', ar: 'حاسبة الربح' },
    intro: { en: 'Calculate the profit or loss of a trade between two prices before you place it.', ar: 'احسب ربح الصفقة أو خسارتها بين سعرين قبل أن تنفّذها.' },
    formula: { en: 'P/L = (Close − Open) × Direction × Contract size × Lots × Quote → account rate', ar: 'الربح/الخسارة = (الإغلاق − الفتح) × الاتجاه × حجم العقد × اللوتات × سعر التحويل' },
    example: { en: 'Buying 0.5 lots of XAU/USD at 4,000.00 and closing at 4,012.50: 12.5 × 100 × 0.5 = $625.', ar: 'شراء 0.5 لوت من XAU/USD عند 4,000.00 والإغلاق عند 4,012.50: ‏12.5 × 100 × 0.5 = 625$.' },
    faq: [
      { q: { en: 'Are trading costs included?', ar: 'هل تشمل النتيجة تكاليف التداول؟' }, a: { en: 'No. Subtract the spread, any commission and swaps to get your net result.', ar: 'لا. اطرح السبريد وأي عمولة ورسوم التبييت للحصول على صافي النتيجة.' } },
      { q: { en: 'Can I use it to plan take-profit levels?', ar: 'هل يمكنني استخدامها لتخطيط مستويات جني الأرباح؟' }, a: { en: 'Yes. Enter your planned exit as the close price to see the outcome at your target or stop.', ar: 'نعم. أدخل سعر الخروج المخطط كسعر إغلاق لترى النتيجة عند هدفك أو وقفك.' } },
    ],
  },
};

export default function CalculatorPage({ params }: PageProps) {
  const tool = (params.tool as Tool) || 'lot';
  const L = useL();
  const t = useT();
  const cfg = tools[tool];
  const { Comp } = cfg;
  const faq = cfg.faq.map((f) => ({ q: L(f.q), a: L(f.a) }));
  return (
    <>
      <Seo
        title={L(cfg.title)}
        description={L(cfg.intro)}
        jsonLd={[
          { '@context': 'https://schema.org', '@type': 'WebApplication', name: L(cfg.title), applicationCategory: 'FinanceApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0' } },
          faqJsonLd(faq),
        ]}
      />
      <PageHero crumbs={[{ label: t.nav.tools.label, to: '/tools' }, { label: L(cfg.title) }]} eyebrow={t.nav.tools.label} title={L(cfg.title)} subtitle={L(cfg.intro)} />
      <Section className="pt-10 sm:pt-12 lg:pt-14">
        <div className="glass p-5 sm:p-8">
          <Comp />
        </div>
        {feedPossible ? <FeedNote className="mt-3" /> : null}
      </Section>
      <Section className="pt-0 sm:pt-0 lg:pt-0">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="glass p-6 sm:p-7">
            <h2 className="mb-3 text-xl font-bold">{L({ en: 'How it is calculated', ar: 'طريقة الحساب' })}</h2>
            <p className="rounded-xl border border-line bg-surface-2 p-4 font-mono text-sm leading-relaxed text-fg">{L(cfg.formula)}</p>
          </div>
          <div className="glass p-6 sm:p-7">
            <h2 className="mb-3 text-xl font-bold">{L({ en: 'Worked example', ar: 'مثال تطبيقي' })}</h2>
            <p className="leading-relaxed text-fg-muted">{L(cfg.example)}</p>
          </div>
        </div>
      </Section>
      <Section className="pt-0 sm:pt-0 lg:pt-0">
        <div className="mx-auto max-w-3xl">
          <SectionHeading title={t.common.faq} />
          <Accordion items={faq} />
        </div>
      </Section>
      <Section className="pt-0 sm:pt-0 lg:pt-0">
        <SectionHeading title={L({ en: 'More tools', ar: 'أدوات أخرى' })} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(tools) as Tool[])
            .filter((k) => k !== tool)
            .map((k) => (
              <Link key={k} to={tools[k].path} className="glass glass-hover flex items-center justify-between gap-3 p-5 font-semibold">
                {L(tools[k].title)}
                <LuArrowRight className="h-4 w-4 text-bolt rtl:-scale-x-100" aria-hidden="true" />
              </Link>
            ))}
          <Link to="/tools/economic-calendar" className="glass glass-hover flex items-center justify-between gap-3 p-5 font-semibold">
            {t.nav.tools.calendar[0]}
            <LuArrowRight className="h-4 w-4 text-bolt rtl:-scale-x-100" aria-hidden="true" />
          </Link>
        </div>
      </Section>
    </>
  );
}
