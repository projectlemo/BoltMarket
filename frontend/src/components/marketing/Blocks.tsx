import clsx from 'clsx';
import type { ReactNode } from 'react';
import { FaDiscord, FaWhatsapp } from 'react-icons/fa6';
import {
  LuArrowRight,
  LuBookOpen,
  LuBuilding2,
  LuCalendarDays,
  LuChartCandlestick,
  LuCoins,
  LuCreditCard,
  LuGauge,
  LuLayers,
  LuLifeBuoy,
  LuMail,
  LuMessageCircle,
  LuMessagesSquare,
  LuPhone,
  LuScale,
  LuShieldCheck,
  LuSparkles,
  LuTicket,
  LuUserPlus,
  LuWallet,
  LuZap,
} from 'react-icons/lu';
import type { IconType } from 'react-icons';
import { site } from '../../config/site';
import { accountTypes } from '../../config/accounts';
import { posts, type PostMeta } from '../../content/blog';
import { fmt, useL, useT } from '../../i18n';
import { formatDate, usd } from '../../lib/format';
import { Link, useLang } from '../../router';
import { BoltLines } from '../ui/Brand';
import { ButtonLink } from '../ui/Button';
import { openLiveChat } from '../../lib/livechat';

/* ─────────────────────────── 3-step onboarding ─────────────────────────── */
export function Steps({ compact = false }: { compact?: boolean }) {
  const L = useL();
  const minDep = Math.min(...accountTypes.map((a) => a.minDeposit));
  const steps: { icon: IconType; title: string; text: string }[] = [
    {
      icon: LuUserPlus,
      title: L({ en: 'Register', ar: 'سجّل' }),
      text: L({
        en: 'Create your profile with your name, email and country, then confirm your email and verify your identity in the client portal.',
        ar: 'أنشئ ملفك الشخصي بالاسم والبريد الإلكتروني والدولة، ثم أكّد بريدك وتحقّق من هويتك عبر بوابة العملاء.',
      }),
    },
    {
      icon: LuWallet,
      title: L({ en: 'Fund', ar: 'موّل' }),
      text: L({
        en: `Open an MT5 account and deposit from ${usd(minDep)} by card or cryptocurrency. Funds are credited once the payment is confirmed.`,
        ar: `افتح حساب ميتاتريدر 5 وأودِع ابتداءً من ${usd(minDep)} بالبطاقة أو بالعملات الرقمية. تُضاف الأموال فور تأكيد الدفع.`,
      }),
    },
    {
      icon: LuChartCandlestick,
      title: L({ en: 'Trade', ar: 'تداول' }),
      text: L({
        en: 'Log in to MetaTrader 5 on desktop, web or mobile with the credentials shown in your portal and place your first trade.',
        ar: 'سجّل الدخول إلى ميتاتريدر 5 على سطح المكتب أو الويب أو الجوال باستخدام البيانات الظاهرة في بوابتك، ونفّذ صفقتك الأولى.',
      }),
    },
  ];
  return (
    <ol className="relative grid gap-5 md:grid-cols-3">
      <div aria-hidden="true" className="absolute inset-x-[16%] top-11 hidden h-px bg-gradient-to-r from-transparent via-bolt/50 to-transparent md:block" />
      {steps.map((s, i) => {
        const Icon = s.icon;
        return (
          <li key={s.title} className={clsx('glass relative flex flex-col gap-4 p-6', compact ? '' : 'sm:p-7')}>
            <div className="flex items-center gap-4">
              <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-bolt text-bolt-ink shadow-[0_10px_30px_-10px_rgb(255_212_0/0.7)]">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="num font-display text-5xl font-extrabold text-white/10">0{i + 1}</span>
            </div>
            <h3 className="text-xl font-bold">{s.title}</h3>
            <p className="text-[0.95rem] leading-relaxed text-fg-muted">{s.text}</p>
          </li>
        );
      })}
    </ol>
  );
}

/* ─────────────────────────── Deposit methods ─────────────────────────── */
export function DepositMethods() {
  const L = useL();
  const minDep = Math.min(...accountTypes.map((a) => a.minDeposit));
  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass flex flex-col gap-4 p-6">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.06] text-fg">
            <LuCreditCard className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-lg font-bold">{L({ en: 'Debit & credit cards', ar: 'البطاقات المدينة والائتمانية' })}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
              {L({
                en: 'Pay on a secure hosted checkout page. Card details never touch Bolt Markets servers.',
                ar: 'ادفع عبر صفحة دفع آمنة مستضافة لدى مزوّد الدفع، ولا تمر بيانات بطاقتك عبر خوادم Bolt Markets.',
              })}
            </p>
          </div>
        </div>
        <div className="glass flex flex-col gap-4 p-6">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.06] text-fg">
            <LuCoins className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-lg font-bold">{L({ en: 'Cryptocurrency', ar: 'العملات الرقمية' })}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
              {L({
                en: 'Fund with major coins and stablecoins through an invoice with a unique payment address for every deposit.',
                ar: 'موّل حسابك بالعملات الرئيسية والعملات المستقرة عبر فاتورة بعنوان دفع فريد لكل عملية إيداع.',
              })}
            </p>
          </div>
        </div>
      </div>
      <div className="glass flex flex-col justify-between gap-6 p-6 sm:p-7">
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-fg-subtle">{L({ en: 'Minimum deposit', ar: 'الحد الأدنى للإيداع' })}</dt>
            <dd className="num mt-1 font-display text-3xl font-extrabold">{usd(minDep)}</dd>
          </div>
          <div>
            <dt className="text-sm text-fg-subtle">{L({ en: 'Deposit fees', ar: 'رسوم الإيداع' })}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-fg-muted">
              {L({ en: 'Shown before you confirm any payment.', ar: 'تظهر لك قبل تأكيد أي عملية دفع.' })}
            </dd>
          </div>
        </dl>
        <ul className="flex flex-col gap-3 text-sm text-fg-muted">
          {[
            L({ en: 'Deposits are credited to your MT5 account once the payment is confirmed.', ar: 'تُضاف الإيداعات إلى حساب ميتاتريدر 5 فور تأكيد الدفع.' }),
            L({
              en: 'Withdrawals are requested in the portal and reviewed by our finance team.',
              ar: 'تُطلب السحوبات من البوابة وتراجعها إدارة المالية لدينا.',
            }),
            L({
              en: 'Funds are returned to the original method where possible, as anti-money-laundering rules require.',
              ar: 'تُعاد الأموال إلى وسيلة الدفع الأصلية متى أمكن، وفق متطلبات مكافحة غسل الأموال.',
            }),
          ].map((x) => (
            <li key={x} className="flex gap-2.5">
              <LuShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-bolt" aria-hidden="true" />
              {x}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─────────────────────────── Support channels ─────────────────────────── */
export function SupportBlock() {
  const L = useL();
  const s = site.support;
  const channels: { icon: IconType; title: string; text: string; href: string; cta: string; onClick?: () => void }[] = [];
  if (s.liveChatProvider && s.liveChatId)
    channels.push({
      icon: LuMessagesSquare,
      title: L({ en: 'Live chat', ar: 'الدردشة المباشرة' }),
      text: L({ en: 'Chat with our team from any page of the website.', ar: 'تحدّث مع فريقنا من أي صفحة في الموقع.' }),
      href: '',
      cta: L({ en: 'Start a chat', ar: 'ابدأ المحادثة' }),
      onClick: openLiveChat,
    });
  if (s.email)
    channels.push({ icon: LuMail, title: L({ en: 'Email', ar: 'البريد الإلكتروني' }), text: s.email, href: `mailto:${s.email}`, cta: L({ en: 'Send an email', ar: 'أرسل بريدًا' }) });
  if (s.phone) channels.push({ icon: LuPhone, title: L({ en: 'Phone', ar: 'الهاتف' }), text: s.phone, href: `tel:${s.phone.replace(/[^\d+]/g, '')}`, cta: L({ en: 'Call us', ar: 'اتصل بنا' }) });
  if (s.whatsapp)
    channels.push({ icon: FaWhatsapp, title: 'WhatsApp', text: `+${s.whatsapp}`, href: `https://wa.me/${s.whatsapp}`, cta: L({ en: 'Message us', ar: 'راسلنا' }) });

  const always: { icon: IconType; title: string; text: string; to: string; cta: string }[] = [
    {
      icon: LuLifeBuoy,
      title: L({ en: 'Help Center', ar: 'مركز المساعدة' }),
      text: L({ en: 'Searchable answers about accounts, payments, verification and MT5.', ar: 'إجابات قابلة للبحث حول الحسابات والمدفوعات والتحقق وميتاتريدر 5.' }),
      to: '/help',
      cta: L({ en: 'Search answers', ar: 'ابحث في الإجابات' }),
    },
    {
      icon: LuTicket,
      title: L({ en: 'Support tickets', ar: 'تذاكر الدعم' }),
      text: L({ en: 'Raise and track requests from your client portal.', ar: 'افتح طلباتك وتابعها من بوابة العملاء.' }),
      to: '/portal/support',
      cta: L({ en: 'Open a ticket', ar: 'افتح تذكرة' }),
    },
    {
      icon: LuMessageCircle,
      title: L({ en: 'Contact form', ar: 'نموذج التواصل' }),
      text: L({ en: 'Questions before you open an account? Write to us.', ar: 'لديك أسئلة قبل فتح الحساب؟ راسلنا.' }),
      to: '/company/contact',
      cta: L({ en: 'Contact us', ar: 'تواصل معنا' }),
    },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {always.map((c) => {
        const Icon = c.icon;
        return (
          <Link key={c.title} to={c.to} className="glass glass-hover group flex flex-col gap-3 p-6">
            <Icon className="h-6 w-6 text-bolt" aria-hidden="true" />
            <h3 className="text-lg font-bold">{c.title}</h3>
            <p className="text-sm leading-relaxed text-fg-muted">{c.text}</p>
            <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-fg group-hover:text-bolt">
              {c.cta}
              <LuArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
            </span>
          </Link>
        );
      })}
      {channels.map((c) => {
        const Icon = c.icon;
        const body = (
          <>
            <Icon className="h-6 w-6 text-bolt" aria-hidden="true" />
            <h3 className="text-lg font-bold">{c.title}</h3>
            <p className="text-sm text-fg-muted" dir={c.onClick ? undefined : 'ltr'}>
              {c.text}
            </p>
            <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-fg group-hover:text-bolt">
              {c.cta}
              <LuArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
            </span>
          </>
        );
        return c.onClick ? (
          <button key={c.title} type="button" onClick={c.onClick} className="glass glass-hover group flex flex-col gap-3 p-6 text-start">
            {body}
          </button>
        ) : (
          <a key={c.title} href={c.href} className="glass glass-hover group flex flex-col gap-3 p-6" {...(c.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {body}
          </a>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── Discord (only when configured) ─────────────────────────── */
export function DiscordBlock() {
  const L = useL();
  if (!site.social.discord) return null;
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-[#5865F2]/30 bg-[radial-gradient(80%_120%_at_100%_0%,rgb(88_101_242/0.25),transparent_60%),linear-gradient(180deg,#141414,#0e0e0e)] p-8 sm:p-12">
      <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#8f99ff]">
            <FaDiscord className="h-5 w-5" aria-hidden="true" />
            {L({ en: 'Community', ar: 'المجتمع' })}
          </span>
          <h2 className="text-3xl font-extrabold sm:text-4xl">{L({ en: 'Join the Bolt Markets Discord', ar: 'انضم إلى مجتمع Bolt Markets على ديسكورد' })}</h2>
          <p className="max-w-xl text-fg-muted">
            {L({
              en: 'Talk markets with other traders, get platform tips and hear about new features first. Community posts are opinions, not investment advice.',
              ar: 'ناقش الأسواق مع متداولين آخرين، واحصل على نصائح حول المنصة، وكن أول من يعرف بالميزات الجديدة. منشورات المجتمع آراء وليست نصائح استثمارية.',
            })}
          </p>
        </div>
        <a
          href={site.social.discord}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-7 font-semibold text-white transition hover:bg-[#4752c4]"
        >
          <FaDiscord className="h-5 w-5" aria-hidden="true" />
          {L({ en: 'Join the server', ar: 'انضم إلى الخادم' })}
        </a>
      </div>
    </div>
  );
}

/* ─────────────────────────── Blog cards ─────────────────────────── */
const motifIcon: Record<PostMeta['motif'], IconType> = {
  pairs: LuScale,
  lots: LuLayers,
  risk: LuShieldCheck,
  mt5: LuChartCandlestick,
  spread: LuSparkles,
  margin: LuGauge,
  mind: LuZap,
  bank: LuBuilding2,
  gold: LuCoins,
  calendar: LuCalendarDays,
};

/** Generated cover art (no stock imagery). */
export function PostCover({ motif, className, large = false }: { motif: PostMeta['motif']; className?: string; large?: boolean }) {
  const Icon = motifIcon[motif] ?? LuBookOpen;
  return (
    <div
      className={clsx(
        'relative isolate overflow-hidden bg-[radial-gradient(70%_90%_at_80%_10%,rgb(255_212_0/0.22),transparent_60%),linear-gradient(160deg,#1c1c1c,#0c0c0c)]',
        className,
      )}
      aria-hidden="true"
    >
      <div className="bg-grid absolute inset-0 opacity-70" />
      <BoltLines className="absolute inset-0 h-full w-full opacity-70" />
      <svg viewBox="0 0 200 80" className="absolute inset-x-4 bottom-3 h-1/2 w-[calc(100%-2rem)] opacity-50" preserveAspectRatio="none">
        {Array.from({ length: 14 }).map((_, i) => {
          const h = 18 + ((i * 37) % 44);
          const up = (i * 7) % 3 !== 0;
          return <rect key={i} x={6 + i * 14} y={80 - h - ((i * 13) % 18)} width="7" height={h} rx="1.5" fill={up ? '#2BD47D' : '#FF6B6B'} opacity="0.55" />;
        })}
      </svg>
      <span className={clsx('absolute start-5 top-5 grid place-items-center rounded-2xl bg-bolt text-bolt-ink shadow-[0_12px_30px_-10px_rgb(255_212_0/0.8)]', large ? 'h-16 w-16' : 'h-12 w-12')}>
        <Icon className={large ? 'h-8 w-8' : 'h-6 w-6'} />
      </span>
    </div>
  );
}

export function PostCard({ post, className }: { post: PostMeta; className?: string }) {
  const L = useL();
  const t = useT();
  const lang = useLang();
  return (
    <Link to={`/blog/${post.slug}`} className={clsx('glass glass-hover group flex flex-col overflow-hidden', className)}>
      <PostCover motif={post.motif} className="aspect-[16/9] w-full" />
      <div className="flex flex-1 flex-col gap-3 p-6">
        <p className="flex items-center gap-2 text-xs text-fg-subtle">
          <span className="font-semibold text-bolt uppercase">{post.category === 'learn' ? L({ en: 'Learn', ar: 'تعلّم' }) : L({ en: 'Insights', ar: 'رؤى السوق' })}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={post.date}>{formatDate(post.date, lang)}</time>
          <span aria-hidden="true">·</span>
          <span>{fmt(t.common.minRead, { n: post.minutes })}</span>
        </p>
        <h3 className="text-lg leading-snug font-bold transition group-hover:text-bolt">{L(post.title)}</h3>
        <p className="line-clamp-3 text-sm leading-relaxed text-fg-muted">{L(post.excerpt)}</p>
      </div>
    </Link>
  );
}

export function LatestPosts({ count = 3, category }: { count?: number; category?: PostMeta['category'] }) {
  const list = posts.filter((p) => !category || p.category === category).slice(0, count);
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {list.map((p) => (
        <PostCard key={p.slug} post={p} />
      ))}
    </div>
  );
}

/* ─────────────────────────── Misc ─────────────────────────── */
export function CheckList({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <ul className={clsx('flex flex-col gap-3', className)}>
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-fg-muted">
          <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-bolt/15 text-bolt">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </span>
          <span className="leading-relaxed">{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function CtaButtons({ demo = true }: { demo?: boolean }) {
  const t = useT();
  return (
    <>
      <ButtonLink to="/register" size="lg">
        {t.common.createAccount}
        <LuArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
      </ButtonLink>
      {demo ? (
        <ButtonLink to="/trading/demo-account" size="lg" variant="secondary">
          {t.common.tryDemo}
        </ButtonLink>
      ) : null}
    </>
  );
}
