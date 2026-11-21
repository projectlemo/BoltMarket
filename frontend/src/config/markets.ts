/**
 * Instrument catalogue shown on the website and used by the calculators.
 *
 * ⚠ VERIFY BEFORE LAUNCH: contract sizes, lot limits and session descriptions are
 * industry-standard defaults. They must match the symbol settings on your MT5 server.
 * When the backend is connected with MT5 enabled, live symbol specifications from
 * GET /api/v1/symbols override these values on the Markets pages.
 */
export type MarketId = 'forex' | 'indices' | 'crypto' | 'commodities';

export interface Instrument {
  symbol: string;
  market: MarketId;
  group: string;
  name: { en: string; ar: string };
  /** Currency the price is quoted in (P&L currency). */
  quote: string;
  /** Base currency for FX pairs (used for margin conversion). */
  base?: string;
  digits: number;
  /** Size of one pip / point used by the calculators. */
  pipSize: number;
  contractSize: number;
  contractUnit: { en: string; ar: string };
  minLot: number;
  lotStep: number;
  maxLot: number;
  /** Reference level used only by the clearly-labelled simulated price mode. */
  ref: number;
  /** Typical spread in price units used only by the simulated price mode. */
  refSpread: number;
}

const units = {
  ccy: (c: string) => ({ en: `100,000 ${c}`, ar: `100,000 ${c}` }),
  index: { en: '1 × index', ar: '1 × المؤشر' },
  coin: (c: string) => ({ en: `1 ${c}`, ar: `1 ${c}` }),
  oz: (n: string) => ({ en: `${n} troy oz`, ar: `${n} أونصة` }),
  bbl: { en: '100 barrels', ar: '100 برميل' },
  mmbtu: { en: '10,000 MMBtu', ar: '10,000 مليون وحدة حرارية' },
};

const fx = (
  symbol: string,
  group: 'major' | 'cross' | 'exotic',
  en: string,
  ar: string,
  ref: number,
  spreadPips: number,
): Instrument => {
  const base = symbol.slice(0, 3);
  const quote = symbol.slice(3);
  const jpy = quote === 'JPY';
  const pip = jpy ? 0.01 : 0.0001;
  return {
    symbol,
    market: 'forex',
    group,
    name: { en, ar },
    base,
    quote,
    digits: jpy ? 3 : 5,
    pipSize: pip,
    contractSize: 100_000,
    contractUnit: units.ccy(base),
    minLot: 0.01,
    lotStep: 0.01,
    maxLot: 100,
    ref,
    refSpread: spreadPips * pip,
  };
};

export const instruments: Instrument[] = [
  // ── Forex ────────────────────────────────────────────────────────
  fx('EURUSD', 'major', 'Euro vs US Dollar', 'اليورو مقابل الدولار الأمريكي', 1.16, 1.5),
  fx('GBPUSD', 'major', 'British Pound vs US Dollar', 'الجنيه الإسترليني مقابل الدولار الأمريكي', 1.33, 1.7),
  fx('USDJPY', 'major', 'US Dollar vs Japanese Yen', 'الدولار الأمريكي مقابل الين الياباني', 152.0, 1.6),
  fx('USDCHF', 'major', 'US Dollar vs Swiss Franc', 'الدولار الأمريكي مقابل الفرنك السويسري', 0.8, 1.8),
  fx('AUDUSD', 'major', 'Australian Dollar vs US Dollar', 'الدولار الأسترالي مقابل الدولار الأمريكي', 0.655, 1.6),
  fx('USDCAD', 'major', 'US Dollar vs Canadian Dollar', 'الدولار الأمريكي مقابل الدولار الكندي', 1.39, 1.9),
  fx('NZDUSD', 'major', 'New Zealand Dollar vs US Dollar', 'الدولار النيوزيلندي مقابل الدولار الأمريكي', 0.58, 2.0),
  fx('EURGBP', 'cross', 'Euro vs British Pound', 'اليورو مقابل الجنيه الإسترليني', 0.872, 1.9),
  fx('EURJPY', 'cross', 'Euro vs Japanese Yen', 'اليورو مقابل الين الياباني', 176.3, 2.2),
  fx('GBPJPY', 'cross', 'British Pound vs Japanese Yen', 'الجنيه الإسترليني مقابل الين الياباني', 202.2, 2.8),
  fx('EURCHF', 'cross', 'Euro vs Swiss Franc', 'اليورو مقابل الفرنك السويسري', 0.928, 2.2),
  fx('AUDJPY', 'cross', 'Australian Dollar vs Japanese Yen', 'الدولار الأسترالي مقابل الين الياباني', 99.6, 2.4),
  fx('EURAUD', 'cross', 'Euro vs Australian Dollar', 'اليورو مقابل الدولار الأسترالي', 1.771, 2.6),
  fx('GBPCHF', 'cross', 'British Pound vs Swiss Franc', 'الجنيه الإسترليني مقابل الفرنك السويسري', 1.064, 2.9),
  fx('USDMXN', 'exotic', 'US Dollar vs Mexican Peso', 'الدولار الأمريكي مقابل البيزو المكسيكي', 18.4, 45),
  fx('USDZAR', 'exotic', 'US Dollar vs South African Rand', 'الدولار الأمريكي مقابل الراند الجنوب أفريقي', 17.4, 60),

  // ── Indices ──────────────────────────────────────────────────────
  ...(
    [
      ['US30', 'US Wall Street 30', 'مؤشر وول ستريت 30 الأمريكي', 'USD', 46000, 2.4],
      ['US500', 'US 500', 'مؤشر الولايات المتحدة 500', 'USD', 6600, 0.6],
      ['NAS100', 'US Tech 100', 'مؤشر التكنولوجيا الأمريكي 100', 'USD', 24500, 1.4],
      ['GER40', 'Germany 40', 'مؤشر ألمانيا 40', 'EUR', 23800, 1.2],
      ['UK100', 'UK 100', 'مؤشر المملكة المتحدة 100', 'GBP', 9500, 1.0],
      ['JP225', 'Japan 225', 'مؤشر اليابان 225', 'JPY', 48000, 8],
      ['EU50', 'Europe 50', 'مؤشر أوروبا 50', 'EUR', 5600, 1.6],
      ['AUS200', 'Australia 200', 'مؤشر أستراليا 200', 'AUD', 8700, 1.5],
    ] as const
  ).map(
    ([symbol, en, ar, quote, ref, spread]): Instrument => ({
      symbol,
      market: 'indices',
      group: 'index',
      name: { en, ar },
      quote,
      digits: 1,
      pipSize: 1,
      contractSize: 1,
      contractUnit: units.index,
      minLot: 0.1,
      lotStep: 0.1,
      maxLot: 50,
      ref,
      refSpread: spread,
    }),
  ),

  // ── Crypto ───────────────────────────────────────────────────────
  ...(
    [
      ['BTCUSD', 'Bitcoin', 'بيتكوين', 'BTC', 95000, 2, 1, 30],
      ['ETHUSD', 'Ethereum', 'إيثريوم', 'ETH', 3200, 2, 0.1, 2.5],
      ['SOLUSD', 'Solana', 'سولانا', 'SOL', 150, 3, 0.01, 0.35],
      ['XRPUSD', 'XRP', 'إكس آر بي', 'XRP', 2.2, 5, 0.0001, 0.006],
      ['LTCUSD', 'Litecoin', 'لايتكوين', 'LTC', 90, 3, 0.01, 0.3],
      ['BNBUSD', 'BNB', 'بي إن بي', 'BNB', 900, 2, 0.1, 1.8],
      ['ADAUSD', 'Cardano', 'كاردانو', 'ADA', 0.55, 5, 0.0001, 0.003],
      ['DOGEUSD', 'Dogecoin', 'دوجكوين', 'DOGE', 0.17, 5, 0.00001, 0.0008],
    ] as const
  ).map(
    ([symbol, en, ar, coin, ref, digits, pip, spread]): Instrument => ({
      symbol,
      market: 'crypto',
      group: 'crypto',
      name: { en, ar },
      base: coin,
      quote: 'USD',
      digits,
      pipSize: pip,
      contractSize: 1,
      contractUnit: units.coin(coin),
      minLot: 0.01,
      lotStep: 0.01,
      maxLot: 20,
      ref,
      refSpread: spread,
    }),
  ),

  // ── Metals & commodities ─────────────────────────────────────────
  {
    symbol: 'XAUUSD', market: 'commodities', group: 'metal', name: { en: 'Gold vs US Dollar', ar: 'الذهب مقابل الدولار الأمريكي' },
    base: 'XAU', quote: 'USD', digits: 2, pipSize: 0.1, contractSize: 100, contractUnit: units.oz('100'),
    minLot: 0.01, lotStep: 0.01, maxLot: 50, ref: 4000, refSpread: 0.3,
  },
  {
    symbol: 'XAGUSD', market: 'commodities', group: 'metal', name: { en: 'Silver vs US Dollar', ar: 'الفضة مقابل الدولار الأمريكي' },
    base: 'XAG', quote: 'USD', digits: 3, pipSize: 0.01, contractSize: 5000, contractUnit: units.oz('5,000'),
    minLot: 0.01, lotStep: 0.01, maxLot: 50, ref: 48, refSpread: 0.03,
  },
  {
    symbol: 'XPTUSD', market: 'commodities', group: 'metal', name: { en: 'Platinum vs US Dollar', ar: 'البلاتين مقابل الدولار الأمريكي' },
    base: 'XPT', quote: 'USD', digits: 2, pipSize: 0.1, contractSize: 100, contractUnit: units.oz('100'),
    minLot: 0.01, lotStep: 0.01, maxLot: 20, ref: 1500, refSpread: 3,
  },
  {
    symbol: 'USOIL', market: 'commodities', group: 'energy', name: { en: 'WTI Crude Oil', ar: 'نفط خام غرب تكساس' },
    quote: 'USD', digits: 2, pipSize: 0.01, contractSize: 100, contractUnit: units.bbl,
    minLot: 0.01, lotStep: 0.01, maxLot: 50, ref: 60, refSpread: 0.04,
  },
  {
    symbol: 'UKOIL', market: 'commodities', group: 'energy', name: { en: 'Brent Crude Oil', ar: 'نفط خام برنت' },
    quote: 'USD', digits: 2, pipSize: 0.01, contractSize: 100, contractUnit: units.bbl,
    minLot: 0.01, lotStep: 0.01, maxLot: 50, ref: 64, refSpread: 0.04,
  },
  {
    symbol: 'NATGAS', market: 'commodities', group: 'energy', name: { en: 'Natural Gas', ar: 'الغاز الطبيعي' },
    quote: 'USD', digits: 3, pipSize: 0.001, contractSize: 10_000, contractUnit: units.mmbtu,
    minLot: 0.01, lotStep: 0.01, maxLot: 20, ref: 4.2, refSpread: 0.006,
  },
];

export const markets: MarketId[] = ['forex', 'indices', 'crypto', 'commodities'];

export const bySymbol: Record<string, Instrument> = Object.fromEntries(instruments.map((i) => [i.symbol, i]));

export const instrumentsFor = (m: MarketId) => instruments.filter((i) => i.market === m);

/** Symbols streamed in the site-wide ticker. */
export const tickerSymbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'US500', 'NAS100', 'BTCUSD', 'ETHUSD', 'USOIL', 'GER40', 'AUDUSD', 'XAGUSD'];

/** Session descriptions per market (verify against your MT5 server time and symbol sessions). */
export const sessions: Record<MarketId, { en: string; ar: string }> = {
  forex: { en: '24 hours, Monday to Friday', ar: 'على مدار 24 ساعة، من الإثنين إلى الجمعة' },
  indices: { en: 'Follows each index’s cash and futures sessions', ar: 'وفق جلسات التداول الخاصة بكل مؤشر' },
  crypto: { en: '7 days a week, with short maintenance breaks', ar: '7 أيام في الأسبوع مع فترات صيانة قصيرة' },
  commodities: { en: 'Monday to Friday with a daily break', ar: 'من الإثنين إلى الجمعة مع استراحة يومية' },
};

export const formatSymbol = (symbol: string) => {
  const i = bySymbol[symbol];
  if (i && i.market === 'forex') return `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
  return symbol;
};
