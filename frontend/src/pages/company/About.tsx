import { LuBadgeCheck, LuCpu, LuEye, LuFileText, LuHandshake, LuLanguages, LuScale, LuShieldCheck } from 'react-icons/lu';
import { accountTypes } from '../../config/accounts';
import { instruments } from '../../config/markets';
import { companyConfigured, regulatoryConfigured, site } from '../../config/site';
import { fmt, useL, useT } from '../../i18n';
import { usd } from '../../lib/format';
import { Seo } from '../../lib/head';
import { Link } from '../../router';
import { CtaButtons } from '../../components/marketing/Blocks';
import { CtaBand, Fact, Feature, PageHero, Section, SectionHeading } from '../../components/ui/Section';

export default function About() {
  const L = useL();
  const t = useT();
  const c = site.company;
  return (
    <>
      <Seo
        title={L({ en: 'About Bolt Markets', ar: 'عن Bolt Markets' })}
        description={L({
          en: 'Bolt Markets is a multi-asset broker on MetaTrader 5 focused on clear pricing, a capable client portal and a full experience in English and Arabic.',
          ar: 'Bolt Markets وسيط متعدد الأصول على ميتاتريدر 5 يركّز على وضوح التسعير وبوابة عملاء متكاملة وتجربة كاملة بالعربية والإنجليزية.',
        })}
      />
      <PageHero
        crumbs={[{ label: t.nav.company.label }, { label: t.nav.company.about[0] }]}
        eyebrow={L({ en: 'About us', ar: 'من نحن' })}
        title={L({ en: 'Built for traders who move fast', ar: 'صُممت للمتداولين الذين يتحركون بسرعة' })}
        subtitle={L({
          en: 'Bolt Markets is a multi-asset broker on MetaTrader 5. We focus on three things: pricing you can read before you trade, a client portal that does what it should, and a complete experience in English and Arabic.',
          ar: 'Bolt Markets وسيط متعدد الأصول على ميتاتريدر 5. نركّز على ثلاثة أمور: أسعار تقرؤها قبل أن تتداول، وبوابة عملاء تؤدي ما يُنتظر منها، وتجربة كاملة بالعربية والإنجليزية.',
        })}
      >
        <div className="mt-4 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact value={String(instruments.length)} label={L({ en: 'Instruments', ar: 'أداة' })} />
          <Fact value="4" label={L({ en: 'Asset classes', ar: 'فئات أصول' })} />
          <Fact value={String(accountTypes.length)} label={L({ en: 'Account types', ar: 'أنواع حسابات' })} />
          <Fact value={usd(Math.min(...accountTypes.map((a) => a.minDeposit)))} label={L({ en: 'To get started', ar: 'للبدء' })} />
        </div>
      </PageHero>

      <Section>
        <SectionHeading eyebrow={L({ en: 'Approach', ar: 'نهجنا' })} title={L({ en: 'How we work', ar: 'كيف نعمل' })} />
        <div className="grid gap-4 md:grid-cols-3">
          <Feature icon={<LuEye />} title={L({ en: 'Clarity first', ar: 'الوضوح أولًا' })}>
            {L({
              en: 'Minimum spreads, commissions, leverage and deposit requirements are published for every account, and our calculators show the numbers behind a trade before you place it.',
              ar: 'نعلن الحد الأدنى للسبريد والعمولات والرافعة ومتطلبات الإيداع لكل حساب، وتوضح حاسباتنا أرقام الصفقة قبل تنفيذها.',
            })}
          </Feature>
          <Feature icon={<LuCpu />} title={L({ en: 'Technology that works', ar: 'تقنية تؤدي عملها' })}>
            {L({
              en: 'MetaTrader 5 on every device and a modern portal for accounts, verification, payments and support, with two-factor security built in.',
              ar: 'ميتاتريدر 5 على كل الأجهزة، وبوابة حديثة للحسابات والتحقق والمدفوعات والدعم، مع حماية مدمجة بالمصادقة الثنائية.',
            })}
          </Feature>
          <Feature icon={<LuScale />} title={L({ en: 'Responsible trading', ar: 'تداول مسؤول' })}>
            {L({
              en: 'Leveraged trading is risky. We explain the risks plainly, give you tools to manage them and verify every client before money moves.',
              ar: 'التداول بالرافعة المالية محفوف بالمخاطر، لذلك نشرح المخاطر بوضوح ونوفّر لك أدوات إدارتها ونتحقق من كل عميل قبل أي حركة للأموال.',
            })}
          </Feature>
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow={L({ en: 'Commitments', ar: 'التزاماتنا' })} title={L({ en: 'What you can expect from us', ar: 'ما الذي يمكنك توقّعه منا' })} />
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: <LuFileText />, title: L({ en: 'Written policies', ar: 'سياسات مكتوبة' }), text: L({ en: 'How we execute orders, handle your data and manage risk is documented in our legal section.', ar: 'نوثّق في القسم القانوني كيفية تنفيذ الأوامر والتعامل مع بياناتك وإدارة المخاطر.' }), to: '/legal/order-execution-policy' },
            { icon: <LuShieldCheck />, title: L({ en: 'Protected accounts', ar: 'حسابات محمية' }), text: L({ en: 'Two-factor login, encrypted connections and role-based access for our staff.', ar: 'تسجيل دخول بخطوتين، واتصالات مشفّرة، وصلاحيات محددة لموظفينا حسب الدور.' }), to: '/help' },
            { icon: <LuLanguages />, title: L({ en: 'Your language', ar: 'لغتك' }), text: L({ en: 'Every page and the full client portal in English and Arabic.', ar: 'كل الصفحات وبوابة العملاء بالكامل بالعربية والإنجليزية.' }), to: '/company/contact' },
            { icon: <LuHandshake />, title: L({ en: 'Fair processes', ar: 'إجراءات عادلة' }), text: L({ en: 'Withdrawals, verification and support follow the same documented steps for every client.', ar: 'تتبع السحوبات والتحقق والدعم الخطوات الموثّقة نفسها لجميع العملاء.' }), to: '/legal/client-agreement' },
          ].map((x) => (
            <Link key={x.title} to={x.to} className="glass glass-hover flex gap-4 p-6">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-bolt/25 bg-bolt/10 text-bolt [&>svg]:h-5 [&>svg]:w-5">{x.icon}</span>
              <span className="flex flex-col gap-1">
                <span className="text-lg font-bold">{x.title}</span>
                <span className="text-sm leading-relaxed text-fg-muted">{x.text}</span>
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {companyConfigured || regulatoryConfigured ? (
        <Section>
          <div className="glass mx-auto flex max-w-3xl flex-col gap-4 p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <LuBadgeCheck className="h-5 w-5 text-bolt" aria-hidden="true" />
              {L({ en: 'Company information', ar: 'معلومات الشركة' })}
            </h2>
            {companyConfigured ? (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-fg-subtle">{L({ en: 'Legal name', ar: 'الاسم القانوني' })}</dt>
                  <dd className="font-semibold">{c.legalName}</dd>
                </div>
                <div>
                  <dt className="text-fg-subtle">{L({ en: 'Registration number', ar: 'رقم التسجيل' })}</dt>
                  <dd className="font-semibold" dir="ltr">{c.registrationNumber}</dd>
                </div>
                {c.address ? (
                  <div className="sm:col-span-2">
                    <dt className="text-fg-subtle">{L({ en: 'Registered address', ar: 'العنوان المسجّل' })}</dt>
                    <dd className="font-semibold">{c.address}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            {regulatoryConfigured ? (
              <p className="text-sm text-fg-muted">
                {c.regulatoryStatus === 'regulated'
                  ? fmt(t.footer.regulated, { regulator: c.regulator, license: c.licenseNumber })
                  : fmt(t.footer.unregulated, { name: c.legalName || site.brand, jurisdiction: c.jurisdiction })}
              </p>
            ) : null}
          </div>
        </Section>
      ) : null}

      <CtaBand title={L({ en: 'Trade with Bolt', ar: 'تداول مع Bolt' })} subtitle={L({ en: 'Open an account or try the platform on a free demo.', ar: 'افتح حسابًا أو جرّب المنصة على حساب تجريبي مجاني.' })} actions={<CtaButtons />} />
    </>
  );
}
