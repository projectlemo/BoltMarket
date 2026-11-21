import { useState } from 'react';
import { LuBell, LuChartArea, LuPencilRuler, LuUsers } from 'react-icons/lu';
import { formatSymbol } from '../../config/markets';
import { site } from '../../config/site';
import { useL, useT } from '../../i18n';
import { Seo } from '../../lib/head';
import { CheckList, CtaButtons } from '../../components/marketing/Blocks';
import { ChartMock } from '../../components/marketing/Illustrations';
import { TradingViewWidget } from '../../components/tools/TradingViewWidget';
import { Accordion, Tabs, faqJsonLd } from '../../components/ui/Disclosure';
import { CtaBand, Feature, PageHero, Section, SectionHeading } from '../../components/ui/Section';

const tvSymbols: Record<string, string> = {
  EURUSD: 'FX:EURUSD',
  XAUUSD: 'OANDA:XAUUSD',
  US500: 'FOREXCOM:SPXUSD',
  BTCUSD: 'BITSTAMP:BTCUSD',
};

export default function TradingViewPage() {
  const L = useL();
  const t = useT();
  const [symbol, setSymbol] = useState('EURUSD');
  const faq = [
    {
      q: L({ en: 'Can I place Bolt Markets trades from TradingView?', ar: 'هل يمكنني تنفيذ صفقات Bolt Markets من TradingView؟' }),
      a: L({
        en: 'Not directly. Use TradingView for charting, research and alerts, then place and manage your orders on MetaTrader 5.',
        ar: 'ليس مباشرة. استخدم TradingView للرسوم البيانية والبحث والتنبيهات، ثم نفّذ أوامرك وأدرها على ميتاتريدر 5.',
      }),
    },
    {
      q: L({ en: 'Why might TradingView prices differ slightly from MT5?', ar: 'لماذا قد تختلف أسعار TradingView قليلًا عن ميتاتريدر 5؟' }),
      a: L({
        en: 'TradingView charts show prices from third-party data providers. Your executable prices are always the bid and ask quoted on your MT5 account.',
        ar: 'تعرض رسوم TradingView أسعارًا من مزوّدي بيانات خارجيين، بينما أسعار التنفيذ الفعلية هي دائمًا أسعار البيع والشراء المعروضة في حسابك على ميتاتريدر 5.',
      }),
    },
    {
      q: L({ en: 'Do I need a TradingView subscription?', ar: 'هل أحتاج إلى اشتراك في TradingView؟' }),
      a: L({
        en: 'No. The charts on this page are free. A TradingView account adds saved layouts and more alerts on their website.',
        ar: 'لا. الرسوم في هذه الصفحة مجانية، ويتيح لك حساب TradingView حفظ التخطيطات ومزيدًا من التنبيهات على موقعهم.',
      }),
    },
  ];
  return (
    <>
      <Seo
        title={L({ en: 'TradingView charts', ar: 'رسوم TradingView البيانية' })}
        description={L({
          en: 'Research forex, gold, indices and crypto with TradingView charts, then execute on MetaTrader 5 with Bolt Markets.',
          ar: 'ابحث في الفوركس والذهب والمؤشرات والعملات الرقمية برسوم TradingView، ثم نفّذ صفقاتك على ميتاتريدر 5 مع Bolt Markets.',
        })}
        jsonLd={[faqJsonLd(faq)]}
      />
      <PageHero
        crumbs={[{ label: t.nav.trading.label, to: '/trading/accounts' }, { label: 'TradingView' }]}
        eyebrow="TradingView"
        title={L({ en: 'Chart smarter with TradingView', ar: 'حلّل بذكاء مع TradingView' })}
        subtitle={L({
          en: 'Use TradingView’s charting and drawing tools to research your setups, then execute on MetaTrader 5 with your Bolt Markets account.',
          ar: 'استخدم أدوات الرسم والتحليل في TradingView لدراسة فرصك، ثم نفّذ صفقاتك على ميتاتريدر 5 بحسابك في Bolt Markets.',
        })}
        actions={<CtaButtons />}
        aside={<ChartMock />}
      />
      {site.features.tradingViewWidgets ? (
        <Section>
          <div className="mb-5 flex justify-center">
            <Tabs
              label={L({ en: 'Chart symbol', ar: 'رمز الرسم البياني' })}
              value={symbol}
              onChange={setSymbol}
              tabs={Object.keys(tvSymbols).map((s) => ({ id: s, label: <span dir="ltr">{formatSymbol(s)}</span> }))}
            />
          </div>
          <TradingViewWidget kind="advanced-chart" height={600} config={{ symbol: tvSymbols[symbol], interval: '60', timezone: 'Etc/UTC', style: '1', allow_symbol_change: true, hide_side_toolbar: false }} />
        </Section>
      ) : null}
      <Section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feature icon={<LuChartArea />} title={L({ en: 'Clean, fast charts', ar: 'رسوم سريعة وواضحة' })}>
            {L({ en: 'Smooth zooming, multiple chart types and layouts that work in the browser.', ar: 'تكبير سلس وأنواع متعددة من الرسوم وتخطيطات تعمل في المتصفح.' })}
          </Feature>
          <Feature icon={<LuPencilRuler />} title={L({ en: 'Drawing tools', ar: 'أدوات الرسم' })}>
            {L({ en: 'Trend lines, Fibonacci levels and patterns to map out a trade plan.', ar: 'خطوط الاتجاه ومستويات فيبوناتشي والنماذج لرسم خطة صفقتك.' })}
          </Feature>
          <Feature icon={<LuBell />} title={L({ en: 'Alerts', ar: 'التنبيهات' })}>
            {L({ en: 'Get notified when price reaches the levels you care about.', ar: 'تلقَّ إشعارًا عندما يبلغ السعر المستويات التي تهمك.' })}
          </Feature>
          <Feature icon={<LuUsers />} title={L({ en: 'Community ideas', ar: 'أفكار المجتمع' })}>
            {L({ en: 'Browse published analysis for inspiration; always test ideas yourself.', ar: 'تصفّح التحليلات المنشورة للإلهام، واختبر الأفكار دائمًا بنفسك.' })}
          </Feature>
        </div>
      </Section>
      <Section>
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <SectionHeading
            align="start"
            title={L({ en: 'A simple research-to-execution workflow', ar: 'سير عمل بسيط من التحليل إلى التنفيذ' })}
          />
          <CheckList
            items={[
              L({ en: 'Mark your levels and plan entries, stops and targets on TradingView.', ar: 'حدّد مستوياتك وخطّط للدخول ووقف الخسارة والأهداف على TradingView.' }),
              L({ en: 'Size the position with the Bolt lot size calculator.', ar: 'حدّد حجم الصفقة باستخدام حاسبة حجم اللوت من Bolt.' }),
              L({ en: 'Place the order on MetaTrader 5 with your stop-loss and take-profit attached.', ar: 'ضع الأمر على ميتاتريدر 5 مع إرفاق وقف الخسارة وجني الأرباح.' }),
            ]}
          />
        </div>
      </Section>
      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading title={t.common.faq} />
          <Accordion items={faq} />
        </div>
      </Section>
      <CtaBand title={L({ en: 'Analyse on TradingView. Trade on Bolt.', ar: 'حلّل على TradingView. وتداول مع Bolt.' })} actions={<CtaButtons />} />
    </>
  );
}
