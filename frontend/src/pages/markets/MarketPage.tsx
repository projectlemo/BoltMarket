import { LuBuilding2, LuChartLine, LuCoins, LuGlobe, LuNewspaper, LuOrbit, LuScale, LuShieldAlert, LuTrendingUp, LuWaves } from 'react-icons/lu';
import type { ReactNode } from 'react';
import { formatSymbol, instrumentsFor, sessions, type MarketId } from '../../config/markets';
import { accountTypes } from '../../config/accounts';
import { useL, useT } from '../../i18n';
import { group } from '../../lib/format';
import { Seo } from '../../lib/head';
import { useSymbolSpecs } from '../../lib/symbols';
import type { PageProps } from '../../routes';
import { FeedNote, PriceTable, feedPossible } from '../../components/market/Prices';
import { CtaButtons } from '../../components/marketing/Blocks';
import { SpecList, marketMeta } from '../../components/marketing/MarketHub';
import { Accordion, faqJsonLd } from '../../components/ui/Disclosure';
import { Notice } from '../../components/ui/Feedback';
import { CtaBand, Fact, Feature, PageHero, Section, SectionHeading } from '../../components/ui/Section';

type LS = { en: string; ar: string };
interface MarketContent {
  title: LS;
  subtitle: LS;
  drivers: { icon: ReactNode; title: LS; text: LS }[];
  faq: { q: LS; a: LS }[];
  risk?: LS;
}

const content: Record<MarketId, MarketContent> = {
  forex: {
    title: { en: 'Trade the world’s largest market', ar: 'تداول أكبر سوق مالي في العالم' },
    subtitle: {
      en: 'Currency pairs from EUR/USD to selected emerging-market currencies, open around the clock from Monday to Friday.',
      ar: 'أزواج عملات من EUR/USD إلى عدد من عملات الأسواق الناشئة، متاحة على مدار الساعة من الإثنين إلى الجمعة.',
    },
    drivers: [
      { icon: <LuBuilding2 />, title: { en: 'Interest rates', ar: 'أسعار الفائدة' }, text: { en: 'Central bank decisions and guidance change the return on holding a currency.', ar: 'تغيّر قرارات البنوك المركزية وتوجيهاتها العائد على الاحتفاظ بعملة ما.' } },
      { icon: <LuNewspaper />, title: { en: 'Economic data', ar: 'البيانات الاقتصادية' }, text: { en: 'Inflation, jobs and growth figures shift expectations for future policy.', ar: 'تغيّر أرقام التضخم والوظائف والنمو التوقعات بشأن السياسة النقدية.' } },
      { icon: <LuShieldAlert />, title: { en: 'Risk sentiment', ar: 'معنويات المخاطرة' }, text: { en: 'In stressed markets, money tends to flow towards the dollar, yen and franc.', ar: 'في أوقات التوتر تميل الأموال إلى التدفق نحو الدولار والين والفرنك.' } },
      { icon: <LuCoins />, title: { en: 'Trade and commodities', ar: 'التجارة والسلع' }, text: { en: 'Currencies such as AUD and CAD often track the prices of the goods their economies export.', ar: 'تتبع عملات مثل الدولار الأسترالي والكندي غالبًا أسعار السلع التي تصدّرها اقتصاداتها.' } },
    ],
    faq: [
      { q: { en: 'What is a currency pair?', ar: 'ما زوج العملات؟' }, a: { en: 'The price of one currency (the base) expressed in another (the quote). EUR/USD at 1.1600 means one euro costs 1.16 US dollars.', ar: 'سعر عملة (الأساسية) معبَّرًا عنه بعملة أخرى (عملة التسعير). يعني سعر EUR/USD عند 1.1600 أن اليورو الواحد يساوي 1.16 دولار أمريكي.' } },
      { q: { en: 'When is the forex market open?', ar: 'متى يكون سوق الفوركس مفتوحًا؟' }, a: { en: 'Around the clock from the Sunday evening open in Asia to the Friday close in New York. Liquidity is usually deepest when the London and New York sessions overlap.', ar: 'على مدار الساعة من افتتاح آسيا مساء الأحد حتى إغلاق نيويورك يوم الجمعة، وتكون السيولة عادةً في ذروتها عند تداخل جلستي لندن ونيويورك.' } },
      { q: { en: 'What is a pip?', ar: 'ما النقطة (Pip)؟' }, a: { en: 'The standard unit of movement: 0.0001 for most pairs and 0.01 for yen pairs. On one standard lot of EUR/USD, one pip is worth $10.', ar: 'وحدة الحركة القياسية: 0.0001 لمعظم الأزواج و0.01 لأزواج الين. على لوت قياسي واحد من EUR/USD تساوي النقطة 10 دولارات.' } },
    ],
  },
  indices: {
    title: { en: 'Take a view on entire stock markets', ar: 'تداول اتجاه أسواق الأسهم بأكملها' },
    subtitle: {
      en: 'Trade the direction of leading stock indices across the US, Europe and Asia-Pacific in a single position.',
      ar: 'تداول اتجاه المؤشرات الرئيسية للأسهم في الولايات المتحدة وأوروبا وآسيا والمحيط الهادئ عبر صفقة واحدة.',
    },
    drivers: [
      { icon: <LuChartLine />, title: { en: 'Earnings', ar: 'أرباح الشركات' }, text: { en: 'Results from the largest companies can move a whole index.', ar: 'قد تحرّك نتائج كبرى الشركات المؤشر بأكمله.' } },
      { icon: <LuBuilding2 />, title: { en: 'Rates and yields', ar: 'الفائدة والعوائد' }, text: { en: 'Higher bond yields raise the discount rate investors apply to future profits.', ar: 'ترفع عوائد السندات المرتفعة معدل الخصم الذي يطبقه المستثمرون على الأرباح المستقبلية.' } },
      { icon: <LuGlobe />, title: { en: 'Growth outlook', ar: 'آفاق النمو' }, text: { en: 'Data on spending, jobs and output shapes expectations for corporate profits.', ar: 'تشكّل بيانات الإنفاق والوظائف والإنتاج التوقعات بشأن أرباح الشركات.' } },
      { icon: <LuScale />, title: { en: 'Sector weights', ar: 'أوزان القطاعات' }, text: { en: 'Tech-heavy indices react differently from those dominated by banks or energy.', ar: 'تتفاعل المؤشرات التي تهيمن عليها التكنولوجيا بشكل مختلف عن تلك التي تهيمن عليها البنوك أو الطاقة.' } },
    ],
    faq: [
      { q: { en: 'What is an index CFD?', ar: 'ما عقد الفروقات على المؤشر؟' }, a: { en: 'A contract that tracks the price of a stock index. You gain or lose the difference between the opening and closing price multiplied by your position size, without owning the shares.', ar: 'عقد يتتبع سعر مؤشر للأسهم، فتربح أو تخسر الفرق بين سعر الفتح والإغلاق مضروبًا في حجم صفقتك، دون امتلاك الأسهم.' } },
      { q: { en: 'Are dividends relevant?', ar: 'هل للأرباح الموزعة أثر؟' }, a: { en: 'Positions held over the ex-dividend date of index constituents may receive or pay a dividend adjustment, shown in your account history.', ar: 'قد تتلقى الصفقات المفتوحة خلال تاريخ استحقاق توزيعات أسهم المؤشر تسوية للأرباح الموزعة أو تُخصم منها، وتظهر في سجل حسابك.' } },
      { q: { en: 'When can I trade indices?', ar: 'متى يمكنني تداول المؤشرات؟' }, a: { en: 'Each index follows its own sessions, with a short daily break. Exact hours for every symbol are listed in MetaTrader 5 under Specification.', ar: 'يتبع كل مؤشر جلساته الخاصة مع استراحة يومية قصيرة، وتجد الساعات الدقيقة لكل رمز في ميتاتريدر 5 ضمن «المواصفات».' } },
    ],
  },
  crypto: {
    title: { en: 'Trade crypto without a wallet', ar: 'تداول العملات الرقمية دون محفظة' },
    subtitle: {
      en: 'Go long or short on leading cryptocurrencies against the US dollar, with no exchange account or private keys to manage.',
      ar: 'تداول صعود العملات الرقمية الرائدة أو هبوطها مقابل الدولار الأمريكي، دون حساب لدى منصة تداول أو مفاتيح خاصة.',
    },
    drivers: [
      { icon: <LuTrendingUp />, title: { en: 'Flows and adoption', ar: 'التدفقات والاعتماد' }, text: { en: 'Investment-fund flows and institutional demand can drive large moves.', ar: 'قد تقود تدفقات صناديق الاستثمار والطلب المؤسسي تحركات كبيرة.' } },
      { icon: <LuScale />, title: { en: 'Regulation', ar: 'التنظيم' }, text: { en: 'Rule changes in major economies can reprice the whole sector quickly.', ar: 'قد تعيد التغييرات التنظيمية في الاقتصادات الكبرى تسعير القطاع بأكمله بسرعة.' } },
      { icon: <LuWaves />, title: { en: 'Liquidity', ar: 'السيولة' }, text: { en: 'Crypto is sensitive to global liquidity and interest-rate expectations.', ar: 'تتأثر العملات الرقمية بالسيولة العالمية وتوقعات أسعار الفائدة.' } },
      { icon: <LuOrbit />, title: { en: 'Network events', ar: 'أحداث الشبكات' }, text: { en: 'Upgrades, supply changes and outages on a network can affect its coin.', ar: 'قد تؤثر الترقيات وتغيّرات المعروض والأعطال على الشبكة في سعر عملتها.' } },
    ],
    faq: [
      { q: { en: 'Do I own the coins?', ar: 'هل أمتلك العملات؟' }, a: { en: 'No. You trade contracts on the price, so you can go long or short without holding coins or managing a wallet.', ar: 'لا. أنت تتداول عقودًا على السعر، فيمكنك الشراء أو البيع دون امتلاك العملات أو إدارة محفظة.' } },
      { q: { en: 'Why are crypto spreads wider than forex?', ar: 'لماذا يكون سبريد العملات الرقمية أوسع من الفوركس؟' }, a: { en: 'Crypto markets are more volatile and less liquid than major currencies, which is reflected in the spread.', ar: 'أسواق العملات الرقمية أكثر تقلبًا وأقل سيولة من العملات الرئيسية، وينعكس ذلك على السبريد.' } },
      { q: { en: 'Is crypto riskier?', ar: 'هل العملات الرقمية أكثر خطورة؟' }, a: { en: 'Prices can move by large percentages in hours. Use smaller position sizes and always set a stop-loss.', ar: 'قد تتحرك الأسعار بنسب كبيرة خلال ساعات، فاستخدم أحجام صفقات أصغر وضع وقف الخسارة دائمًا.' } },
    ],
    risk: {
      en: 'Cryptocurrencies are highly volatile. Leverage on crypto positions magnifies that volatility; trade with money you can afford to lose.',
      ar: 'العملات الرقمية شديدة التقلب، والرافعة المالية تضاعف هذا التقلب؛ تداول فقط بأموال يمكنك تحمّل خسارتها.',
    },
  },
  commodities: {
    title: { en: 'Metals and energy in one place', ar: 'المعادن والطاقة في مكان واحد' },
    subtitle: {
      en: 'Trade gold, silver and platinum alongside WTI and Brent crude oil and natural gas.',
      ar: 'تداول الذهب والفضة والبلاتين إلى جانب نفط غرب تكساس الوسيط ونفط برنت والغاز الطبيعي.',
    },
    drivers: [
      { icon: <LuCoins />, title: { en: 'Dollar and real yields', ar: 'الدولار والعوائد الحقيقية' }, text: { en: 'Gold is priced in dollars and competes with yield-bearing assets.', ar: 'يُسعَّر الذهب بالدولار وينافس الأصول ذات العائد.' } },
      { icon: <LuGlobe />, title: { en: 'Supply decisions', ar: 'قرارات الإمداد' }, text: { en: 'Producer output policy and disruptions move oil prices.', ar: 'تحرّك سياسات الإنتاج والاضطرابات في الإمداد أسعار النفط.' } },
      { icon: <LuWaves />, title: { en: 'Inventories and weather', ar: 'المخزونات والطقس' }, text: { en: 'Weekly stock data and temperature forecasts drive energy volatility.', ar: 'تقود بيانات المخزونات الأسبوعية وتوقعات الطقس تقلبات أسواق الطاقة.' } },
      { icon: <LuShieldAlert />, title: { en: 'Safe-haven demand', ar: 'الطلب على الملاذ الآمن' }, text: { en: 'Uncertainty tends to support precious metals.', ar: 'يميل عدم اليقين إلى دعم المعادن النفيسة.' } },
    ],
    faq: [
      { q: { en: 'What does XAU/USD mean?', ar: 'ماذا يعني XAU/USD؟' }, a: { en: 'The price of one troy ounce of gold in US dollars. XAU is the ISO code for gold.', ar: 'سعر أونصة تروي واحدة من الذهب بالدولار الأمريكي، وXAU هو رمز الذهب وفق معيار ISO.' } },
      { q: { en: 'Why can oil prices gap?', ar: 'لماذا قد تحدث فجوات في أسعار النفط؟' }, a: { en: 'Producer meetings, inventory data and geopolitical news can move prices sharply between sessions, so stops may fill at a worse price.', ar: 'قد تحرّك اجتماعات المنتجين وبيانات المخزون والأخبار الجيوسياسية الأسعار بحدة بين الجلسات، فتُنفَّذ أوامر الوقف بسعر أسوأ.' } },
      { q: { en: 'How big is one lot of gold?', ar: 'ما حجم اللوت الواحد من الذهب؟' }, a: { en: 'See the contract specifications table on this page; it lists the contract size for every metal and energy product.', ar: 'راجع جدول مواصفات العقود في هذه الصفحة، فهو يوضح حجم العقد لكل معدن ومنتج طاقة.' } },
    ],
  },
};

export default function MarketPage({ params }: PageProps) {
  const market = (params.market as MarketId) || 'forex';
  const L = useL();
  const t = useT();
  const meta = marketMeta[market];
  const c = content[market];
  const list = instrumentsFor(market);
  const specs = useSymbolSpecs();
  const hasSwaps = list.some((i) => specs[i.symbol]?.swap_long !== undefined);
  const faq = c.faq.map((f) => ({ q: L(f.q), a: L(f.a) }));
  const maxLev = Math.max(...accountTypes.map((a) => a.maxLeverage));

  return (
    <>
      <Seo
        title={L({ en: `${meta.title.en} trading`, ar: `تداول ${meta.title.ar}` })}
        description={`${L(c.subtitle)} ${L({ en: 'Live prices and contract specifications.', ar: 'أسعار مباشرة ومواصفات العقود.' })}`}
        jsonLd={[faqJsonLd(faq)]}
      />
      <PageHero
        crumbs={[{ label: t.nav.markets.label, to: '/markets' }, { label: L(meta.title) }]}
        eyebrow={L(meta.title)}
        title={L(c.title)}
        subtitle={L(c.subtitle)}
        actions={<CtaButtons />}
      >
        <div className="mt-4 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
          <Fact value={String(list.length)} label={L({ en: 'Instruments', ar: 'أداة' })} />
          <Fact value={market === 'forex' ? `1:${maxLev}` : 'MT5'} label={market === 'forex' ? L({ en: 'Leverage up to', ar: 'رافعة حتى' }) : L({ en: 'Platform', ar: 'المنصة' })} />
          <Fact value={String(Math.min(...list.map((i) => i.minLot)))} label={L({ en: 'Minimum lot', ar: 'أدنى حجم لوت' })} />
        </div>
      </PageHero>

      <Section>
        <SectionHeading
          eyebrow={feedPossible ? L({ en: 'Live prices', ar: 'أسعار مباشرة' }) : L({ en: 'Instruments', ar: 'الأدوات' })}
          title={L({ en: `${meta.title.en} you can trade`, ar: `${meta.title.ar} المتاحة للتداول` })}
          subtitle={L(sessions[market])}
        />
        {feedPossible ? (
          <>
            <PriceTable items={list} caption={L(meta.title)} />
            <FeedNote className="mt-3" />
          </>
        ) : (
          <SpecList market={market} />
        )}
      </Section>

      {c.risk ? (
        <div className="container-x">
          <Notice tone="warn">{L(c.risk)}</Notice>
        </div>
      ) : null}

      <Section>
        <SectionHeading eyebrow={L({ en: 'Drivers', ar: 'المحرّكات' })} title={L({ en: 'What moves these markets', ar: 'ما الذي يحرّك هذه الأسواق' })} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.drivers.map((d) => (
            <Feature key={d.title.en} icon={d.icon} title={L(d.title)}>
              {L(d.text)}
            </Feature>
          ))}
        </div>
      </Section>

      <Section id="specifications">
        <SectionHeading eyebrow={L({ en: 'Specifications', ar: 'المواصفات' })} title={L({ en: 'Contract specifications', ar: 'مواصفات العقود' })} />
        <div className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <caption className="sr-only">{L({ en: 'Contract specifications', ar: 'مواصفات العقود' })}</caption>
              <thead>
                <tr className="border-b border-line text-xs tracking-wide text-fg-subtle uppercase">
                  <th scope="col" className="px-5 py-3.5 text-start font-semibold">{t.prices.symbol}</th>
                  <th scope="col" className="px-4 py-3.5 text-start font-semibold">{L({ en: 'Contract size (1 lot)', ar: 'حجم العقد (1 لوت)' })}</th>
                  <th scope="col" className="px-4 py-3.5 text-end font-semibold">{L({ en: 'Min lot', ar: 'أدنى لوت' })}</th>
                  <th scope="col" className="px-4 py-3.5 text-end font-semibold">{L({ en: 'Step', ar: 'الخطوة' })}</th>
                  <th scope="col" className="px-4 py-3.5 text-end font-semibold">{L({ en: 'Max lot', ar: 'أقصى لوت' })}</th>
                  <th scope="col" className="px-4 py-3.5 text-end font-semibold">{L({ en: 'Digits', ar: 'الخانات' })}</th>
                  {hasSwaps ? (
                    <>
                      <th scope="col" className="px-4 py-3.5 text-end font-semibold">{L({ en: 'Swap long', ar: 'تبييت الشراء' })}</th>
                      <th scope="col" className="px-5 py-3.5 text-end font-semibold">{L({ en: 'Swap short', ar: 'تبييت البيع' })}</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {list.map((i) => {
                  const live = specs[i.symbol];
                  return (
                    <tr key={i.symbol} className="border-b border-line/60 last:border-0">
                      <th scope="row" className="px-5 py-3 text-start font-normal">
                        <span className="block font-semibold text-fg" dir="ltr">{formatSymbol(i.symbol)}</span>
                        <span className="block text-xs text-fg-subtle">{L(i.name)}</span>
                      </th>
                      <td className="px-4 py-3 text-fg-muted">{live?.contract_size ? group(live.contract_size) : L(i.contractUnit)}</td>
                      <td className="num px-4 py-3 text-end">{live?.volume_min ?? i.minLot}</td>
                      <td className="num px-4 py-3 text-end">{live?.volume_step ?? i.lotStep}</td>
                      <td className="num px-4 py-3 text-end">{live?.volume_max ?? i.maxLot}</td>
                      <td className="num px-4 py-3 text-end">{live?.digits ?? i.digits}</td>
                      {hasSwaps ? (
                        <>
                          <td className="num px-4 py-3 text-end">{live?.swap_long ?? '—'}</td>
                          <td className="num px-5 py-3 text-end">{live?.swap_short ?? '—'}</td>
                        </>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-3 text-xs leading-relaxed text-fg-subtle">
            {hasSwaps
              ? L({ en: 'Specifications and swap rates are read live from our MT5 server. Trading sessions are listed per symbol in MetaTrader 5.', ar: 'تُقرأ المواصفات ورسوم التبييت مباشرة من خادم ميتاتريدر 5 لدينا، وتجد جلسات التداول لكل رمز في ميتاتريدر 5.' })
              : L({
                  en: 'Swap rates, margin requirements and exact trading sessions are set per symbol on our MT5 server. In MetaTrader 5, right-click a symbol in Market Watch and choose Specification to see them.',
                  ar: 'تُحدَّد رسوم التبييت ومتطلبات الهامش وجلسات التداول الدقيقة لكل رمز على خادم ميتاتريدر 5 لدينا. في ميتاتريدر 5، انقر بزر الفأرة الأيمن على الرمز في «مراقبة السوق» واختر «المواصفات» لعرضها.',
                })}
          </p>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading title={t.common.faq} />
          <Accordion items={faq} />
        </div>
      </Section>

      <CtaBand
        title={L({ en: `Start trading ${meta.title.en.toLowerCase()}`, ar: `ابدأ تداول ${meta.title.ar}` })}
        subtitle={L({ en: 'Open an account in minutes or practise first on a demo.', ar: 'افتح حسابًا خلال دقائق أو تدرّب أولًا على حساب تجريبي.' })}
        actions={<CtaButtons />}
      />
    </>
  );
}
