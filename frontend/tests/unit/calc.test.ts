import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convertRate, marginLevel, marginRequired, normalizeLots, pipValue, positionSize, profitLoss, type CalcInstrument } from '../../src/lib/calc';

const fx = (symbol: string, quote: string, pipSize = 0.0001): CalcInstrument => ({ symbol, quote, pipSize, contractSize: 100_000, minLot: 0.01, lotStep: 0.01, maxLot: 100 });
const EURUSD = fx('EURUSD', 'USD');
const GBPUSD = fx('GBPUSD', 'USD');
const USDJPY = fx('USDJPY', 'JPY', 0.01);
const mids = { EURUSD: 1.1, GBPUSD: 1.25, USDJPY: 150 };

test('convertRate: direct, inverse and USD cross', () => {
  assert.equal(convertRate('USD', 'USD', mids), 1);
  assert.equal(convertRate('EUR', 'USD', mids), 1.1);
  assert.equal(convertRate('JPY', 'USD', mids), 1 / 150);
  assert.ok(Math.abs((convertRate('EUR', 'GBP', mids) ?? 0) - 1.1 / 1.25) < 1e-12);
  assert.equal(convertRate('CHF', 'USD', mids), null);
});

test('pip value of one standard lot', () => {
  assert.ok(Math.abs(pipValue(EURUSD, 1, 1) - 10) < 1e-9);
  assert.ok(Math.abs(pipValue(USDJPY, 1, 1 / 150) - 1000 / 150) < 1e-9);
});

test('position size: 1% of 8,000 with a 32-pip stop on GBPUSD is 0.25 lots', () => {
  const r = positionSize({ inst: GBPUSD, balance: 8000, riskPercent: 1, stopPips: 32, quoteToAccount: 1 });
  assert.equal(r.riskAmount, 80);
  assert.equal(r.lots, 0.25);
  assert.ok(Math.abs(r.actualRisk - 80) < 1e-9);
});

test('lots are rounded down to the step and clamped', () => {
  assert.equal(normalizeLots(EURUSD, 0.256), 0.25);
  assert.equal(normalizeLots(EURUSD, 0.004), 0);
  assert.equal(normalizeLots(EURUSD, 250), 100);
  assert.equal(normalizeLots(EURUSD, Number.NaN), 0);
});

test('margin, profit and margin level', () => {
  assert.ok(Math.abs(marginRequired(EURUSD, 1, 1.1, 100, 1) - 1100) < 1e-9);
  assert.equal(marginRequired(EURUSD, 1, 1.1, 0, 1), 0);
  const buy = profitLoss(EURUSD, 'buy', 0.5, 1.1, 1.102, 1);
  assert.ok(Math.abs(buy.pips - 20) < 1e-6 && Math.abs(buy.profit - 100) < 1e-6);
  const sell = profitLoss(EURUSD, 'sell', 0.5, 1.1, 1.102, 1);
  assert.ok(Math.abs(sell.profit + 100) < 1e-6);
  assert.equal(marginLevel(1500, 1000), 150);
  assert.equal(marginLevel(1500, 0), null);
});
