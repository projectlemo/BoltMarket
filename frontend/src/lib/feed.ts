/**
 * Live price store.
 *
 * Production: snapshot from GET {API}/api/v1/quotes, then Server-Sent Events from
 * {API}/api/v1/quotes/stream. Prices come from the MT5 feed bridged into the backend.
 *
 * VITE_DEMO_PRICES=true starts a local random-walk *simulation* for design review.
 * Every component that shows prices labels them "Simulated" in that mode.
 */
import { useSyncExternalStore } from 'react';
import { site } from '../config/site';
import { instruments } from '../config/markets';

export interface Quote {
  s: string;
  b: number;
  a: number;
  t: number;
  /** Session open, when the feed provides it (used for daily change). */
  o?: number;
  dir: -1 | 0 | 1;
}

export type FeedStatus = 'idle' | 'connecting' | 'live' | 'simulated' | 'offline';

const quotes = new Map<string, Quote>();
const listeners = new Set<() => void>();
let status: FeedStatus = 'idle';
let started = false;
let scheduled = false;

function emit() {
  if (scheduled) return;
  scheduled = true;
  const flush = () => {
    scheduled = false;
    listeners.forEach((l) => l());
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flush);
  else setTimeout(flush, 16);
}

function setStatus(next: FeedStatus) {
  if (status !== next) {
    status = next;
    emit();
  }
}

interface RawQuote {
  s: string;
  b: number;
  a: number;
  t?: number;
  o?: number;
}

function upsert(q: RawQuote) {
  if (!q || typeof q.s !== 'string' || !Number.isFinite(q.b) || !Number.isFinite(q.a)) return;
  const prev = quotes.get(q.s);
  const dir: Quote['dir'] = prev ? (q.b > prev.b ? 1 : q.b < prev.b ? -1 : 0) : 0;
  quotes.set(q.s, { s: q.s, b: q.b, a: q.a, t: q.t ?? Date.now(), o: q.o ?? prev?.o, dir });
}

async function connectLive() {
  setStatus('connecting');
  try {
    const res = await fetch(`${site.apiUrl}/api/v1/quotes`, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const body = (await res.json()) as { quotes?: RawQuote[] };
      (body.quotes ?? []).forEach(upsert);
      if (quotes.size) setStatus('live');
      emit();
    }
  } catch {
    /* stream below decides the final status */
  }
  if (typeof EventSource === 'undefined') {
    if (!quotes.size) setStatus('offline');
    return;
  }
  const es = new EventSource(`${site.apiUrl}/api/v1/quotes/stream`);
  let failures = 0;
  es.onmessage = (ev) => {
    failures = 0;
    try {
      const data = JSON.parse(ev.data) as RawQuote | RawQuote[];
      (Array.isArray(data) ? data : [data]).forEach(upsert);
      setStatus('live');
      emit();
    } catch {
      /* ignore malformed frames */
    }
  };
  es.onerror = () => {
    // EventSource reconnects by itself; give up only if we never received any price.
    failures += 1;
    if (!quotes.size && failures >= 3) {
      es.close();
      setStatus('offline');
    } else if (quotes.size) {
      setStatus('connecting');
    }
  };
}

function simulate() {
  setStatus('simulated');
  const now = Date.now();
  for (const i of instruments) {
    const drift = 1 + (Math.random() - 0.5) * 0.004;
    const mid = i.ref * drift;
    quotes.set(i.symbol, { s: i.symbol, b: mid - i.refSpread / 2, a: mid + i.refSpread / 2, t: now, o: i.ref, dir: 0 });
  }
  emit();
  setInterval(() => {
    const t = Date.now();
    for (const i of instruments) {
      if (Math.random() > 0.35) continue;
      const q = quotes.get(i.symbol);
      if (!q) continue;
      const mid = (q.b + q.a) / 2;
      const step = mid * (Math.random() - 0.5) * 0.0007;
      const spread = i.refSpread * (0.85 + Math.random() * 0.35);
      upsert({ s: i.symbol, b: mid + step - spread / 2, a: mid + step + spread / 2, t, o: q.o });
    }
    emit();
  }, 1400);
}

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  if (site.apiUrl) void connectLive();
  else if (site.features.demoPrices) simulate();
  else setStatus('offline');
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
  };
}

export function useQuote(symbol: string): Quote | undefined {
  return useSyncExternalStore(
    subscribe,
    () => quotes.get(symbol),
    () => undefined,
  );
}

export function useFeedStatus(): FeedStatus {
  return useSyncExternalStore(
    subscribe,
    () => status,
    () => 'idle' as FeedStatus,
  );
}

/** Non-reactive read for calculators (prefill a field once). */
export function readQuote(symbol: string): Quote | undefined {
  return quotes.get(symbol);
}

export function getQuoteMap(): Map<string, Quote> {
  return quotes;
}
