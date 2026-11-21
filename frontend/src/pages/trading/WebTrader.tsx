import { LuGlobe, LuLock, LuMonitorSmartphone, LuRefreshCw } from 'react-icons/lu';
import { useL, useT } from '../../i18n';
import { Seo } from '../../lib/head';
import { CheckList, CtaButtons } from '../../components/marketing/Blocks';
import { TerminalMock } from '../../components/marketing/Illustrations';
import { WebTerminal } from '../../components/marketing/WebTerminal';
import { Accordion, faqJsonLd } from '../../components/ui/Disclosure';
import { CtaBand, Feature, PageHero, Section, SectionHeading } from '../../components/ui/Section';

export default function WebTrader() {
  const L = useL();
  const t = useT();
  const faq = [
    {
      q: L({ en: 'Do I need to install anything?', ar: 'هل أحتاج إلى تثبيت أي شيء؟' }),
      a: L({ en: 'No. The web platform runs in any modern browser on Windows, macOS, Linux or ChromeOS.', ar: 'لا. تعمل منصة الويب على أي متصفح حديث في ويندوز أو ماك أو لينكس أو كروم أو إس.' }),
    },
    {
      q: L({ en: 'Is web trading secure?', ar: 'هل التداول عبر الويب آمن؟' }),
      a: L({
        en: 'Connections are encrypted end to end. Log out when you finish on shared computers and never let the browser save your trading password there.',
        ar: 'الاتصالات مشفّرة بالكامل. سجّل الخروج عند الانتهاء على الأجهزة المشتركة ولا تسمح للمتصفح بحفظ كلمة مرور التداول عليها.',
      }),
    },
    {
      q: L({ en: 'Can I run Expert Advisors on the web?', ar: 'هل يمكنني تشغيل المستشارين الخبراء على الويب؟' }),
      a: L({ en: 'No. Automated trading and custom indicators require the desktop platform.', ar: 'لا. يتطلب التداول الآلي والمؤشرات المخصّصة منصة سطح المكتب.' }),
    },
  ];
  return (
    <>
      <Seo
        title={L({ en: 'Web Trader', ar: 'منصة التداول عبر الويب' })}
        description={L({
          en: 'Trade forex, indices, crypto and metals from any browser with the MetaTrader 5 web platform. Nothing to install.',
          ar: 'تداول الفوركس والمؤشرات والعملات الرقمية والمعادن من أي متصفح عبر منصة ميتاتريدر 5 للويب، دون أي تثبيت.',
        })}
        jsonLd={[faqJsonLd(faq)]}
      />
      <PageHero
        crumbs={[{ label: t.nav.trading.label, to: '/trading/accounts' }, { label: t.nav.trading.web[0] }]}
        eyebrow={L({ en: 'Web Trader', ar: 'منصة الويب' })}
        title={L({ en: 'Trade from any browser in seconds', ar: 'تداول من أي متصفح خلال ثوانٍ' })}
        subtitle={L({
          en: 'The MetaTrader 5 web platform gives you charts, one-click trading and your full account on any computer, with nothing to download.',
          ar: 'تمنحك منصة ميتاتريدر 5 للويب الرسوم البيانية والتداول بنقرة واحدة وحسابك كاملًا على أي جهاز كمبيوتر، دون أي تنزيل.',
        })}
        actions={<CtaButtons />}
        aside={<TerminalMock title="MT5 Web" />}
      />
      <Section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feature icon={<LuGlobe />} title={L({ en: 'Nothing to install', ar: 'دون تثبيت' })}>
            {L({ en: 'Open it on any computer, including ones where you cannot install software.', ar: 'افتحها على أي جهاز، حتى الأجهزة التي لا يمكنك تثبيت البرامج عليها.' })}
          </Feature>
          <Feature icon={<LuRefreshCw />} title={L({ en: 'Always up to date', ar: 'محدَّثة دائمًا' })}>
            {L({ en: 'Updates are delivered automatically every time you load the platform.', ar: 'تصلك التحديثات تلقائيًا في كل مرة تفتح فيها المنصة.' })}
          </Feature>
          <Feature icon={<LuMonitorSmartphone />} title={L({ en: 'In sync everywhere', ar: 'متزامنة في كل مكان' })}>
            {L({ en: 'Orders and positions match your desktop and mobile apps instantly.', ar: 'تتطابق الأوامر والصفقات مع تطبيقات سطح المكتب والجوال فورًا.' })}
          </Feature>
          <Feature icon={<LuLock />} title={L({ en: 'Encrypted', ar: 'مشفَّرة' })}>
            {L({ en: 'Your session and trading data travel over encrypted connections.', ar: 'تنتقل جلستك وبيانات تداولك عبر اتصالات مشفّرة.' })}
          </Feature>
        </div>
      </Section>
      <Section>
        <SectionHeading title={L({ en: 'Launch the web platform', ar: 'شغّل منصة الويب' })} />
        <WebTerminal />
      </Section>
      <Section>
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <SectionHeading
            align="start"
            title={L({ en: 'What you need', ar: 'ما الذي تحتاجه' })}
            subtitle={L({ en: 'A recent version of one of these browsers and a stable connection.', ar: 'إصدار حديث من أحد هذه المتصفحات واتصال إنترنت مستقر.' })}
          />
          <CheckList
            items={[
              'Google Chrome, Microsoft Edge',
              'Mozilla Firefox',
              'Safari (macOS, iPadOS)',
              L({ en: 'Your MT5 login, password and server from the client portal', ar: 'رقم الدخول وكلمة المرور والخادم من بوابة العملاء' }),
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
      <CtaBand title={L({ en: 'Start trading from your browser', ar: 'ابدأ التداول من متصفحك' })} actions={<CtaButtons />} />
    </>
  );
}
