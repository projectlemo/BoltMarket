import clsx from 'clsx';
import { site } from '../../config/site';
import { bySymbol, formatSymbol, tickerSymbols, type Instrument } from '../../config/markets';
import { useFeedStatus, useQuote, type FeedStatus } from '../../lib/feed';
import { pct, price } from '../../lib/format';
import { useL, useT } from '../../i18n';
import { StatusDot } from '../ui/Feedback';

/** A feed can only exist when an API is configured or the simulator is switched on. */
export const feedPossible = Boolean(site.apiUrl || site.features.demoPrices);

export function spreadIn(i: Instrument, bid: number, ask: number) {
  const units = (ask - bid) / i.pipSize;
  return i.market === 'forex' ? units.toFixed(1) : units >= 100 ? units.toFixed(0) : units.toFixed(1);
}

export function FeedBadge({ status, className }: { status: FeedStatus; className?: string }) {
  const t = useT();
  const map: Record<FeedStatus, { label: string; tone: 'up' | 'warn' | 'neutral' | 'down'; pulse: boolean }> = {
    idle: { label: t.ticker.connecting, tone: 'neutral', pulse: true },
    connecting: { label: t.ticker.connecting, tone: 'warn', pulse: true },
    live: { label: t.ticker.live, tone: 'up', pulse: true },
    simulated: { label: t.ticker.simulated, tone: 'warn', pulse: false },
    offline: { label: t.ticker.offline, tone: 'down', pulse: false },
  };
  const m = map[status];
  return (
    <span className={clsx('inline-flex items-center gap-2 text-xs font-semibold whitespace-nowrap text-fg-muted', className)}>
      <StatusDot tone={m.tone} pulse={m.pulse} />
      {m.label}
    </span>
  );
}

export function FeedNote({ className }: { className?: string }) {
  const t = useT();
  const status = useFeedStatus();
  const text = status === 'simulated' ? t.prices.simulatedNote : status === 'live' ? t.prices.liveNote : t.prices.offlineNote;
  return <p className={clsx('text-xs leading-relaxed text-fg-subtle', className)}>{text}</p>;
}

function TickerItem({ symbol }: { symbol: string }) {
  const q = useQuote(symbol);
  const inst = bySymbol[symbol];
  if (!inst) return null;
  const change = q?.o ? ((q.b - q.o) / q.o) * 100 : undefined;
  return (
    <li className="flex items-center gap-2.5 border-e border-line/50 px-5 py-2.5 text-sm whitespace-nowrap">
      <span className="font-semibold text-fg" dir="ltr">
        {formatSymbol(symbol)}
      </span>
      <span
        key={q?.t}
        dir="ltr"
        className={clsx('num rounded px-1', !q ? 'text-fg-subtle' : q.dir === 1 ? 'flash-up text-up' : q.dir === -1 ? 'flash-down text-down' : 'text-fg-muted')}
      >
        {q ? price(q.b, inst.digits) : '—'}
      </span>
      {change !== undefined ? (
        <span dir="ltr" className={clsx('num text-xs', change >= 0 ? 'text-up' : 'text-down')}>
          {pct(change)}
        </span>
      ) : null}
    </li>
  );
}

/** Site-wide scrolling ticker. Rendered only when a price source is configured. */
export function Ticker() {
  const t = useT();
  const status = useFeedStatus();
  if (!feedPossible) return null;
  return (
    <div role="region" aria-label={t.a11y.ticker} className="ticker relative z-10 border-b border-line/60 bg-surface/70">
      <div className="flex items-stretch">
        <div className="relative z-10 flex shrink-0 items-center border-e border-line/60 bg-surface px-4">
          <FeedBadge status={status} />
        </div>
        <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_4%,#000_96%,transparent)]">
          <div className="ticker-track flex w-max">
            {[0, 1].map((copy) => (
              <ul key={copy} className="flex shrink-0" aria-hidden={copy === 1 ? true : undefined}>
                {tickerSymbols.map((s) => (
                  <TickerItem key={s} symbol={s} />
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function QuoteRow({ inst, showName = true }: { inst: Instrument; showName?: boolean }) {
  const q = useQuote(inst.symbol);
  const L = useL();
  const change = q?.o ? ((q.b - q.o) / q.o) * 100 : undefined;
  const flash = q?.dir === 1 ? 'flash-up' : q?.dir === -1 ? 'flash-down' : '';
  return (
    <tr className="border-b border-line/60 transition last:border-0 hover:bg-white/[0.025]">
      <th scope="row" className="py-3.5 ps-4 pe-3 text-start font-normal sm:ps-5">
        <span className="block font-semibold text-fg" dir="ltr">
          {formatSymbol(inst.symbol)}
        </span>
        {showName ? <span className="block text-xs text-fg-subtle">{L(inst.name)}</span> : null}
      </th>
      <td className="px-3 py-3.5 text-end" dir="ltr">
        <span key={`b${q?.t}`} className={clsx('num rounded px-1.5 py-0.5 font-medium', flash, q ? 'text-fg' : 'text-fg-subtle')}>
          {q ? price(q.b, inst.digits) : '—'}
        </span>
      </td>
      <td className="px-3 py-3.5 text-end" dir="ltr">
        <span key={`a${q?.t}`} className={clsx('num rounded px-1.5 py-0.5 font-medium', flash, q ? 'text-fg' : 'text-fg-subtle')}>
          {q ? price(q.a, inst.digits) : '—'}
        </span>
      </td>
      <td className="num px-3 py-3.5 text-end text-fg-muted" dir="ltr">
        {q ? spreadIn(inst, q.b, q.a) : '—'}
      </td>
      <td className="num py-3.5 ps-3 pe-4 text-end sm:pe-5" dir="ltr">
        {change !== undefined ? <span className={change >= 0 ? 'text-up' : 'text-down'}>{pct(change)}</span> : <span className="text-fg-subtle">—</span>}
      </td>
    </tr>
  );
}

export function PriceTable({ items, caption, showName = true, className }: { items: Instrument[]; caption?: string; showName?: boolean; className?: string }) {
  const t = useT();
  return (
    <div className={clsx('glass overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-line text-xs tracking-wide text-fg-subtle uppercase">
              <th scope="col" className="py-3 ps-4 pe-3 text-start font-semibold sm:ps-5">
                {t.prices.instrument}
              </th>
              <th scope="col" className="px-3 py-3 text-end font-semibold">
                {t.prices.bid}
              </th>
              <th scope="col" className="px-3 py-3 text-end font-semibold">
                {t.prices.ask}
              </th>
              <th scope="col" className="px-3 py-3 text-end font-semibold">
                {t.prices.spread}
              </th>
              <th scope="col" className="py-3 ps-3 pe-4 text-end font-semibold sm:pe-5">
                {t.prices.change}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <QuoteRow key={i.symbol} inst={i} showName={showName} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
