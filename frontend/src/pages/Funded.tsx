import clsx from 'clsx';
import { LuArrowRight, LuBan, LuCalendarCheck, LuCircleDollarSign, LuFlag, LuShieldCheck, LuTarget, LuTrophy } from 'react-icons/lu';
import { fundedPlans, fundedRules as R } from '../config/funded';
import { useL, useT } from '../i18n';
import { compactUsd, usd } from '../lib/format';
import { Seo } from '../lib/head';
import { CheckList } from '../components/marketing/Blocks';
import { ButtonLink } from '../components/ui/Button';
import { Accordion, faqJsonLd } from '../components/ui/Disclosure';
import { Badge, Notice } from '../components/ui/Feedback';
import { CtaBand, Feature, PageHero, Section, SectionHeading } from '../components/ui/Section';

export default function Funded() {
  const L = useL();
  const t = useT();
  const phases = [
    {
      icon: <LuTarget />,
      title: L({ en: 'Phase 1 · Evaluation', ar: 'المرحلة 1 · التقييم' }),
      text: L({
        en: `Reach a ${R.phase1Target}% profit target while respecting the loss limits, trading on at least ${R.minTradingDays} days.`,
        ar: `حقّق هدف ربح ${R.phase1Target}% مع الالتزام بحدود الخسارة، والتداول خلال ${R.minTradingDays} أيام على الأقل.`,
      }),
    },
    {
      icon: <LuFlag />,
      title: L({ en: 'Phase 2 · Verification', ar: 'المرحلة 2 · التحقق' }),
      text: L({
        en: `Confirm consistency with a ${R.phase2Target}% target under the same rules. No time limit on either phase.`,
        ar: `أثبت ثبات أدائك بهدف ${R.phase2Target}% وفق القواعد نفسها، دون حد زمني لأي من المرحلتين.`,
      }),
    },
    {
      icon: <LuTrophy />,
      title: L({ en: 'Bolt Funded trader', ar: 'متداول ممول من Bolt' }),
      text: L({
        en: `Trade a funded account and receive ${R.profitSplit}% of the profits, rising to ${R.profitSplitScaled}% as you scale.`,
        ar: `تداول على حساب ممول واحصل على ${R.profitSplit}% من الأرباح، ترتفع إلى ${R.profitSplitScaled}% مع توسّع حسابك.`,
      }),
    },
  ];

  const faq = [
    {
      q: L({ en: 'Is the evaluation fee a deposit?', ar: 'هل رسوم التقييم إيداع؟' }),
      a: L({
        en: `No. The fee pays for access to the evaluation and is not trading capital. ${R.feeRefundedWithFirstPayout ? 'It is refunded with your first reward payout once you are funded.' : ''}`,
        ar: `لا. تغطي الرسوم الوصول إلى التقييم وليست رأس مال للتداول. ${R.feeRefundedWithFirstPayout ? 'وتُستردّ مع أول دفعة مكافآت بعد حصولك على التمويل.' : ''}`,
      }),
    },
    {
      q: L({ en: 'What counts as a trading day?', ar: 'ما الذي يُحتسب يوم تداول؟' }),
      a: L({ en: 'Any calendar day on which you open at least one trade.', ar: 'أي يوم تقويمي تفتح فيه صفقة واحدة على الأقل.' }),
    },
    {
      q: L({ en: 'How is the daily loss limit measured?', ar: 'كيف يُقاس حد الخسارة اليومية؟' }),
      a: L({
        en: `Your equity may not fall more than ${R.maxDailyLoss}% of the initial account size below its level at the start of the server day, including open positions.`,
        ar: `لا يجوز أن تنخفض حقوق الملكية بأكثر من ${R.maxDailyLoss}% من حجم الحساب الأولي عن مستواها في بداية يوم الخادم، بما في ذلك الصفقات المفتوحة.`,
      }),
    },
    {
      q: L({ en: 'When are rewards paid?', ar: 'متى تُدفع المكافآت؟' }),
      a: L({
        en: `Your first payout can be requested ${R.firstPayoutDays} days after your first funded trade, then every ${R.payoutCycleDays} days.`,
        ar: `يمكنك طلب أول دفعة بعد ${R.firstPayoutDays} يومًا من أول صفقة على الحساب الممول، ثم كل ${R.payoutCycleDays} يومًا.`,
      }),
    },
    {
      q: L({ en: 'Are evaluation accounts real?', ar: 'هل حسابات التقييم حقيقية؟' }),
      a: L({
        en: 'Evaluation and funded accounts trade with virtual funds on MetaTrader 5 at real-time prices. Rewards are paid by Bolt Markets according to the programme terms.',
        ar: 'تُتداول حسابات التقييم والحسابات الممولة بأموال افتراضية على ميتاتريدر 5 وبأسعار لحظية، وتدفع Bolt Markets المكافآت وفق شروط البرنامج.',
      }),
    },
  ];

  return (
    <>
      <Seo
        title={L({ en: 'Bolt Funded trader programme', ar: 'برنامج المتداول الممول من Bolt' })}
        description={L({
          en: `Pass a two-step evaluation and trade a funded account with up to ${R.profitSplitScaled}% profit share. Plans from ${compactUsd(fundedPlans[0].size)}.`,
          ar: `اجتز تقييمًا من مرحلتين وتداول على حساب ممول مع حصة أرباح تصل إلى ${R.profitSplitScaled}%. خطط تبدأ من ${compactUsd(fundedPlans[0].size)}.`,
        })}
        jsonLd={[faqJsonLd(faq)]}
      />
      <PageHero
        crumbs={[{ label: L({ en: 'Bolt Funded', ar: 'برنامج التمويل' }) }]}
        eyebrow={L({ en: 'Bolt Funded', ar: 'برنامج التمويل' })}
        title={L({ en: 'Show your skill. Get funded.', ar: 'أثبت مهارتك. واحصل على التمويل.' })}
        subtitle={L({
          en: `Pass a two-step evaluation and trade a Bolt Funded account with up to ${R.profitSplitScaled}% of the profits paid to you.`,
          ar: `اجتز تقييمًا من مرحلتين وتداول على حساب ممول من Bolt مع حصولك على ما يصل إلى ${R.profitSplitScaled}% من الأرباح.`,
        })}
        actions={
          <>
            <ButtonLink to="#plans" size="lg">
              {L({ en: 'See plans', ar: 'اطّلع على الخطط' })}
              <LuArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink to="#rules" size="lg" variant="secondary">
              {L({ en: 'Read the rules', ar: 'اقرأ القواعد' })}
            </ButtonLink>
          </>
        }
      />

      <Section>
        <SectionHeading eyebrow={L({ en: 'How it works', ar: 'كيف يعمل' })} title={L({ en: 'Two phases, then you are funded', ar: 'مرحلتان ثم تحصل على التمويل' })} />
        <div className="grid gap-4 md:grid-cols-3">
          {phases.map((p) => (
            <Feature key={p.title} icon={p.icon} title={p.title}>
              {p.text}
            </Feature>
          ))}
        </div>
      </Section>

      <Section id="plans">
        <SectionHeading eyebrow={L({ en: 'Plans', ar: 'الخطط' })} title={L({ en: 'Choose your account size', ar: 'اختر حجم حسابك' })} subtitle={L({ en: 'One-time fee per evaluation. Same rules on every size.', ar: 'رسوم لمرة واحدة لكل تقييم، والقواعد نفسها لكل الأحجام.' })} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {fundedPlans.map((p) => (
            <article key={p.size} className={clsx('glass flex flex-col gap-4 p-5', p.popular && 'border-bolt/60 shadow-[0_0_0_1px_rgb(255_212_0/0.35)]')}>
              <div className="flex items-center justify-between">
                <h3 className="num font-display text-2xl font-extrabold">{compactUsd(p.size)}</h3>
                {p.popular ? <Badge tone="bolt">{L({ en: 'Popular', ar: 'الأكثر طلبًا' })}</Badge> : null}
              </div>
              <dl className="flex flex-col gap-2 text-sm">
                {[
                  [L({ en: 'Phase 1 target', ar: 'هدف المرحلة 1' }), usd((p.size * R.phase1Target) / 100)],
                  [L({ en: 'Phase 2 target', ar: 'هدف المرحلة 2' }), usd((p.size * R.phase2Target) / 100)],
                  [L({ en: 'Daily loss limit', ar: 'حد الخسارة اليومية' }), usd((p.size * R.maxDailyLoss) / 100)],
                  [L({ en: 'Max loss', ar: 'أقصى خسارة' }), usd((p.size * R.maxOverallLoss) / 100)],
                  [L({ en: 'Profit share', ar: 'حصة الأرباح' }), `${R.profitSplit}%`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-fg-subtle">{k}</dt>
                    <dd className="num font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-auto border-t border-line pt-4">
                <p className="num font-display text-3xl font-extrabold">{usd(p.fee)}</p>
                <p className="text-xs text-fg-subtle">{L({ en: 'one-time fee', ar: 'رسوم لمرة واحدة' })}</p>
              </div>
              <ButtonLink to={`/portal/funded?plan=${p.size}`} variant={p.popular ? 'primary' : 'secondary'} className="w-full">
                {L({ en: 'Start evaluation', ar: 'ابدأ التقييم' })}
              </ButtonLink>
            </article>
          ))}
        </div>
      </Section>

      <Section id="rules">
        <SectionHeading eyebrow={L({ en: 'Rules', ar: 'القواعد' })} title={L({ en: 'Clear rules, applied the same way to everyone', ar: 'قواعد واضحة تُطبَّق على الجميع بالطريقة نفسها' })} />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="glass p-6 sm:p-7">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
              <LuShieldCheck className="h-5 w-5 text-bolt" aria-hidden="true" />
              {L({ en: 'Trading objectives', ar: 'أهداف التداول' })}
            </h3>
            <CheckList
              items={[
                L({ en: `Profit target: ${R.phase1Target}% in Phase 1 and ${R.phase2Target}% in Phase 2.`, ar: `هدف الربح: ${R.phase1Target}% في المرحلة 1 و${R.phase2Target}% في المرحلة 2.` }),
                L({ en: `Maximum daily loss: ${R.maxDailyLoss}% of the initial balance.`, ar: `أقصى خسارة يومية: ${R.maxDailyLoss}% من الرصيد الأولي.` }),
                L({ en: `Maximum overall loss: ${R.maxOverallLoss}% of the initial balance.`, ar: `أقصى خسارة إجمالية: ${R.maxOverallLoss}% من الرصيد الأولي.` }),
                L({ en: `Minimum ${R.minTradingDays} trading days per phase. No maximum time limit.`, ar: `${R.minTradingDays} أيام تداول على الأقل في كل مرحلة، دون حد زمني أقصى.` }),
                L({ en: `Leverage up to 1:${R.leverage} on evaluation and funded accounts.`, ar: `رافعة حتى 1:${R.leverage} على حسابات التقييم والحسابات الممولة.` }),
              ]}
            />
          </div>
          <div className="glass p-6 sm:p-7">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
              <LuBan className="h-5 w-5 text-down" aria-hidden="true" />
              {L({ en: 'Not permitted', ar: 'غير مسموح' })}
            </h3>
            <CheckList
              items={[
                L({ en: 'Exploiting price-feed errors, latency or tick arbitrage.', ar: 'استغلال أخطاء تدفق الأسعار أو فروق التأخير أو المراجحة اللحظية.' }),
                L({ en: 'Opposite positions across different accounts or with other traders.', ar: 'فتح صفقات متعاكسة بين حسابات مختلفة أو مع متداولين آخرين.' }),
                L({ en: 'Copying another trader’s evaluation or account management by third parties.', ar: 'نسخ تقييم متداول آخر أو إدارة الحساب من قِبل طرف ثالث.' }),
                L({ en: 'Any strategy that does not reflect real market conditions.', ar: 'أي استراتيجية لا تعكس ظروف السوق الحقيقية.' }),
              ]}
            />
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Feature icon={<LuCircleDollarSign />} title={L({ en: 'Payouts', ar: 'المدفوعات' })}>
            {L({
              en: `First payout ${R.firstPayoutDays} days after your first funded trade, then every ${R.payoutCycleDays} days, to the payout method in your portal.`,
              ar: `أول دفعة بعد ${R.firstPayoutDays} يومًا من أول صفقة ممولة، ثم كل ${R.payoutCycleDays} يومًا، إلى وسيلة الدفع المسجلة في بوابتك.`,
            })}
          </Feature>
          <Feature icon={<LuCalendarCheck />} title={L({ en: 'Scaling', ar: 'التوسّع' })}>
            {L({
              en: `Consistent funded traders can have their profit share raised to ${R.profitSplitScaled}% at review.`,
              ar: `يمكن رفع حصة الأرباح للمتداولين الممولين ذوي الأداء الثابت إلى ${R.profitSplitScaled}% عند المراجعة.`,
            })}
          </Feature>
        </div>
        <Notice tone="info" className="mt-5">
          {L({
            en: 'Evaluation and funded accounts use virtual funds. Fees are for access to the evaluation and are not deposits or investments. Full programme terms are provided before purchase.',
            ar: 'تستخدم حسابات التقييم والحسابات الممولة أموالًا افتراضية. الرسوم مقابل الوصول إلى التقييم وليست إيداعات أو استثمارات، وتُقدَّم شروط البرنامج كاملة قبل الشراء.',
          })}
        </Notice>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading title={t.common.faq} />
          <Accordion items={faq} />
        </div>
      </Section>

      <CtaBand
        title={L({ en: 'Your strategy, our capital', ar: 'استراتيجيتك وتمويلنا' })}
        subtitle={L({ en: 'Pick a plan and start your evaluation today.', ar: 'اختر خطة وابدأ تقييمك اليوم.' })}
        actions={
          <ButtonLink to="#plans" size="lg">
            {L({ en: 'Choose a plan', ar: 'اختر خطة' })}
          </ButtonLink>
        }
      />
    </>
  );
}
