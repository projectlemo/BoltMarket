import { LuBell, LuChartCandlestick, LuFingerprint, LuZap } from 'react-icons/lu';
import { useL, useT } from '../../i18n';
import { Seo } from '../../lib/head';
import { CtaButtons, Steps } from '../../components/marketing/Blocks';
import { PhoneMock } from '../../components/marketing/Illustrations';
import { PlatformDownloads } from '../../components/marketing/Platforms';
import { Accordion, faqJsonLd } from '../../components/ui/Disclosure';
import { CtaBand, Feature, PageHero, Section, SectionHeading } from '../../components/ui/Section';

export default function MobileApp() {
  const L = useL();
  const t = useT();
  const faq = [
    {
      q: L({ en: 'Is there a Bolt Markets app?', ar: 'هل يوجد تطبيق خاص بـ Bolt Markets؟' }),
      a: L({
        en: 'You trade on the official MetaTrader 5 app for iPhone, iPad and Android. Manage deposits, withdrawals and verification in the client portal, which works in your phone’s browser.',
        ar: 'تتداول عبر تطبيق ميتاتريدر 5 الرسمي لآيفون وآيباد وأندرويد، وتدير الإيداع والسحب والتحقق من بوابة العملاء التي تعمل من متصفح هاتفك.',
      }),
    },
    {
      q: L({ en: 'How do I find the Bolt Markets server in the app?', ar: 'كيف أجد خادم Bolt Markets في التطبيق؟' }),
      a: L({
        en: 'Open Settings → New Account → Login to an existing account, then type the server name shown next to your account in the client portal.',
        ar: 'افتح «الإعدادات» ← «حساب جديد» ← «تسجيل الدخول إلى حساب موجود»، ثم اكتب اسم الخادم الظاهر بجانب حسابك في بوابة العملاء.',
      }),
    },
    {
      q: L({ en: 'Can I get price alerts on my phone?', ar: 'هل يمكنني تلقي تنبيهات الأسعار على هاتفي؟' }),
      a: L({ en: 'Yes. Link your MetaQuotes ID to receive push notifications from the platform.', ar: 'نعم. اربط معرّف MetaQuotes الخاص بك لتلقي الإشعارات من المنصة.' }),
    },
  ];
  return (
    <>
      <Seo
        title={L({ en: 'Mobile trading app', ar: 'تطبيق التداول على الجوال' })}
        description={L({
          en: 'Trade on the MetaTrader 5 app for iPhone and Android with your Bolt Markets account: charts, one-tap orders and push alerts.',
          ar: 'تداول عبر تطبيق ميتاتريدر 5 لآيفون وأندرويد بحسابك في Bolt Markets: رسوم بيانية وأوامر بلمسة واحدة وتنبيهات فورية.',
        })}
        jsonLd={[faqJsonLd(faq)]}
      />
      <PageHero
        crumbs={[{ label: t.nav.trading.label, to: '/trading/accounts' }, { label: t.nav.trading.mobile[0] }]}
        eyebrow={L({ en: 'Mobile', ar: 'الجوال' })}
        title={L({ en: 'The market in your pocket', ar: 'السوق في جيبك' })}
        subtitle={L({
          en: 'Monitor positions, react to news and place trades from the MetaTrader 5 app on iPhone, iPad and Android.',
          ar: 'راقب صفقاتك وتفاعل مع الأخبار ونفّذ صفقاتك من تطبيق ميتاتريدر 5 على آيفون وآيباد وأندرويد.',
        })}
        actions={<CtaButtons />}
        aside={<PhoneMock />}
      />
      <Section>
        <PlatformDownloads only={['ios', 'android']} className="mx-auto max-w-2xl lg:grid-cols-2" />
      </Section>
      <Section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feature icon={<LuZap />} title={L({ en: 'One-tap trading', ar: 'تداول بلمسة' })}>
            {L({ en: 'Open and close positions in a single tap, straight from the chart.', ar: 'افتح الصفقات وأغلقها بلمسة واحدة مباشرة من الرسم البياني.' })}
          </Feature>
          <Feature icon={<LuChartCandlestick />} title={L({ en: 'Full charting', ar: 'رسوم بيانية كاملة' })}>
            {L({ en: 'Interactive charts with indicators and drawing tools sized for touch.', ar: 'رسوم تفاعلية مع مؤشرات وأدوات رسم مصمَّمة للّمس.' })}
          </Feature>
          <Feature icon={<LuBell />} title={L({ en: 'Push alerts', ar: 'تنبيهات فورية' })}>
            {L({ en: 'Price alerts and trade notifications delivered to your phone.', ar: 'تنبيهات الأسعار وإشعارات الصفقات تصل إلى هاتفك.' })}
          </Feature>
          <Feature icon={<LuFingerprint />} title={L({ en: 'Device security', ar: 'أمان الجهاز' })}>
            {L({ en: 'Combine your phone lock with two-factor login on the client portal.', ar: 'اجمع بين قفل الهاتف وتسجيل الدخول بخطوتين في بوابة العملاء.' })}
          </Feature>
        </div>
      </Section>
      <Section>
        <SectionHeading title={L({ en: 'From sign-up to your first mobile trade', ar: 'من التسجيل إلى أول صفقة من الجوال' })} />
        <Steps compact />
      </Section>
      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading title={t.common.faq} />
          <Accordion items={faq} />
        </div>
      </Section>
      <CtaBand title={L({ en: 'Take your trading mobile', ar: 'اجعل تداولك متنقلًا' })} actions={<CtaButtons />} />
    </>
  );
}
