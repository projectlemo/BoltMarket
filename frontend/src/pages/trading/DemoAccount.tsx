import { LuArrowRight, LuChartCandlestick, LuFlaskConical, LuGraduationCap, LuRefreshCw } from 'react-icons/lu';
import { useL, useT } from '../../i18n';
import { Seo } from '../../lib/head';
import { PlatformDownloads } from '../../components/marketing/Platforms';
import { ButtonLink } from '../../components/ui/Button';
import { Accordion, faqJsonLd } from '../../components/ui/Disclosure';
import { CtaBand, Feature, PageHero, Section, SectionHeading } from '../../components/ui/Section';

export default function DemoAccount() {
  const L = useL();
  const t = useT();
  const rows: [string, string, string][] = [
    [L({ en: 'Funds', ar: 'الأموال' }), L({ en: 'Virtual', ar: 'افتراضية' }), L({ en: 'Your own money', ar: 'أموالك الخاصة' })],
    [L({ en: 'Prices', ar: 'الأسعار' }), L({ en: 'Real-time', ar: 'لحظية' }), L({ en: 'Real-time', ar: 'لحظية' })],
    [L({ en: 'Platforms', ar: 'المنصات' }), 'MetaTrader 5', 'MetaTrader 5'],
    [L({ en: 'Identity verification', ar: 'التحقق من الهوية' }), L({ en: 'Not required', ar: 'غير مطلوب' }), L({ en: 'Required', ar: 'مطلوب' })],
    [L({ en: 'Profit and loss', ar: 'الربح والخسارة' }), L({ en: 'Simulated', ar: 'افتراضية' }), L({ en: 'Real', ar: 'حقيقية' })],
    [
      L({ en: 'Execution', ar: 'التنفيذ' }),
      L({ en: 'Simulated: no slippage or liquidity limits', ar: 'محاكاة: دون انزلاق سعري أو قيود سيولة' }),
      L({ en: 'Live market conditions', ar: 'ظروف السوق الفعلية' }),
    ],
  ];
  const faq = [
    {
      q: L({ en: 'Is the demo account free?', ar: 'هل الحساب التجريبي مجاني؟' }),
      a: L({ en: 'Yes. It costs nothing and you can open one as soon as your email is confirmed.', ar: 'نعم، لا يكلفك شيئًا ويمكنك فتحه بمجرد تأكيد بريدك الإلكتروني.' }),
    },
    {
      q: L({ en: 'Will demo results match live trading?', ar: 'هل تطابق نتائج الحساب التجريبي التداول الحقيقي؟' }),
      a: L({
        en: 'Not exactly. Demo orders are simulated, so they do not face slippage, liquidity limits or the emotional pressure of real money. Treat demo results as practice.',
        ar: 'ليس تمامًا. أوامر الحساب التجريبي محاكاة، فلا تواجه الانزلاق السعري أو قيود السيولة أو الضغط النفسي للمال الحقيقي. تعامل مع نتائجه كتدريب.',
      }),
    },
    {
      q: L({ en: 'Can I have demo and live accounts at the same time?', ar: 'هل يمكنني امتلاك حسابات تجريبية وحقيقية معًا؟' }),
      a: L({ en: 'Yes. Both appear side by side in your client portal.', ar: 'نعم، تظهر جميعها جنبًا إلى جنب في بوابة العملاء.' }),
    },
  ];
  return (
    <>
      <Seo
        title={L({ en: 'Free demo account', ar: 'حساب تجريبي مجاني' })}
        description={L({
          en: 'Practise trading forex, indices, crypto and metals on MetaTrader 5 with virtual funds and real-time prices. Free with Bolt Markets.',
          ar: 'تدرّب على تداول الفوركس والمؤشرات والعملات الرقمية والمعادن على ميتاتريدر 5 بأموال افتراضية وأسعار لحظية، مجانًا مع Bolt Markets.',
        })}
        jsonLd={[faqJsonLd(faq)]}
      />
      <PageHero
        crumbs={[{ label: t.nav.trading.label, to: '/trading/accounts' }, { label: t.nav.trading.demo[0] }]}
        eyebrow={L({ en: 'Demo account', ar: 'حساب تجريبي' })}
        title={L({ en: 'Practise with zero risk', ar: 'تدرّب دون أي مخاطرة' })}
        subtitle={L({
          en: 'Test strategies, learn MetaTrader 5 and get a feel for leverage with virtual funds at real-time prices.',
          ar: 'اختبر استراتيجياتك وتعلّم ميتاتريدر 5 وتعرّف على الرافعة المالية بأموال افتراضية وأسعار لحظية.',
        })}
        actions={
          <ButtonLink to="/register?demo=1" size="lg">
            {L({ en: 'Open a free demo', ar: 'افتح حسابًا تجريبيًا مجانيًا' })}
            <LuArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
          </ButtonLink>
        }
      />
      <Section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feature icon={<LuGraduationCap />} title={L({ en: 'Learn the platform', ar: 'تعلّم المنصة' })}>
            {L({ en: 'Practise placing, modifying and closing orders before real money is involved.', ar: 'تدرّب على وضع الأوامر وتعديلها وإغلاقها قبل استخدام أموال حقيقية.' })}
          </Feature>
          <Feature icon={<LuFlaskConical />} title={L({ en: 'Test strategies', ar: 'اختبر استراتيجياتك' })}>
            {L({ en: 'Try a new setup or an Expert Advisor in live conditions without risking capital.', ar: 'جرّب إعدادًا جديدًا أو مستشارًا خبيرًا في ظروف السوق الحية دون المخاطرة برأس مالك.' })}
          </Feature>
          <Feature icon={<LuChartCandlestick />} title={L({ en: 'Real-time prices', ar: 'أسعار لحظية' })}>
            {L({ en: 'Demo accounts stream real-time market prices, so practice reflects how markets move.', ar: 'تعرض الحسابات التجريبية أسعار السوق لحظيًا، فيعكس تدريبك حركة الأسواق الفعلية.' })}
          </Feature>
          <Feature icon={<LuRefreshCw />} title={L({ en: 'Open more anytime', ar: 'افتح المزيد في أي وقت' })}>
            {L({ en: 'Open extra demo accounts with different leverage from the portal.', ar: 'افتح حسابات تجريبية إضافية برافعات مختلفة من البوابة.' })}
          </Feature>
        </div>
      </Section>
      <Section>
        <SectionHeading title={L({ en: 'Demo vs live', ar: 'التجريبي مقابل الحقيقي' })} />
        <div className="glass mx-auto max-w-3xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="px-5 py-4 text-start text-fg-subtle">
                  <span className="sr-only">{L({ en: 'Feature', ar: 'الميزة' })}</span>
                </th>
                <th scope="col" className="px-5 py-4 text-start font-display font-bold text-bolt">
                  {L({ en: 'Demo', ar: 'تجريبي' })}
                </th>
                <th scope="col" className="px-5 py-4 text-start font-display font-bold">
                  {L({ en: 'Live', ar: 'حقيقي' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([k, d, l]) => (
                <tr key={k} className="border-b border-line/60 last:border-0">
                  <th scope="row" className="px-5 py-3.5 text-start font-medium text-fg-muted">
                    {k}
                  </th>
                  <td className="px-5 py-3.5">{d}</td>
                  <td className="px-5 py-3.5">{l}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section>
        <SectionHeading title={L({ en: 'Download the platform', ar: 'نزّل المنصة' })} />
        <PlatformDownloads />
      </Section>
      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading title={t.common.faq} />
          <Accordion items={faq} />
        </div>
      </Section>
      <CtaBand
        title={L({ en: 'Ready for the real market?', ar: 'مستعد للسوق الحقيقي؟' })}
        subtitle={L({ en: 'Switch to a live account whenever you are ready.', ar: 'انتقل إلى حساب حقيقي متى كنت مستعدًا.' })}
        actions={
          <>
            <ButtonLink to="/register" size="lg">
              {t.common.createAccount}
            </ButtonLink>
            <ButtonLink to="/trading/accounts" size="lg" variant="secondary">
              {t.common.compareAccounts}
            </ButtonLink>
          </>
        }
      />
    </>
  );
}
