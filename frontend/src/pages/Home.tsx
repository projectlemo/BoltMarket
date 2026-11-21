import clsx from 'clsx';
import { useState, type FormEvent } from 'react';
import { LuArrowRight, LuCalculator, LuCpu, LuGauge, LuLanguages, LuLayers, LuLock, LuMonitorSmartphone, LuReceipt, LuShieldCheck, LuSparkles, LuWallet } from 'react-icons/lu';
import { accountCopy, accountTypes } from '../config/accounts';
import { bySymbol, formatSymbol, instruments, instrumentsFor, markets } from '../config/markets';
import { site } from '../config/site';
import { useL, useT } from '../i18n';
import { useQuote } from '../lib/feed';
import { group, usd } from '../lib/format';
import { Seo } from '../lib/head';
import { Link, toHref, useNavigate, useRouter } from '../router';
import { feedPossible, spreadIn } from '../components/market/Prices';
import { AccountComparison } from '../components/marketing/AccountComparison';
import { CtaButtons, DepositMethods, DiscordBlock, LatestPosts, Steps, SupportBlock } from '../components/marketing/Blocks';
import { InstrumentRange, MarketHub, QuoteBoard, marketMeta } from '../components/marketing/MarketHub';
import { PlatformComparison, PlatformDownloads } from '../components/marketing/Platforms';
import { BoltIcon, BoltLines } from '../components/ui/Brand';
import { Button, ButtonLink } from '../components/ui/Button';
import { Accordion, faqJsonLd } from '../components/ui/Disclosure';
import { CtaBand, Fact, Feature, Section, SectionHeading } from '../components/ui/Section';

const institutional = accountTypes.find((a) => a.id === 'institutional') ?? accountTypes[accountTypes.length - 1];

const minDeposit = Math.min(...accountTypes.map((a) => a.minDeposit));
const lowestSpread = Math.min(...accountTypes.map((a) => a.spreadFrom));
const maxLeverage = Math.max(...accountTypes.map((a) => a.maxLeverage));

function HeroSignup() {
  const L = useL();
  const t = useT();
  const navigate = useNavigate();
  const { state } = useRouter();
  const [email, setEmail] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/register${email ? `?email=${encodeURIComponent(email)}` : ''}`);
  };
  return (
    <form
      onSubmit={submit}
      action={toHref('/register', state.lang)}
      method="get"
      className="glass glass-blur flex w-full max-w-xl flex-col gap-2 p-2 sm:flex-row"
      aria-label={L({ en: 'Start your registration', ar: 'ابدأ التسجيل' })}
    >
      <label htmlFor="hero-email" className="sr-only">
        {L({ en: 'Email address', ar: 'البريد الإلكتروني' })}
      </label>
      <input
        id="hero-email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={L({ en: 'Enter your email', ar: 'أدخل بريدك الإلكتروني' })}
        className="h-12 min-w-0 flex-1 rounded-xl bg-transparent px-4 text-fg outline-none placeholder:text-fg-subtle focus:bg-white/[0.04]"
      />
      <Button type="submit" size="lg" className="h-12" allowNative>
        {t.common.createAccount}
        <LuArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
      </Button>
    </form>
  );
}

/** Shown in the hero when no price source is configured: the three accounts as a card stack. */
function AccountStack() {
  const L = useL();
  return (
    <div className="relative mx-auto h-[22rem] w-full max-w-md">
      {accountTypes.map((a, i) => (
        <div
          key={a.id}
          className="glass glass-blur absolute inset-x-0 flex items-center justify-between p-6"
          style={{ top: `${i * 6.2}rem`, transform: `rotate(${(i - 1) * -2.5}deg)`, zIndex: 3 - i }}
        >
          <div>
            <p className="text-sm text-fg-subtle">{L({ en: 'Account', ar: 'حساب' })}</p>
            <p className="font-display text-2xl font-extrabold">{L(accountCopy[a.id].name)}</p>
          </div>
          <div className="text-end">
            <p className="num font-display text-3xl font-extrabold text-bolt">{a.spreadFrom.toFixed(1)}</p>
            <p className="text-xs text-fg-subtle">{L({ en: 'pips from', ar: 'نقطة ابتداءً من' })}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Hero() {
  const L = useL();
  const t = useT();
  return (
    <section className="relative overflow-hidden">
      <div className="bg-grid absolute inset-0" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_20%,rgb(255_212_0/0.14),transparent_70%)]" aria-hidden="true" />
      <BoltLines className="absolute inset-x-0 bottom-0 h-56 w-full opacity-60" />
      <div className="container-x relative grid items-center gap-12 pt-12 pb-20 sm:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:pt-20 lg:pb-28">
        <div className="flex flex-col items-start gap-6">
          <span className="eyebrow">
            <BoltIcon className="h-3.5 w-3.5" />
            {L({ en: 'MetaTrader 5 · Forex · Indices · Crypto · Metals', ar: 'ميتاتريدر 5 · فوركس · مؤشرات · عملات رقمية · معادن' })}
          </span>
          <h1 className="text-[2.6rem] leading-[1.02] font-extrabold sm:text-6xl lg:text-7xl">
            {L({ en: 'Fast markets.', ar: 'أسواق سريعة.' })}
            <br />
            <span className="text-gradient">{L({ en: 'Sharp pricing.', ar: 'تسعير دقيق.' })}</span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-fg-muted sm:text-xl">
            {L({
              en: `Trade ${instruments.length} instruments across forex, indices, crypto and metals on MetaTrader 5, with spreads from ${lowestSpread.toFixed(1)} pips, leverage up to 1:${maxLeverage} and accounts from ${usd(minDeposit)}.`,
              ar: `تداول ${instruments.length} أداة مالية في الفوركس والمؤشرات والعملات الرقمية والمعادن على ميتاتريدر 5، مع سبريد يبدأ من ${lowestSpread.toFixed(1)} نقطة ورافعة مالية حتى 1:${maxLeverage} وحسابات تبدأ من ${usd(minDeposit)}.`,
            })}
          </p>
          <HeroSignup />
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-subtle">
            <Link to="/trading/demo-account" className="inline-flex items-center gap-1.5 font-semibold text-fg hover:text-bolt">
              {t.common.tryDemo}
              <LuArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
            </Link>
            <span className="inline-flex items-center gap-1.5">
              <LuLock className="h-3.5 w-3.5" aria-hidden="true" />
              {L({ en: 'Two-factor login available', ar: 'تسجيل دخول بخطوتين متاح' })}
            </span>
          </p>
          <div className="mt-2 grid w-full max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact value={`${lowestSpread.toFixed(1)}`} label={L({ en: 'Pips spread from', ar: 'سبريد من (نقطة)' })} />
            <Fact value={`1:${maxLeverage}`} label={L({ en: 'Max leverage', ar: 'أقصى رافعة' })} />
            <Fact value={usd(minDeposit)} label={L({ en: 'Minimum deposit', ar: 'أدنى إيداع' })} />
            <Fact value={String(instruments.length)} label={L({ en: 'Instruments', ar: 'أداة مالية' })} />
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-8 rounded-[3rem] bg-[radial-gradient(closest-side,rgb(255_212_0/0.16),transparent)] blur-2xl" aria-hidden="true" />
          {feedPossible ? (
            <div className="relative pb-10 motion-safe:animate-float">
              <QuoteBoard symbols={['EURUSD', 'GBPUSD', 'XAUUSD', 'US500', 'NAS100', 'BTCUSD']} />
              <div className="glass glass-blur absolute start-6 bottom-0 hidden items-center gap-3 px-4 py-3 sm:flex">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-bolt text-bolt-ink">
                  <LuMonitorSmartphone className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-sm">
                  <span className="block font-semibold">MetaTrader 5</span>
                  <span className="block text-xs text-fg-subtle">{L({ en: 'Desktop · Web · Mobile', ar: 'سطح المكتب · الويب · الجوال' })}</span>
                </span>
              </div>
            </div>
          ) : (
            <AccountStack />
          )}
        </div>
      </div>
    </section>
  );
}

function SpreadHighlights() {
  const L = useL();
  const majors = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'US500'];
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        <SectionHeading
          align="start"
          className="mb-0 sm:mb-0"
          eyebrow={L({ en: 'Spreads', ar: 'السبريد' })}
          title={L({ en: 'Pricing you can see before you trade', ar: 'أسعار واضحة قبل أن تتداول' })}
          subtitle={L({
            en: 'Every account publishes its minimum spread and commission. Choose spread-only pricing, or raw spreads from 0.0 pips with a fixed commission on Institutional.',
            ar: 'يعلن كل حساب عن الحد الأدنى للسبريد والعمولة. اختر تسعيرًا يعتمد على السبريد فقط، أو سبريدًا خامًا يبدأ من 0.0 نقطة مع عمولة ثابتة في حساب المؤسسات.',
          })}
        />
        <div className="grid grid-cols-3 gap-3">
          {accountTypes.map((a) => (
            <div key={a.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-sm text-fg-subtle">{L(accountCopy[a.id].name)}</p>
              <p className="num mt-1 font-display text-3xl font-extrabold">{a.spreadFrom.toFixed(1)}</p>
              <p className="text-xs text-fg-subtle">{L({ en: 'pips from', ar: 'نقطة ابتداءً من' })}</p>
            </div>
          ))}
        </div>
        <ButtonLink to="/trading/accounts" variant="secondary" className="self-start">
          {L({ en: 'Compare all account costs', ar: 'قارن تكاليف جميع الحسابات' })}
          <LuArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
        </ButtonLink>
      </div>
      {feedPossible ? (
        <div className="glass p-2">
          <p className="px-4 pt-3 pb-2 text-sm font-semibold">{L({ en: 'Current spreads', ar: 'السبريد الحالي' })}</p>
          <ul className="divide-y divide-line/60">
            {majors.map((s) => (
              <SpreadRow key={s} symbol={s} />
            ))}
          </ul>
        </div>
      ) : (
        <div className="glass grid gap-px overflow-hidden bg-line/40 p-0 sm:grid-cols-2">
          {[
            [L({ en: 'Spread-only', ar: 'سبريد فقط' }), L({ en: 'Standard and Pro: the spread is your whole trading cost, no commission.', ar: 'ستاندرد وبرو: السبريد هو كامل تكلفة تداولك دون عمولة.' })],
            [L({ en: 'Raw + commission', ar: 'خام + عمولة' }), L({ en: `Institutional: raw spreads from ${institutional.spreadFrom.toFixed(1)} pips plus $${institutional.commissionPerLot} per lot.`, ar: `المؤسسات: سبريد خام من ${institutional.spreadFrom.toFixed(1)} نقطة مع ${institutional.commissionPerLot}$ لكل لوت.` })],
          ].map(([h, p]) => (
            <div key={h} className="bg-surface p-6">
              <p className="font-display text-lg font-bold text-bolt">{h}</p>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{p}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SpreadRow({ symbol }: { symbol: string }) {
  const q = useQuote(symbol);
  const inst = bySymbol[symbol];
  const L = useL();
  return (
    <li className="flex items-center justify-between px-4 py-3">
      <span>
        <span className="block font-semibold" dir="ltr">
          {formatSymbol(symbol)}
        </span>
        <span className="block text-xs text-fg-subtle">{L(inst.name)}</span>
      </span>
      <span className="num font-display text-xl font-bold" dir="ltr">
        {q ? spreadIn(inst, q.b, q.a) : '—'}
        <span className="ms-1 text-xs font-normal text-fg-subtle">{inst.market === 'forex' ? 'pips' : 'pts'}</span>
      </span>
    </li>
  );
}

function WhyBolt() {
  const L = useL();
  const [lev, setLev] = useState(500);
  const [calcSymbol, setCalcSymbol] = useState('EURUSD');
  const [lots, setLots] = useState(1);
  const inst = bySymbol[calcSymbol];
  const pipValue = inst.pipSize * inst.contractSize * lots;
  const levels = [50, 100, 200, 500].filter((l) => l <= maxLeverage);
  return (
    <div className="grid gap-4 lg:grid-cols-6">
      <div className="glass flex flex-col gap-4 p-6 lg:col-span-3">
        <LuSparkles className="h-6 w-6 text-bolt" aria-hidden="true" />
        <h3 className="text-2xl font-bold">{L({ en: 'Tight spreads', ar: 'سبريد ضيق' })}</h3>
        <p className="text-fg-muted">
          {L({
            en: `From ${lowestSpread.toFixed(1)} pips on Institutional and ${accountTypes[1].spreadFrom.toFixed(1)} on Pro, with every account's pricing published on one page.`,
            ar: `من ${lowestSpread.toFixed(1)} نقطة في حساب المؤسسات و${accountTypes[1].spreadFrom.toFixed(1)} في حساب برو، مع نشر تسعير كل حساب في صفحة واحدة.`,
          })}
        </p>
        <Link to="/trading/accounts" className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-bolt">
          {L({ en: 'See account pricing', ar: 'اطّلع على تسعير الحسابات' })}
          <LuArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
        </Link>
      </div>
      <div className="glass flex flex-col gap-4 p-6 lg:col-span-3">
        <LuGauge className="h-6 w-6 text-bolt" aria-hidden="true" />
        <h3 className="text-2xl font-bold">{L({ en: 'Flexible leverage', ar: 'رافعة مالية مرنة' })}</h3>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={L({ en: 'Leverage', ar: 'الرافعة المالية' })}>
          {levels.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={lev === l}
              onClick={() => setLev(l)}
              className={clsx('num rounded-full border px-3.5 py-1.5 text-sm font-semibold transition', lev === l ? 'border-bolt bg-bolt text-bolt-ink' : 'border-white/12 text-fg-muted hover:text-fg')}
            >
              1:{l}
            </button>
          ))}
        </div>
        <p className="text-fg-muted" aria-live="polite">
          {L({ en: 'Margin to open 1 lot of EUR/USD:', ar: 'الهامش المطلوب لفتح لوت واحد من EUR/USD:' })}{' '}
          <span className="num font-display text-xl font-extrabold text-fg">€{group(100_000 / lev)}</span>
        </p>
        <p className="text-xs text-fg-subtle">
          {L({ en: 'Higher leverage lowers the margin required, but magnifies losses as well as gains.', ar: 'الرافعة الأعلى تقلل الهامش المطلوب، لكنها تضاعف الخسائر كما تضاعف الأرباح.' })}
        </p>
      </div>
      <div className="glass flex flex-col gap-4 p-6 lg:col-span-2">
        <LuLayers className="h-6 w-6 text-bolt" aria-hidden="true" />
        <h3 className="text-2xl font-bold">
          <span className="num">{instruments.length}</span> {L({ en: 'instruments', ar: 'أداة مالية' })}
        </h3>
        <ul className="flex flex-col gap-2.5">
          {markets.map((m) => {
            const n = instrumentsFor(m).length;
            return (
              <li key={m} className="flex flex-col gap-1">
                <span className="flex justify-between text-sm">
                  <span className="text-fg-muted">{L(marketMeta[m].title)}</span>
                  <span className="num font-semibold">{n}</span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <span className="block h-full rounded-full bg-bolt" style={{ width: `${(n / instruments.length) * 100}%` }} />
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="glass flex flex-col gap-4 p-6 lg:col-span-4">
        <LuCalculator className="h-6 w-6 text-bolt" aria-hidden="true" />
        <h3 className="text-2xl font-bold">{L({ en: 'Know your numbers', ar: 'اعرف أرقامك' })}</h3>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.2fr] sm:items-end">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-subtle">{L({ en: 'Instrument', ar: 'الأداة' })}</span>
            <select
              value={calcSymbol}
              onChange={(e) => setCalcSymbol(e.target.value)}
              className="h-11 rounded-xl border border-line-strong bg-surface-2 px-3 text-fg outline-none focus:border-bolt/70"
            >
              {['EURUSD', 'GBPUSD', 'AUDUSD', 'XAUUSD', 'XAGUSD', 'US500', 'BTCUSD'].map((s) => (
                <option key={s} value={s}>
                  {formatSymbol(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-subtle">{L({ en: 'Lots', ar: 'اللوتات' })}</span>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={lots}
              onChange={(e) => setLots(Math.max(0, Number(e.target.value)))}
              className="num h-11 rounded-xl border border-line-strong bg-surface-2 px-3 text-fg outline-none focus:border-bolt/70"
            />
          </label>
          <div className="rounded-xl border border-bolt/30 bg-bolt/[0.07] px-4 py-2.5" aria-live="polite">
            <p className="text-xs text-fg-subtle">
              {inst.market === 'forex' ? L({ en: 'Value of 1 pip', ar: 'قيمة النقطة الواحدة' }) : L({ en: 'Value of a 1-point move', ar: 'قيمة تحرك نقطة واحدة' })}{' '}
              ({inst.pipSize})
            </p>
            <p className="num font-display text-2xl font-extrabold">{usd(pipValue, 2)}</p>
          </div>
        </div>
        <Link to="/tools" className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-bolt">
          {L({ en: 'Open all calculators', ar: 'افتح جميع الحاسبات' })}
          <LuArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export default function Home() {
  const L = useL();
  const t = useT();

  const faq = [
    {
      q: L({ en: 'What is Bolt Markets?', ar: 'ما هي Bolt Markets؟' }),
      a: L({
        en: 'Bolt Markets is an online broker for forex, indices, crypto, metals and commodities on MetaTrader 5. You open, verify, fund and manage your trading accounts from one client portal, in English or Arabic.',
        ar: 'Bolt Markets وسيط تداول إلكتروني للفوركس والمؤشرات والعملات الرقمية والمعادن والسلع عبر منصة ميتاتريدر 5. تفتح حساباتك وتوثّقها وتموّلها وتديرها من بوابة عملاء واحدة باللغتين العربية والإنجليزية.',
      }),
    },
    {
      q: L({ en: 'How do I open an account?', ar: 'كيف أفتح حسابًا؟' }),
      a: L({
        en: 'Select Create account, enter your name, email, country and a password, then confirm your email. In the client portal you can verify your identity, open a live or demo MT5 account and make your first deposit.',
        ar: 'اختر «إنشاء حساب» وأدخل اسمك وبريدك الإلكتروني ودولتك وكلمة مرور، ثم أكّد بريدك. من بوابة العملاء يمكنك التحقق من هويتك وفتح حساب ميتاتريدر 5 حقيقي أو تجريبي وإجراء إيداعك الأول.',
      }),
    },
    {
      q: L({ en: 'What is the minimum deposit?', ar: 'ما الحد الأدنى للإيداع؟' }),
      a: L({
        en: `${usd(accountTypes[0].minDeposit)} on Standard, ${usd(accountTypes[1].minDeposit)} on Pro and ${usd(accountTypes[2].minDeposit)} on Institutional.`,
        ar: `${usd(accountTypes[0].minDeposit)} لحساب ستاندرد، و${usd(accountTypes[1].minDeposit)} لحساب برو، و${usd(accountTypes[2].minDeposit)} لحساب المؤسسات.`,
      }),
    },
    {
      q: L({ en: 'Which trading platforms can I use?', ar: 'ما منصات التداول المتاحة؟' }),
      a: L({
        en: 'MetaTrader 5 on Windows, macOS, iPhone, Android and in your web browser. TradingView charts are available for analysis.',
        ar: 'ميتاتريدر 5 على ويندوز وماك وآيفون وأندرويد ومن متصفح الويب، إضافة إلى رسوم TradingView البيانية للتحليل.',
      }),
    },
    {
      q: L({ en: 'What leverage can I use?', ar: 'ما الرافعة المالية المتاحة؟' }),
      a: L({
        en: `Up to 1:${maxLeverage}, chosen when you open each MT5 account. Higher leverage increases potential losses as well as potential gains, so choose a level that matches your experience.`,
        ar: `حتى 1:${maxLeverage}، وتختارها عند فتح كل حساب على ميتاتريدر 5. تزيد الرافعة الأعلى من الخسائر المحتملة كما تزيد الأرباح المحتملة، فاختر مستوى يناسب خبرتك.`,
      }),
    },
    {
      q: L({ en: 'How do deposits and withdrawals work?', ar: 'كيف تتم الإيداعات والسحوبات؟' }),
      a: L({
        en: 'Deposit by card or cryptocurrency; funds are credited once the payment is confirmed. Withdrawals are requested in the portal, reviewed by our finance team and returned to the original method where possible. Identity verification is required before your first withdrawal.',
        ar: 'أودِع بالبطاقة أو بالعملات الرقمية، وتُضاف الأموال فور تأكيد الدفع. تُطلب السحوبات من البوابة وتراجعها إدارة المالية، وتُعاد إلى وسيلة الدفع الأصلية متى أمكن. يلزم التحقق من الهوية قبل أول عملية سحب.',
      }),
    },
    {
      q: L({ en: 'Can I practise before trading real money?', ar: 'هل يمكنني التدرّب قبل التداول بأموال حقيقية؟' }),
      a: L({
        en: 'Yes. Open a free demo account from the client portal to trade with virtual funds at real-time prices.',
        ar: 'نعم. افتح حسابًا تجريبيًا مجانيًا من بوابة العملاء وتداول بأموال افتراضية وبأسعار لحظية.',
      }),
    },
    {
      q: L({ en: 'How is my account protected?', ar: 'كيف يُحمى حسابي؟' }),
      a: L({
        en: 'You can turn on two-factor authentication with any authenticator app, passwords are stored with a memory-hard hashing algorithm and all traffic is encrypted. We never ask for your password by email, chat or phone.',
        ar: 'يمكنك تفعيل المصادقة الثنائية بأي تطبيق مصادقة، وتُخزَّن كلمات المرور بخوارزمية تجزئة مقاومة للاختراق، وكل الاتصالات مشفّرة. لن نطلب كلمة مرورك أبدًا عبر البريد أو الدردشة أو الهاتف.',
      }),
    },
  ];

  const advantages = [
    {
      icon: <LuGauge />,
      title: L({ en: `Leverage up to 1:${maxLeverage}`, ar: `رافعة حتى 1:${maxLeverage}` }),
      text: L({ en: 'Choose the leverage for each MT5 account to suit your strategy and risk appetite.', ar: 'اختر الرافعة لكل حساب على ميتاتريدر 5 بما يناسب استراتيجيتك وتقبّلك للمخاطر.' }),
    },
    {
      icon: <LuSparkles />,
      title: L({ en: 'Raw spreads from 0.0', ar: 'سبريد خام من 0.0' }),
      text: L({ en: `Institutional pricing passes raw spreads through with a fixed $${institutional.commissionPerLot} per lot commission.`, ar: `يمرّر تسعير حساب المؤسسات السبريد الخام مع عمولة ثابتة قدرها ${institutional.commissionPerLot}$ لكل لوت.` }),
    },
    {
      icon: <LuWallet />,
      title: L({ en: `Start from ${usd(minDeposit)}`, ar: `ابدأ من ${usd(minDeposit)}` }),
      text: L({ en: 'The Standard account lets you go live with a small first deposit and no commission.', ar: 'يتيح لك حساب ستاندرد بدء التداول الحقيقي بإيداع أول صغير ودون عمولة.' }),
    },
    {
      icon: <LuCpu />,
      title: L({ en: 'MetaTrader 5 everywhere', ar: 'ميتاتريدر 5 في كل مكان' }),
      text: L({ en: 'Desktop, web and mobile on the same login, with Expert Advisors on desktop.', ar: 'سطح المكتب والويب والجوال بتسجيل دخول واحد، مع دعم المستشارين الخبراء على سطح المكتب.' }),
    },
    {
      icon: <LuReceipt />,
      title: L({ en: 'One portal for everything', ar: 'بوابة واحدة لكل شيء' }),
      text: L({ en: 'Accounts, verification, deposits, withdrawals, history and support tickets in one place.', ar: 'الحسابات والتحقق والإيداعات والسحوبات والسجل وتذاكر الدعم في مكان واحد.' }),
    },
    {
      icon: <LuLanguages />,
      title: L({ en: 'English and Arabic', ar: 'العربية والإنجليزية' }),
      text: L({ en: 'The website and client portal are fully available in both languages, right-to-left included.', ar: 'الموقع وبوابة العملاء متاحان بالكامل باللغتين، مع دعم كامل للكتابة من اليمين إلى اليسار.' }),
    },
  ];

  return (
    <>
      <Seo
        title={site.brand}
        description={L({
          en: `Trade forex, indices, crypto and metals on MetaTrader 5 with spreads from ${lowestSpread.toFixed(1)} pips, leverage up to 1:${maxLeverage} and accounts from ${usd(minDeposit)}.`,
          ar: `تداول الفوركس والمؤشرات والعملات الرقمية والمعادن على ميتاتريدر 5 مع سبريد من ${lowestSpread.toFixed(1)} نقطة ورافعة حتى 1:${maxLeverage} وحسابات تبدأ من ${usd(minDeposit)}.`,
        })}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: site.brand,
            ...(site.url ? { url: site.url + '/', logo: site.url + '/apple-touch-icon.png' } : {}),
            ...(site.company.legalName ? { legalName: site.company.legalName } : {}),
          },
          faqJsonLd(faq),
        ]}
      />
      <Hero />

      <Section>
        <SectionHeading
          eyebrow={L({ en: 'Markets', ar: 'الأسواق' })}
          title={L({ en: 'One login. Four asset classes.', ar: 'تسجيل دخول واحد. أربع فئات من الأصول.' })}
          subtitle={L({
            en: 'Trade the markets that move the world from a single MetaTrader 5 account.',
            ar: 'تداول الأسواق التي تحرّك العالم من حساب واحد على ميتاتريدر 5.',
          })}
        />
        <InstrumentRange />
      </Section>

      <Section className="bg-[linear-gradient(180deg,transparent,rgb(255_255_255/0.015),transparent)]">
        <SectionHeading
          eyebrow={L({ en: 'Accounts', ar: 'الحسابات' })}
          title={L({ en: 'Pick the account that fits how you trade', ar: 'اختر الحساب الذي يناسب أسلوب تداولك' })}
          subtitle={L({
            en: `Every account runs on MetaTrader 5 with leverage up to 1:${maxLeverage}. Tell us what matters most and we will highlight the best match.`,
            ar: `تعمل جميع الحسابات على ميتاتريدر 5 برافعة حتى 1:${maxLeverage}. أخبرنا بما يهمك وسنبرز لك الحساب الأنسب.`,
          })}
        />
        <AccountComparison />
        <div className="mt-8 flex justify-center">
          <ButtonLink to="/trading/accounts" variant="ghost">
            {t.common.compareAccounts}
            <LuArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
          </ButtonLink>
        </div>
      </Section>

      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-col gap-5">
            <SectionHeading
              align="start"
              className="mb-0 sm:mb-0"
              eyebrow={L({ en: 'About Bolt', ar: 'عن Bolt' })}
              title={L({ en: 'A broker built around clarity', ar: 'وسيط مبني على الوضوح' })}
              subtitle={L({
                en: 'Bolt Markets gives you access to global markets through MetaTrader 5, with pricing published up front, one portal for every account and payment, and a full experience in English and Arabic.',
                ar: 'تمنحك Bolt Markets الوصول إلى الأسواق العالمية عبر ميتاتريدر 5، مع أسعار معلنة مسبقًا، وبوابة واحدة لكل حساباتك ومدفوعاتك، وتجربة كاملة بالعربية والإنجليزية.',
              })}
            />
            <ButtonLink to="/company/about" variant="secondary" className="self-start">
              {L({ en: 'How we work', ar: 'كيف نعمل' })}
              <LuArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
            </ButtonLink>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Feature icon={<LuReceipt />} title={L({ en: 'Transparent pricing', ar: 'تسعير شفاف' })}>
              {L({ en: 'Minimum spreads and commissions are published for every account type.', ar: 'نعلن الحد الأدنى للسبريد والعمولات لكل نوع حساب.' })}
            </Feature>
            <Feature icon={<LuMonitorSmartphone />} title={L({ en: 'Professional platform', ar: 'منصة احترافية' })}>
              {L({ en: 'MetaTrader 5 with advanced charting, algorithmic trading and depth of market.', ar: 'ميتاتريدر 5 مع رسوم بيانية متقدمة وتداول خوارزمي وعمق السوق.' })}
            </Feature>
            <Feature icon={<LuShieldCheck />} title={L({ en: 'Protected access', ar: 'وصول محمي' })}>
              {L({ en: 'Verified clients, two-factor login and encrypted connections end to end.', ar: 'عملاء موثّقون وتسجيل دخول بخطوتين واتصالات مشفّرة بالكامل.' })}
            </Feature>
            <Feature icon={<LuLanguages />} title={L({ en: 'Bilingual by design', ar: 'ثنائي اللغة من الأساس' })}>
              {L({ en: 'Switch between English and Arabic on any page, including the client portal.', ar: 'بدّل بين العربية والإنجليزية في أي صفحة، بما فيها بوابة العملاء.' })}
            </Feature>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow={L({ en: 'Platforms', ar: 'المنصات' })}
          title={L({ en: 'Trade on any device', ar: 'تداول من أي جهاز' })}
          subtitle={L({
            en: 'Download MetaTrader 5 or launch it in your browser. Your trading account works on all of them with the same login.',
            ar: 'نزّل ميتاتريدر 5 أو شغّله من متصفحك. يعمل حساب تداولك عليها جميعًا ببيانات الدخول نفسها.',
          })}
        />
        <PlatformDownloads />
      </Section>

      <Section>
        <SectionHeading
          eyebrow={L({ en: 'Funding', ar: 'التمويل' })}
          title={L({ en: 'Fund your account your way', ar: 'موّل حسابك بالطريقة التي تناسبك' })}
          subtitle={L({ en: 'Card and crypto deposits from one secure portal.', ar: 'إيداعات بالبطاقة والعملات الرقمية من بوابة واحدة آمنة.' })}
        />
        <DepositMethods />
      </Section>

      <Section>
        <SpreadHighlights />
      </Section>

      <Section className="bg-[linear-gradient(180deg,transparent,rgb(255_255_255/0.015),transparent)]">
        <SectionHeading
          eyebrow={L({ en: 'Multi-asset hub', ar: 'مركز الأصول المتعددة' })}
          title={L({ en: 'Every market on one board', ar: 'كل الأسواق على لوحة واحدة' })}
          subtitle={
            feedPossible
              ? L({ en: 'Bid, ask and spread for every instrument, streamed from our MT5 servers.', ar: 'أسعار البيع والشراء والسبريد لكل أداة، مباشرةً من خوادم ميتاتريدر 5 لدينا.' })
              : L({ en: 'Every instrument you can trade, grouped by asset class.', ar: 'كل الأدوات المتاحة للتداول، مصنّفة حسب فئة الأصول.' })
          }
        />
        <MarketHub />
      </Section>

      <Section>
        <SectionHeading
          eyebrow={L({ en: 'Advantages', ar: 'المزايا' })}
          title={L({ en: 'Why traders choose Bolt', ar: 'لماذا يختار المتداولون Bolt' })}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {advantages.map((a) => (
            <Feature key={a.title} icon={a.icon} title={a.title}>
              {a.text}
            </Feature>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow={L({ en: 'Get started', ar: 'ابدأ الآن' })}
          title={L({ en: 'Register, fund, trade', ar: 'سجّل، موّل، تداول' })}
          subtitle={L({ en: 'Three steps from sign-up to your first position.', ar: 'ثلاث خطوات من التسجيل إلى أول صفقة.' })}
        />
        <Steps />
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <CtaButtons />
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow={L({ en: 'Compare platforms', ar: 'قارن المنصات' })}
          title={L({ en: 'Which platform suits you?', ar: 'أي منصة تناسبك؟' })}
        />
        <PlatformComparison />
      </Section>

      {site.social.discord ? (
        <Section>
          <DiscordBlock />
        </Section>
      ) : null}

      <Section>
        <SectionHeading
          eyebrow={L({ en: 'Support', ar: 'الدعم' })}
          title={L({ en: 'Help when you need it', ar: 'المساعدة حين تحتاجها' })}
          subtitle={L({ en: 'Find answers yourself or reach the team behind your account.', ar: 'ابحث عن الإجابات بنفسك أو تواصل مع الفريق المسؤول عن حسابك.' })}
        />
        <SupportBlock />
      </Section>

      <Section>
        <SectionHeading
          align="start"
          eyebrow={L({ en: 'From the blog', ar: 'من المدونة' })}
          title={L({ en: 'Learn, then trade', ar: 'تعلّم ثم تداول' })}
          action={
            <ButtonLink to="/learn" variant="secondary">
              {t.common.viewAll}
              <LuArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
            </ButtonLink>
          }
        />
        <LatestPosts />
      </Section>

      <Section>
        <SectionHeading
          eyebrow={L({ en: 'Why trade with Bolt', ar: 'لماذا تتداول مع Bolt' })}
          title={L({ en: 'Spreads, leverage, markets and the maths', ar: 'السبريد والرافعة والأسواق والحسابات' })}
        />
        <WhyBolt />
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading eyebrow="FAQ" title={t.common.faq} />
          <Accordion items={faq} />
        </div>
      </Section>

      <CtaBand
        title={L({ en: 'Ready when the market is.', ar: 'جاهز متى تحرّك السوق.' })}
        subtitle={L({ en: 'Open your account in minutes, or practise first on a free demo.', ar: 'افتح حسابك في دقائق، أو تدرّب أولًا على حساب تجريبي مجاني.' })}
        actions={<CtaButtons />}
      />
    </>
  );
}
