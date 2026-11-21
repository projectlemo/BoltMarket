import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { leverageOptions } from '../../config/accounts';
import { bySymbol, formatSymbol, instruments, markets, type Instrument } from '../../config/markets';
import { useL } from '../../i18n';
import { convertRate, marginLevel, marginRequired, pipValue, positionSize, profitLoss, type Side } from '../../lib/calc';
import { getQuoteMap, useFeedStatus } from '../../lib/feed';
import { money } from '../../lib/format';
import { marketMeta } from '../marketing/MarketHub';
import { Segmented } from '../ui/Form';

const ACCOUNT_CCYS = ['USD', 'EUR', 'GBP'] as const;

/* ───────────── shared inputs ───────────── */

function NumField({
  label,
  value,
  onChange,
  suffix,
  step = 'any',
  min = 0,
  hint,
  id,
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  step?: string | number;
  min?: number;
  hint?: ReactNode;
  id: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={clsx(
            'num h-12 w-full rounded-xl border border-line-strong bg-surface-2/80 px-4 text-fg outline-none focus:border-bolt/70 focus:ring-4 focus:ring-bolt/15',
            suffix && 'pe-16',
          )}
          dir="ltr"
        />
        {suffix ? <span className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-sm text-fg-subtle">{suffix}</span> : null}
      </div>
      {hint ? <p className="text-xs text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

function InstrumentSelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  const L = useL();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {L({ en: 'Instrument', ar: 'الأداة' })}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-xl border border-line-strong bg-surface-2/80 px-4 text-fg outline-none focus:border-bolt/70 focus:ring-4 focus:ring-bolt/15"
      >
        {markets.map((m) => (
          <optgroup key={m} label={L(marketMeta[m].title)}>
            {instruments
              .filter((i) => i.market === m)
              .map((i) => (
                <option key={i.symbol} value={i.symbol}>
                  {formatSymbol(i.symbol)} · {L(i.name)}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

function CurrencySelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  const L = useL();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-sm font-medium text-fg">
        {L({ en: 'Account currency', ar: 'عملة الحساب' })}
      </span>
      <Segmented
        label={L({ en: 'Account currency', ar: 'عملة الحساب' })}
        value={value}
        onChange={onChange}
        options={ACCOUNT_CCYS.map((c) => ({ value: c, label: c }))}
        className="h-12 items-center"
      />
    </div>
  );
}

/** FX mids from the live/simulated feed, keyed "EURUSD". */
function useMids(): Record<string, number> {
  const status = useFeedStatus();
  const [mids, setMids] = useState<Record<string, number>>({});
  useEffect(() => {
    if (status !== 'live' && status !== 'simulated') return;
    const read = () => {
      const out: Record<string, number> = {};
      getQuoteMap().forEach((q, s) => {
        out[s] = (q.b + q.a) / 2;
      });
      setMids(out);
    };
    read();
    const id = window.setInterval(read, 3000);
    return () => window.clearInterval(id);
  }, [status]);
  return mids;
}

/** Conversion from the instrument's quote currency to the account currency: live when possible, else asked. */
function useConversion(inst: Instrument, account: string, mids: Record<string, number>) {
  const auto = useMemo(() => convertRate(inst.quote, account, mids), [inst.quote, account, mids]);
  const [manual, setManual] = useState('');
  useEffect(() => setManual(''), [inst.quote, account]);
  const needsInput = auto === null && inst.quote !== account;
  const rate = inst.quote === account ? 1 : (auto ?? (Number(manual) > 0 ? Number(manual) : null));
  return { rate, needsInput, manual, setManual, auto };
}

function ConversionField({ inst, account, conv, id }: { inst: Instrument; account: string; conv: ReturnType<typeof useConversion>; id: string }) {
  const L = useL();
  if (inst.quote === account) return null;
  if (!conv.needsInput && conv.auto) {
    return (
      <p className="text-xs text-fg-subtle sm:col-span-2" dir="auto">
        {L({ en: 'Conversion used', ar: 'سعر التحويل المستخدم' })}: <span dir="ltr">1 {inst.quote} = {conv.auto.toPrecision(6)} {account}</span>
      </p>
    );
  }
  return (
    <NumField
      id={id}
      label={
        <span dir="ltr">
          1 {inst.quote} = ? {account}
        </span>
      }
      value={conv.manual}
      onChange={conv.setManual}
      hint={L({ en: `Enter the current ${inst.quote}→${account} rate to convert the result.`, ar: `أدخل سعر تحويل ${inst.quote} إلى ${account} الحالي لتحويل النتيجة.` })}
    />
  );
}

/** Pre-fill a price field with the live mid once, without overriding user edits. */
function usePriceField(symbol: string, mids: Record<string, number>, digits: number) {
  const [value, setValue] = useState('');
  const touched = useRef(false);
  useEffect(() => {
    touched.current = false;
    setValue('');
  }, [symbol]);
  useEffect(() => {
    if (!touched.current && mids[symbol] && !value) setValue(mids[symbol].toFixed(digits));
  }, [mids, symbol, digits, value]);
  return {
    value,
    setValue: (v: string) => {
      touched.current = true;
      setValue(v);
    },
  };
}

function ResultCard({ items, note }: { items: { label: ReactNode; value: ReactNode; big?: boolean }[]; note?: ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-bolt/25 bg-[radial-gradient(120%_100%_at_100%_0%,rgb(255_212_0/0.12),transparent_60%)] p-6" aria-live="polite">
      {items.map((it, i) => (
        <div key={i} className={clsx(i > 0 && 'border-t border-line/70 pt-4')}>
          <p className="text-sm text-fg-subtle">{it.label}</p>
          <p className={clsx('num mt-1 font-display font-extrabold text-fg', it.big ? 'text-4xl' : 'text-2xl')} dir="ltr">
            {it.value}
          </p>
        </div>
      ))}
      {note ? <p className="mt-auto text-xs leading-relaxed text-fg-subtle">{note}</p> : null}
    </div>
  );
}

const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const unitWord = (inst: Instrument, L: ReturnType<typeof useL>) =>
  inst.market === 'forex' ? L({ en: 'pips', ar: 'نقطة' }) : L({ en: 'points', ar: 'نقطة سعرية' });

/* ───────────── calculators ───────────── */

export function LotSizeCalculator() {
  const L = useL();
  const mids = useMids();
  const [symbol, setSymbol] = useState('EURUSD');
  const [account, setAccount] = useState('USD');
  const [balance, setBalance] = useState('5000');
  const [risk, setRisk] = useState('1');
  const [stop, setStop] = useState('25');
  const inst = bySymbol[symbol];
  const conv = useConversion(inst, account, mids);
  const r = conv.rate ? positionSize({ inst, balance: num(balance), riskPercent: num(risk), stopPips: num(stop), quoteToAccount: conv.rate }) : null;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="grid gap-5 sm:grid-cols-2">
        <InstrumentSelect id="ls-sym" value={symbol} onChange={setSymbol} />
        <CurrencySelect id="ls-ccy" value={account} onChange={setAccount} />
        <NumField id="ls-bal" label={L({ en: 'Account balance', ar: 'رصيد الحساب' })} value={balance} onChange={setBalance} suffix={account} />
        <NumField id="ls-risk" label={L({ en: 'Risk per trade', ar: 'المخاطرة لكل صفقة' })} value={risk} onChange={setRisk} suffix="%" step={0.1} />
        <NumField id="ls-stop" label={L({ en: `Stop-loss distance (${unitWord(inst, L)})`, ar: `مسافة وقف الخسارة (${unitWord(inst, L)})` })} value={stop} onChange={setStop} hint={`1 = ${inst.pipSize}`} />
        <ConversionField id="ls-conv" inst={inst} account={account} conv={conv} />
      </div>
      <ResultCard
        items={[
          { label: L({ en: 'Position size', ar: 'حجم الصفقة' }), value: r ? `${r.lots.toFixed(2)} ${L({ en: 'lots', ar: 'لوت' })}` : '—', big: true },
          { label: L({ en: 'Amount at risk', ar: 'المبلغ المعرّض للخطر' }), value: r ? money(r.actualRisk, account, 2) : '—' },
          { label: L({ en: `Value per ${inst.market === 'forex' ? 'pip' : 'point'} at this size`, ar: 'قيمة النقطة بهذا الحجم' }), value: r ? money(r.lots * r.pipValuePerLot, account, 2) : '—' },
        ]}
        note={
          r && r.lots === 0 && r.rawLots > 0
            ? L({ en: `The ideal size (${r.rawLots.toFixed(4)} lots) is below the minimum of ${inst.minLot}. Widen your risk or tighten the stop.`, ar: `الحجم المثالي (${r.rawLots.toFixed(4)} لوت) أقل من الحد الأدنى ${inst.minLot}. زد المخاطرة أو قلّص مسافة الوقف.` })
            : L({ en: `Rounded down to the ${inst.lotStep}-lot step so you never risk more than planned.`, ar: `مقرَّب إلى الأسفل لأقرب خطوة ${inst.lotStep} لوت حتى لا تتجاوز المخاطرة المخطط لها.` })
        }
      />
    </div>
  );
}

export function PipCalculator() {
  const L = useL();
  const mids = useMids();
  const [symbol, setSymbol] = useState('EURUSD');
  const [account, setAccount] = useState('USD');
  const [lots, setLots] = useState('1');
  const inst = bySymbol[symbol];
  const conv = useConversion(inst, account, mids);
  const v = conv.rate ? pipValue(inst, num(lots), conv.rate) : null;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="grid gap-5 sm:grid-cols-2">
        <InstrumentSelect id="pv-sym" value={symbol} onChange={setSymbol} />
        <CurrencySelect id="pv-ccy" value={account} onChange={setAccount} />
        <NumField id="pv-lots" label={L({ en: 'Trade size (lots)', ar: 'حجم الصفقة (لوت)' })} value={lots} onChange={setLots} step={inst.lotStep} />
        <ConversionField id="pv-conv" inst={inst} account={account} conv={conv} />
      </div>
      <ResultCard
        items={[
          { label: L({ en: `Value of 1 ${inst.market === 'forex' ? 'pip' : 'point'} (${inst.pipSize})`, ar: `قيمة النقطة الواحدة (${inst.pipSize})` }), value: v !== null ? money(v, account, 2) : '—', big: true },
          { label: L({ en: 'Value of 10', ar: 'قيمة 10 نقاط' }), value: v !== null ? money(v * 10, account, 2) : '—' },
          { label: L({ en: 'Value of 100', ar: 'قيمة 100 نقطة' }), value: v !== null ? money(v * 100, account, 2) : '—' },
        ]}
        note={L({ en: `1 lot = ${L(inst.contractUnit)}.`, ar: `1 لوت = ${L(inst.contractUnit)}.` })}
      />
    </div>
  );
}

export function MarginCalculator() {
  const L = useL();
  const mids = useMids();
  const [symbol, setSymbol] = useState('EURUSD');
  const [account, setAccount] = useState('USD');
  const [lots, setLots] = useState('1');
  const [lev, setLev] = useState('100');
  const [equity, setEquity] = useState('');
  const inst = bySymbol[symbol];
  const priceField = usePriceField(symbol, mids, inst.digits);
  const conv = useConversion(inst, account, mids);
  const price = num(priceField.value);
  const m = conv.rate && price > 0 ? marginRequired(inst, num(lots), price, num(lev), conv.rate) : null;
  const level = m && num(equity) > 0 ? marginLevel(num(equity), m) : null;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="grid gap-5 sm:grid-cols-2">
        <InstrumentSelect id="mg-sym" value={symbol} onChange={setSymbol} />
        <CurrencySelect id="mg-ccy" value={account} onChange={setAccount} />
        <NumField id="mg-lots" label={L({ en: 'Trade size (lots)', ar: 'حجم الصفقة (لوت)' })} value={lots} onChange={setLots} step={inst.lotStep} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="mg-lev" className="text-sm font-medium text-fg">
            {L({ en: 'Leverage', ar: 'الرافعة المالية' })}
          </label>
          <select
            id="mg-lev"
            value={lev}
            onChange={(e) => setLev(e.target.value)}
            className="h-12 rounded-xl border border-line-strong bg-surface-2/80 px-4 text-fg outline-none focus:border-bolt/70"
          >
            {[1, 10, 20, 30, ...leverageOptions].filter((v, i, a) => a.indexOf(v) === i).map((l) => (
              <option key={l} value={l}>
                1:{l}
              </option>
            ))}
          </select>
        </div>
        <NumField id="mg-price" label={L({ en: `Price of ${formatSymbol(symbol)}`, ar: `سعر ${formatSymbol(symbol)}` })} value={priceField.value} onChange={priceField.setValue} hint={mids[symbol] ? L({ en: 'Pre-filled with the current price.', ar: 'مُعبّأ بالسعر الحالي.' }) : L({ en: 'Enter the current price from MT5.', ar: 'أدخل السعر الحالي من ميتاتريدر 5.' })} />
        <NumField id="mg-eq" label={L({ en: 'Account equity (optional)', ar: 'حقوق الملكية (اختياري)' })} value={equity} onChange={setEquity} suffix={account} />
        <ConversionField id="mg-conv" inst={inst} account={account} conv={conv} />
      </div>
      <ResultCard
        items={[
          { label: L({ en: 'Required margin', ar: 'الهامش المطلوب' }), value: m !== null ? money(m, account, 2) : '—', big: true },
          { label: L({ en: 'Position value', ar: 'قيمة الصفقة' }), value: m !== null ? money(m * num(lev), account, 0) : '—' },
          { label: L({ en: 'Margin level after opening', ar: 'مستوى الهامش بعد الفتح' }), value: level !== null ? `${level.toFixed(0)}%` : '—' },
        ]}
        note={L({ en: 'Instrument margin rates set on the server can raise the requirement; MT5 shows the exact figure before you trade.', ar: 'قد ترفع نسب الهامش المحددة لكل أداة على الخادم المتطلبات، ويعرض ميتاتريدر 5 الرقم الدقيق قبل التداول.' })}
      />
    </div>
  );
}

export function ProfitCalculator() {
  const L = useL();
  const mids = useMids();
  const [symbol, setSymbol] = useState('EURUSD');
  const [account, setAccount] = useState('USD');
  const [side, setSide] = useState<Side>('buy');
  const [lots, setLots] = useState('1');
  const inst = bySymbol[symbol];
  const open = usePriceField(symbol, mids, inst.digits);
  const [close, setClose] = useState('');
  useEffect(() => setClose(''), [symbol]);
  const conv = useConversion(inst, account, mids);
  const o = num(open.value);
  const c = num(close);
  const r = conv.rate && o > 0 && c > 0 ? profitLoss(inst, side, num(lots), o, c, conv.rate) : null;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="grid gap-5 sm:grid-cols-2">
        <InstrumentSelect id="pl-sym" value={symbol} onChange={setSymbol} />
        <CurrencySelect id="pl-ccy" value={account} onChange={setAccount} />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg">{L({ en: 'Direction', ar: 'الاتجاه' })}</span>
          <Segmented
            label={L({ en: 'Direction', ar: 'الاتجاه' })}
            value={side}
            onChange={setSide}
            className="h-12 items-center"
            options={[
              { value: 'buy', label: L({ en: 'Buy', ar: 'شراء' }) },
              { value: 'sell', label: L({ en: 'Sell', ar: 'بيع' }) },
            ]}
          />
        </div>
        <NumField id="pl-lots" label={L({ en: 'Trade size (lots)', ar: 'حجم الصفقة (لوت)' })} value={lots} onChange={setLots} step={inst.lotStep} />
        <NumField id="pl-open" label={L({ en: 'Open price', ar: 'سعر الفتح' })} value={open.value} onChange={open.setValue} />
        <NumField id="pl-close" label={L({ en: 'Close price', ar: 'سعر الإغلاق' })} value={close} onChange={setClose} />
        <ConversionField id="pl-conv" inst={inst} account={account} conv={conv} />
      </div>
      <ResultCard
        items={[
          {
            label: L({ en: 'Profit / loss', ar: 'الربح / الخسارة' }),
            value: r ? <span className={r.profit >= 0 ? 'text-up' : 'text-down'}>{money(r.profit, account, 2)}</span> : '—',
            big: true,
          },
          { label: unitWord(inst, L), value: r ? r.pips.toFixed(1) : '—' },
        ]}
        note={L({ en: 'Excludes spread, commission and swaps.', ar: 'لا يشمل السبريد والعمولة ورسوم التبييت.' })}
      />
    </div>
  );
}
