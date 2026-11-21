/**
 * Trading calculator maths. Pure functions, unit-tested in tests/unit/calc.test.ts.
 * Results are indicative; MetaTrader 5 shows the exact figures for your account.
 */
export interface CalcInstrument {
  symbol: string;
  quote: string;
  pipSize: number;
  contractSize: number;
  minLot: number;
  lotStep: number;
  maxLot: number;
}

export type Side = 'buy' | 'sell';

/**
 * Units of `to` received for 1 unit of `from`, using FX mid prices keyed like "EURUSD".
 * Tries the direct pair, the inverse pair, then a cross through USD.
 */
export function convertRate(from: string, to: string, mids: Record<string, number>): number | null {
  if (from === to) return 1;
  const direct = mids[from + to];
  if (direct && direct > 0) return direct;
  const inverse = mids[to + from];
  if (inverse && inverse > 0) return 1 / inverse;
  if (from !== 'USD' && to !== 'USD') {
    const a = convertRate(from, 'USD', mids);
    const b = convertRate('USD', to, mids);
    if (a && b) return a * b;
  }
  return null;
}

/** Value of one pip (or point) for the given volume, in account currency. */
export function pipValue(inst: CalcInstrument, lots: number, quoteToAccount: number): number {
  return inst.pipSize * inst.contractSize * lots * quoteToAccount;
}

/** Round a volume down to the instrument's lot step and clamp to its limits. */
export function normalizeLots(inst: CalcInstrument, lots: number): number {
  if (!Number.isFinite(lots) || lots <= 0) return 0;
  const steps = Math.floor(lots / inst.lotStep + 1e-9);
  const rounded = Number((steps * inst.lotStep).toFixed(6));
  if (rounded < inst.minLot) return 0;
  return Math.min(rounded, inst.maxLot);
}

export interface PositionSizeInput {
  inst: CalcInstrument;
  balance: number;
  riskPercent: number;
  stopPips: number;
  quoteToAccount: number;
}

export interface PositionSizeResult {
  riskAmount: number;
  pipValuePerLot: number;
  rawLots: number;
  lots: number;
  /** Actual risk at the normalised lot size. */
  actualRisk: number;
}

export function positionSize({ inst, balance, riskPercent, stopPips, quoteToAccount }: PositionSizeInput): PositionSizeResult {
  const riskAmount = (balance * riskPercent) / 100;
  const pipValuePerLot = pipValue(inst, 1, quoteToAccount);
  const rawLots = stopPips > 0 && pipValuePerLot > 0 ? riskAmount / (stopPips * pipValuePerLot) : 0;
  const lots = normalizeLots(inst, rawLots);
  return { riskAmount, pipValuePerLot, rawLots, lots, actualRisk: lots * stopPips * pipValuePerLot };
}

/** Margin required in account currency: notional (in quote currency) converted, divided by leverage. */
export function marginRequired(inst: CalcInstrument, lots: number, price: number, leverage: number, quoteToAccount: number): number {
  if (leverage <= 0) return 0;
  return (inst.contractSize * lots * price * quoteToAccount) / leverage;
}

export interface ProfitResult {
  pips: number;
  profit: number;
}

export function profitLoss(inst: CalcInstrument, side: Side, lots: number, open: number, close: number, quoteToAccount: number): ProfitResult {
  const dir = side === 'buy' ? 1 : -1;
  const move = (close - open) * dir;
  return {
    pips: move / inst.pipSize,
    profit: move * inst.contractSize * lots * quoteToAccount,
  };
}

/** Margin level (%) = equity / used margin × 100. */
export function marginLevel(equity: number, usedMargin: number): number | null {
  return usedMargin > 0 ? (equity / usedMargin) * 100 : null;
}
