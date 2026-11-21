import { LuBell, LuBot, LuCalendarDays, LuChartCandlestick, LuLayers, LuListChecks } from 'react-icons/lu';
import { useL, useT } from '../../i18n';
import { Seo } from '../../lib/head';
import { CheckList, CtaButtons } from '../../components/marketing/Blocks';
import { TerminalMock } from '../../components/marketing/Illustrations';
import { PlatformComparison, PlatformDownloads } from '../../components/marketing/Platforms';
import { WebTerminal } from '../../components/marketing/WebTerminal';
import { Accordion, faqJsonLd } from '../../components/ui/Disclosure';
import { CtaBand, Feature, PageHero, Section, SectionHeading } from '../../components/ui/Section';

export default function MetaTrader5() {
  const L = useL();
  const t = useT();
  const faq = [
    {
      q: L({ en: 'Is MetaTrader 5 free?', ar: 'هل ميتاتريدر 5 مجاني؟' }),
      a: L({
        en: 'Yes. The platform is free to download and use with your Bolt Markets account. You only pay the trading costs of your account type.',
        ar: 'نعم. المنصة مجانية للتنزيل والاستخدام مع حسابك في Bolt Markets، وتدفع فقط تكاليف التداول الخاصة بنوع حسابك.',
      }),
    },
    {
      q: L({ en: 'Which server do I select when I log in?', ar: 'أي خادم أختار عند تسجيل الدخول؟' }),
      a: L({
        en: 'Each MT5 account in your client portal shows its login number and server name. Choose that exact server in the login window; live and demo accounts use different servers.',
        ar: 'يعرض كل حساب ميتاتريدر 5 في بوابة العملاء رقم الدخول واسم الخادم. اختر الخادم نفسه في نافذة الدخول، علمًا بأن الحسابات الحقيقية والتجريبية تستخدم خوادم مختلفة.',
      }),
    },
    {
      q: L({ en: 'Can I use Expert Advisors?', ar: 'هل يمكنني استخدام المستشارين الخبراء؟' }),
      a: L({
        en: 'Yes, on the desktop platform. Expert Advisors only run while the terminal is open, so traders who automate around the clock usually run MT5 on a virtual private server (VPS).',
        ar: 'نعم، على منصة سطح المكتب. يعمل المستشارون الخبراء فقط أثناء تشغيل المنصة، لذلك يشغّل المتداولون الذين يعتمدون الأتمتة على مدار الساعة المنصةَ عادةً على خادم افتراضي خاص (VPS).',
      }),
    },
    {
      q: L({ en: 'Can I use the same account on desktop and mobile?', ar: 'هل يمكنني استخدام الحساب نفسه على سطح المكتب والجوال؟' }),
      a: L({
        en: 'Yes. Log in with the same login and password on any MT5 app. Positions and orders are held on the server, so they appear everywhere.',
        ar: 'نعم. سجّل الدخول ببيانات الدخول نفسها على أي تطبيق ميتاتريدر 5. تُحفظ الصفقات والأوامر على الخادم فتظهر على جميع أجهزتك.',
      }),
    },
  ];
  return (
    <>
      <Seo
        title={L({ en: 'MetaTrader 5 platform', ar: 'منصة ميتاتريدر 5' })}
        description={L({
          en: 'Download MetaTrader 5 for Windows, macOS, iOS and Android or trade in your browser. Advanced charts, Expert Advisors and depth of market with Bolt Markets.',
          ar: 'نزّل ميتاتريدر 5 لويندوز وماك وiOS وأندرويد أو تداول من متصفحك. رسوم بيانية متقدمة ومستشارون خبراء وعمق السوق مع Bolt Markets.',
        })}
        jsonLd={[faqJsonLd(faq)]}
      />
      <PageHero
        crumbs={[{ label: t.nav.trading.label, to: '/trading/accounts' }, { label: 'MetaTrader 5' }]}
        eyebrow={L({ en: 'Platform', ar: 'المنصة' })}
        title={L({ en: 'MetaTrader 5, wherever you trade', ar: 'ميتاتريدر 5 أينما تتداول' })}
        subtitle={L({
          en: 'The industry-standard multi-asset platform, connected to your Bolt Markets account on desktop, web and mobile with one login.',
          ar: 'المنصة متعددة الأصول المعتمدة في القطاع، متصلة بحسابك في Bolt Markets على سطح المكتب والويب والجوال ببيانات دخول واحدة.',
        })}
        actions={<CtaButtons />}
        aside={<TerminalMock />}
      />

      <Section>
        <SectionHeading
          eyebrow={L({ en: 'Download', ar: 'التنزيل' })}
          title={L({ en: 'Get MetaTrader 5', ar: 'احصل على ميتاتريدر 5' })}
          subtitle={L({ en: 'Install it on your devices or launch it in the browser.', ar: 'ثبّته على أجهزتك أو شغّله من المتصفح.' })}
        />
        <PlatformDownloads />
      </Section>

      <Section>
        <SectionHeading
          eyebrow={L({ en: 'Features', ar: 'المزايا' })}
          title={L({ en: 'Built for serious analysis', ar: 'مصمَّمة للتحليل الجاد' })}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Feature icon={<LuChartCandlestick />} title={L({ en: 'Advanced charting', ar: 'رسوم بيانية متقدمة' })}>
            {L({
              en: '21 timeframes, 38 built-in technical indicators and 44 analytical objects on the desktop platform.',
              ar: '21 إطارًا زمنيًا و38 مؤشرًا فنيًا مدمجًا و44 أداة تحليلية على منصة سطح المكتب.',
            })}
          </Feature>
          <Feature icon={<LuBot />} title={L({ en: 'Algorithmic trading', ar: 'التداول الخوارزمي' })}>
            {L({
              en: 'Run Expert Advisors written in MQL5 and test them on history with the built-in strategy tester.',
              ar: 'شغّل المستشارين الخبراء المكتوبين بلغة MQL5 واختبرهم على البيانات التاريخية باستخدام مختبر الاستراتيجيات المدمج.',
            })}
          </Feature>
          <Feature icon={<LuLayers />} title={L({ en: 'Depth of market', ar: 'عمق السوق' })}>
            {L({ en: 'See available volume at each price level and trade straight from the ladder.', ar: 'اطّلع على الأحجام المتاحة عند كل مستوى سعري وتداول مباشرة من نافذة العمق.' })}
          </Feature>
          <Feature icon={<LuListChecks />} title={L({ en: 'Flexible order types', ar: 'أنواع أوامر مرنة' })}>
            {L({
              en: 'Market orders plus buy and sell limit, stop and stop-limit pending orders, each with stop-loss and take-profit.',
              ar: 'أوامر السوق إضافة إلى الأوامر المعلقة: الحد والإيقاف والإيقاف المحدد للشراء والبيع، مع وقف الخسارة وجني الأرباح لكل منها.',
            })}
          </Feature>
          <Feature icon={<LuCalendarDays />} title={L({ en: 'Economic calendar', ar: 'المفكرة الاقتصادية' })}>
            {L({ en: 'Upcoming releases and their impact, built into the platform next to your charts.', ar: 'البيانات الاقتصادية القادمة وتأثيرها، مدمجة في المنصة بجوار رسومك البيانية.' })}
          </Feature>
          <Feature icon={<LuBell />} title={L({ en: 'Alerts and notifications', ar: 'التنبيهات والإشعارات' })}>
            {L({ en: 'Set price alerts and receive push notifications on your phone through your MetaQuotes ID.', ar: 'اضبط تنبيهات الأسعار واستقبل الإشعارات على هاتفك عبر معرّف MetaQuotes الخاص بك.' })}
          </Feature>
        </div>
      </Section>

      <Section id="webterminal">
        <SectionHeading
          eyebrow={L({ en: 'WebTerminal', ar: 'منصة الويب' })}
          title={L({ en: 'Or trade right here in your browser', ar: 'أو تداول هنا من متصفحك' })}
        />
        <WebTerminal />
      </Section>

      <Section>
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <SectionHeading
            align="start"
            eyebrow={L({ en: 'Connect', ar: 'الاتصال' })}
            title={L({ en: 'Log in to your account in three steps', ar: 'سجّل الدخول إلى حسابك في ثلاث خطوات' })}
          />
          <CheckList
            items={[
              L({
                en: 'Open a live or demo MT5 account in the client portal. Your login number and server are shown immediately; the password is displayed once, so save it.',
                ar: 'افتح حساب ميتاتريدر 5 حقيقيًا أو تجريبيًا من بوابة العملاء. يظهر رقم الدخول والخادم فورًا، وتُعرض كلمة المرور مرة واحدة فقط فاحفظها.',
              }),
              L({ en: 'Install MetaTrader 5 or open the web platform.', ar: 'ثبّت ميتاتريدر 5 أو افتح منصة الويب.' }),
              L({
                en: 'Choose File → Login to Trade Account, enter your login and password, select the server and confirm.',
                ar: 'اختر «ملف» ← «تسجيل الدخول إلى حساب تداول»، وأدخل رقم الدخول وكلمة المرور، واختر الخادم ثم أكّد.',
              }),
            ]}
          />
        </div>
      </Section>

      <Section>
        <SectionHeading title={L({ en: 'Desktop, web, mobile or TradingView?', ar: 'سطح المكتب أم الويب أم الجوال أم TradingView؟' })} />
        <PlatformComparison />
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading title={t.common.faq} />
          <Accordion items={faq} />
        </div>
      </Section>

      <CtaBand
        title={L({ en: 'Your MT5 login is a minute away', ar: 'بيانات دخولك إلى ميتاتريدر 5 على بُعد دقيقة' })}
        subtitle={L({ en: 'Create your profile, open an account and connect.', ar: 'أنشئ ملفك، وافتح حسابًا، واتصل بالمنصة.' })}
        actions={<CtaButtons />}
      />
    </>
  );
}
