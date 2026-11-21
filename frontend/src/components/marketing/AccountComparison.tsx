import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { LuArrowRight, LuCheck, LuSparkles } from 'react-icons/lu';
import { accountCopy, accountTypes, COMMISSION_SIDES_PER_TRADE, PLATFORM_NAME, type AccountTypeId } from '../../config/accounts';
import { useL, useT } from '../../i18n';
import { usd, group } from '../../lib/format';
import { ButtonLink } from '../ui/Button';
import { Badge } from '../ui/Feedback';

type Priority = 'entry' | 'balanced' | 'raw';
const recommend: Record<Priority, AccountTypeId> = { entry: 'standard', balanced: 'pro', raw: 'institutional' };

/** USD value of one pip on one standard lot of EUR/USD (used by the estimator). */
const PIP_VALUE_EURUSD = 10;

export function costPerTrade(spreadFrom: number, commissionPerLot: number, lots: number) {
  return spreadFrom * PIP_VALUE_EURUSD * lots + commissionPerLot * COMMISSION_SIDES_PER_TRADE * lots;
}

export function AccountComparison({ detailed = false }: { detailed?: boolean }) {
  const t = useT();
  const L = useL();
  const [priority, setPriority] = useState<Priority>('balanced');
  const [deposit, setDeposit] = useState(1000);
  const [lots, setLots] = useState(1);
  const [trades, setTrades] = useState(20);
  const best = recommend[priority];

  const priorities: { id: Priority; label: string }[] = [
    { id: 'entry', label: L({ en: 'Lowest entry', ar: 'أقل إيداع' }) },
    { id: 'balanced', label: L({ en: 'Tighter spreads', ar: 'سبريد أضيق' }) },
    { id: 'raw', label: L({ en: 'Raw pricing', ar: 'تسعير خام' }) },
  ];

  const costs = useMemo(
    () =>
      Object.fromEntries(
        accountTypes.map((a) => {
          const perTrade = costPerTrade(a.spreadFrom, a.commissionPerLot, lots);
          return [a.id, { perTrade, monthly: perTrade * trades }];
        }),
      ) as Record<AccountTypeId, { perTrade: number; monthly: number }>,
    [lots, trades],
  );
  const cheapest = (Object.entries(costs) as [AccountTypeId, { monthly: number }][]).sort((a, b) => a[1].monthly - b[1].monthly)[0][0];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <fieldset className="flex flex-wrap items-center justify-center gap-2">
          <legend className="sr-only">{L({ en: 'What matters most to you?', ar: 'ما الأهم بالنسبة إليك؟' })}</legend>
          <span className="me-1 text-sm text-fg-subtle" aria-hidden="true">
            {L({ en: 'What matters most?', ar: 'ما الأهم لك؟' })}
          </span>
          {priorities.map((p) => (
            <label
              key={p.id}
              className={clsx(
                'cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-bolt',
                priority === p.id ? 'border-bolt bg-bolt text-bolt-ink' : 'border-white/12 text-fg-muted hover:border-white/30 hover:text-fg',
              )}
            >
              <input type="radio" name="acct-priority" className="sr-only" checked={priority === p.id} onChange={() => setPriority(p.id)} />
              {p.label}
            </label>
          ))}
        </fieldset>
        <label className="flex items-center gap-3 text-sm text-fg-muted">
          <span>{L({ en: 'I plan to deposit', ar: 'أخطط لإيداع' })}</span>
          <span className="relative">
            <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-fg-subtle">$</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={10}
              value={Number.isFinite(deposit) ? deposit : ''}
              onChange={(e) => setDeposit(Math.max(0, Number(e.target.value)))}
              className="num h-10 w-32 rounded-xl border border-line-strong bg-surface-2 ps-7 pe-3 text-fg outline-none focus:border-bolt/70 focus:ring-4 focus:ring-bolt/15"
              aria-label={L({ en: 'Planned deposit in US dollars', ar: 'مبلغ الإيداع المخطط بالدولار الأمريكي' })}
            />
          </span>
        </label>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {accountTypes.map((a) => {
          const c = accountCopy[a.id];
          const eligible = deposit >= a.minDeposit;
          const isBest = a.id === best;
          return (
            <article
              key={a.id}
              className={clsx(
                'glass relative flex flex-col gap-6 p-6 transition duration-300 sm:p-7',
                isBest ? 'border-bolt/60 shadow-[0_0_0_1px_rgb(255_212_0/0.35),0_30px_60px_-30px_rgb(255_212_0/0.45)]' : '',
                !eligible && 'opacity-60',
              )}
            >
              <header className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-extrabold">{L(c.name)}</h3>
                  <p className="mt-1 text-sm text-fg-muted">{L(c.tagline)}</p>
                </div>
                {isBest ? (
                  <Badge tone="bolt">
                    <LuSparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    {L({ en: 'Best match', ar: 'الأنسب لك' })}
                  </Badge>
                ) : null}
              </header>
              <div className="flex items-end gap-2">
                <span className="num font-display text-5xl font-extrabold text-fg">{a.spreadFrom.toFixed(1)}</span>
                <span className="pb-1.5 text-sm text-fg-muted">
                  {L({ en: 'pips spread from', ar: 'نقطة سبريد ابتداءً من' })}
                  {a.raw ? <span className="ms-1 text-bolt">· RAW</span> : null}
                </span>
              </div>
              <dl className="flex flex-col divide-y divide-line/70 text-sm">
                {[
                  [L({ en: 'Minimum deposit', ar: 'الحد الأدنى للإيداع' }), usd(a.minDeposit)],
                  [
                    L({ en: 'Commission', ar: 'العمولة' }),
                    a.commissionPerLot ? `${usd(a.commissionPerLot)} ${t.common.perLot}` : t.common.none,
                  ],
                  [L({ en: 'Leverage', ar: 'الرافعة المالية' }), `${t.common.upTo} 1:${a.maxLeverage}`],
                  [L({ en: 'Platform', ar: 'المنصة' }), PLATFORM_NAME],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4 py-2.5">
                    <dt className="text-fg-subtle">{k}</dt>
                    <dd className="num font-semibold text-fg" dir="auto">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="flex items-start gap-2 text-sm text-fg-muted">
                <LuCheck className="mt-0.5 h-4 w-4 shrink-0 text-bolt" aria-hidden="true" />
                {L(c.bestFor)}
              </p>
              <div className="mt-auto flex flex-col gap-2">
                <ButtonLink to={`/register?account=${a.id}`} variant={isBest ? 'primary' : 'secondary'} className="w-full">
                  {L({ en: `Open ${c.name.en}`, ar: `افتح حساب ${c.name.ar}` })}
                  <LuArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                </ButtonLink>
                {!eligible ? (
                  <p className="text-center text-xs text-fg-subtle">
                    {L({ en: `Requires a deposit of ${usd(a.minDeposit)} or more`, ar: `يتطلب إيداع ${usd(a.minDeposit)} أو أكثر` })}
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {detailed ? (
        <div className="glass p-6 sm:p-8">
          <div className="flex flex-col gap-2">
            <h3 className="text-xl font-bold">{L({ en: 'Estimate your trading cost', ar: 'قدّر تكلفة تداولك' })}</h3>
            <p className="text-sm text-fg-muted">
              {L({
                en: 'Move the sliders to compare the minimum cost of a round-turn EUR/USD trade on each account.',
                ar: 'حرّك المؤشرات لمقارنة الحد الأدنى لتكلفة صفقة كاملة (فتح وإغلاق) على زوج EUR/USD في كل حساب.',
              })}
            </p>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <label className="flex flex-col gap-3">
              <span className="flex justify-between text-sm">
                <span className="text-fg-muted">{L({ en: 'Trade size', ar: 'حجم الصفقة' })}</span>
                <span className="num font-semibold text-fg">
                  {lots.toFixed(2)} {L({ en: 'lots', ar: 'لوت' })}
                </span>
              </span>
              <input type="range" min={0.01} max={10} step={0.01} value={lots} onChange={(e) => setLots(Number(e.target.value))} className="accent-bolt" />
            </label>
            <label className="flex flex-col gap-3">
              <span className="flex justify-between text-sm">
                <span className="text-fg-muted">{L({ en: 'Trades per month', ar: 'عدد الصفقات شهريًا' })}</span>
                <span className="num font-semibold text-fg">{trades}</span>
              </span>
              <input type="range" min={1} max={300} step={1} value={trades} onChange={(e) => setTrades(Number(e.target.value))} className="accent-bolt" />
            </label>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3" aria-live="polite">
            {accountTypes.map((a) => (
              <div
                key={a.id}
                className={clsx('rounded-2xl border p-4', a.id === cheapest ? 'border-up/40 bg-up/[0.06]' : 'border-white/8 bg-white/[0.02]')}
              >
                <p className="flex items-center justify-between text-sm font-semibold">
                  {L(accountCopy[a.id].name)}
                  {a.id === cheapest ? <Badge tone="up">{L({ en: 'Lowest cost', ar: 'الأقل تكلفة' })}</Badge> : null}
                </p>
                <p className="num mt-3 font-display text-2xl font-extrabold">{usd(costs[a.id].perTrade, 2)}</p>
                <p className="text-xs text-fg-subtle">{L({ en: 'per trade', ar: 'لكل صفقة' })}</p>
                <p className="num mt-2 text-sm text-fg-muted">
                  {usd(costs[a.id].monthly, 0)} {L({ en: 'per month', ar: 'شهريًا' })}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-fg-subtle">
            {COMMISSION_SIDES_PER_TRADE === 2
              ? L({
                  en: `Estimate based on minimum ("from") spreads on EUR/USD, where one pip on one standard lot is worth $${PIP_VALUE_EURUSD}, and on the published commission charged when the trade is opened and again when it is closed. Actual spreads vary with market conditions; swaps are not included.`,
                  ar: `التقدير مبني على الحد الأدنى للسبريد على EUR/USD، حيث تساوي النقطة الواحدة على لوت قياسي ${group(PIP_VALUE_EURUSD)} دولارات، وعلى العمولة المعلنة التي تُحتسب عند فتح الصفقة ومرة أخرى عند إغلاقها. يتغير السبريد الفعلي بحسب ظروف السوق، ولا يشمل التقدير رسوم التبييت.`,
                })
              : L({
                  en: `Estimate based on minimum ("from") spreads on EUR/USD, where one pip on one standard lot is worth $${PIP_VALUE_EURUSD}, and on the published commission charged once per round-turn trade. Actual spreads vary with market conditions; swaps are not included.`,
                  ar: `التقدير مبني على الحد الأدنى للسبريد على EUR/USD، حيث تساوي النقطة الواحدة على لوت قياسي ${group(PIP_VALUE_EURUSD)} دولارات، وعلى العمولة المعلنة التي تُحتسب مرة واحدة لكل صفقة كاملة. يتغير السبريد الفعلي بحسب ظروف السوق، ولا يشمل التقدير رسوم التبييت.`,
                })}
          </p>
        </div>
      ) : null}
    </div>
  );
}
