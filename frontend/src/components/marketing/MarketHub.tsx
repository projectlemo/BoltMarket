import clsx from 'clsx';
import { useState } from 'react';
import { LuArrowLeftRight, LuArrowRight, LuBitcoin, LuChartColumn, LuGem } from 'react-icons/lu';
import type { IconType } from 'react-icons';
import { formatSymbol, instruments, instrumentsFor, sessions, type MarketId } from '../../config/markets';
import { useL, useT } from '../../i18n';
import { useFeedStatus, useQuote } from '../../lib/feed';
import { price } from '../../lib/format';
import { Link } from '../../router';
import { FeedBadge, FeedNote, PriceTable, feedPossible, spreadIn } from '../market/Prices';
import { Tabs } from '../ui/Disclosure';

export const marketMeta: Record<MarketId, { icon: IconType; title: { en: string; ar: string }; blurb: { en: string; ar: string }; to: string }> = {
  forex: {
    icon: LuArrowLeftRight,
    title: { en: 'Forex', ar: 'الفوركس' },
    blurb: { en: 'Majors, crosses and selected exotics, around the clock on weekdays.', ar: 'الأزواج الرئيسية والتقاطعية وعدد من الأزواج الغريبة، على مدار الساعة طوال أيام الأسبوع.' },
    to: '/markets/forex',
  },
  indices: {
    icon: LuChartColumn,
    title: { en: 'Indices', ar: 'المؤشرات' },
    blurb: { en: 'Trade the direction of US, European and Asian stock benchmarks.', ar: 'تداول اتجاه المؤشرات الرئيسية للأسهم الأمريكية والأوروبية والآسيوية.' },
    to: '/markets/indices',
  },
  crypto: {
    icon: LuBitcoin,
    title: { en: 'Crypto', ar: 'العملات الرقمية' },
    blurb: { en: 'Go long or short on leading coins without managing a wallet.', ar: 'تداول صعود العملات الرقمية الرائدة أو هبوطها دون الحاجة إلى محفظة.' },
    to: '/markets/crypto',
  },
  commodities: {
    icon: LuGem,
    title: { en: 'Metals & commodities', ar: 'المعادن والسلع' },
    blurb: { en: 'Gold, silver and platinum alongside crude oil and natural gas.', ar: 'الذهب والفضة والبلاتين، إلى جانب النفط الخام والغاز الطبيعي.' },
    to: '/markets/commodities',
  },
};

function MiniQuote({ symbol }: { symbol: string }) {
  const q = useQuote(symbol);
  const inst = instruments.find((i) => i.symbol === symbol);
  if (!inst) return null;
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="font-semibold text-fg-muted" dir="ltr">
        {formatSymbol(symbol)}
      </span>
      {feedPossible ? (
        <span key={q?.t} dir="ltr" className={clsx('num rounded px-1', q?.dir === 1 && 'flash-up text-up', q?.dir === -1 && 'flash-down text-down', !q && 'text-fg-subtle')}>
          {q ? price(q.b, inst.digits) : '—'}
        </span>
      ) : null}
    </li>
  );
}

/** Four asset-class cards with counts and sample symbols. */
export function InstrumentRange() {
  const L = useL();
  const t = useT();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {(Object.keys(marketMeta) as MarketId[]).map((m) => {
        const meta = marketMeta[m];
        const Icon = meta.icon;
        const list = instrumentsFor(m);
        return (
          <Link key={m} to={meta.to} className="glass glass-hover group flex flex-col gap-5 p-6">
            <div className="flex items-center justify-between">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-bolt/25 bg-bolt/10 text-bolt">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="num text-sm text-fg-subtle">
                {list.length} {L({ en: 'instruments', ar: 'أداة' })}
              </span>
            </div>
            <div>
              <h3 className="text-xl font-bold">{L(meta.title)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{L(meta.blurb)}</p>
            </div>
            <ul className="flex flex-col gap-2 border-t border-line/70 pt-4">
              {list.slice(0, 3).map((i) => (
                <MiniQuote key={i.symbol} symbol={i.symbol} />
              ))}
            </ul>
            <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-bolt">
              {t.common.learnMore}
              <LuArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/** Instrument list used when no price feed is configured. */
export function SpecList({ market }: { market: MarketId }) {
  const L = useL();
  const t = useT();
  return (
    <div className="glass overflow-hidden">
      <ul className="divide-y divide-line/60">
        {instrumentsFor(market).map((i) => (
          <li key={i.symbol} className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm">
            <span>
              <span className="block font-semibold text-fg" dir="ltr">
                {formatSymbol(i.symbol)}
              </span>
              <span className="block text-xs text-fg-subtle">{L(i.name)}</span>
            </span>
            <span className="text-end text-xs text-fg-muted">
              {L(i.contractUnit)} <span className="text-fg-subtle">/ {L({ en: 'lot', ar: 'لوت' })}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-line px-5 py-3 text-xs text-fg-subtle">
        {L(sessions[market])} · {t.prices.offlineNote}
      </p>
    </div>
  );
}

/** Tabbed live price board across all asset classes. */
export function MarketHub() {
  const L = useL();
  const t = useT();
  const status = useFeedStatus();
  const [tab, setTab] = useState<MarketId>('forex');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <Tabs
          label={L({ en: 'Asset class', ar: 'فئة الأصول' })}
          value={tab}
          onChange={setTab}
          tabs={(Object.keys(marketMeta) as MarketId[]).map((m) => ({ id: m, label: L(marketMeta[m].title) }))}
        />
        {feedPossible ? <FeedBadge status={status} /> : null}
      </div>
      <div role="tabpanel" aria-label={L(marketMeta[tab].title)}>
        {feedPossible ? <PriceTable items={instrumentsFor(tab)} caption={L(marketMeta[tab].title)} /> : <SpecList market={tab} />}
      </div>
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        {feedPossible ? <FeedNote /> : <span />}
        <Link to={marketMeta[tab].to} className="inline-flex items-center gap-1.5 text-sm font-semibold text-bolt hover:underline">
          {t.common.viewAll} · {L(marketMeta[tab].title)}
          <LuArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

/** Hero visual: compact live board. */
export function QuoteBoard({ symbols }: { symbols: string[] }) {
  const L = useL();
  const t = useT();
  const status = useFeedStatus();
  return (
    <div className="glass glass-blur relative overflow-hidden p-2">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <p className="font-display text-sm font-bold">{L({ en: 'Live markets', ar: 'الأسواق المباشرة' })}</p>
        <FeedBadge status={status} />
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 pb-1 text-[0.7rem] tracking-wide text-fg-subtle uppercase">
        <span>{t.prices.symbol}</span>
        <span className="text-end">{t.prices.bid}</span>
        <span className="w-12 text-end">{t.prices.spread}</span>
      </div>
      <ul className="flex flex-col">
        {symbols.map((s) => (
          <BoardRow key={s} symbol={s} />
        ))}
      </ul>
    </div>
  );
}

function BoardRow({ symbol }: { symbol: string }) {
  const q = useQuote(symbol);
  const inst = instruments.find((i) => i.symbol === symbol)!;
  const L = useL();
  return (
    <li className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 rounded-xl px-4 py-2.5 transition hover:bg-white/[0.04]">
      <span>
        <span className="block text-sm font-semibold" dir="ltr">
          {formatSymbol(symbol)}
        </span>
        <span className="block truncate text-[0.7rem] text-fg-subtle">{L(inst.name)}</span>
      </span>
      <span key={q?.t} dir="ltr" className={clsx('num rounded px-1.5 py-0.5 text-sm font-semibold', q?.dir === 1 && 'flash-up text-up', q?.dir === -1 && 'flash-down text-down', !q && 'text-fg-subtle')}>
        {q ? price(q.b, inst.digits) : '—'}
      </span>
      <span dir="ltr" className="num w-12 text-end text-xs text-fg-muted">
        {q ? spreadIn(inst, q.b, q.a) : '—'}
      </span>
    </li>
  );
}
