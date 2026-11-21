import { useEffect, useState } from 'react';
import { site } from '../config/site';

/** Live symbol specification from the MT5 server (GET /api/v1/symbols). */
export interface SymbolSpec {
  symbol: string;
  contract_size?: number;
  digits?: number;
  volume_min?: number;
  volume_max?: number;
  volume_step?: number;
  swap_long?: number;
  swap_short?: number;
  swap_mode?: string;
}

let cache: Promise<Record<string, SymbolSpec>> | null = null;

function load(): Promise<Record<string, SymbolSpec>> {
  if (!cache) {
    cache = fetch(`${site.apiUrl}/api/v1/symbols`, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? (r.json() as Promise<{ symbols: SymbolSpec[] }>) : { symbols: [] }))
      .then((b) => Object.fromEntries((b.symbols ?? []).map((s) => [s.symbol, s])))
      .catch(() => ({}));
  }
  return cache;
}

/** Returns live specs when the backend has MT5 connected, otherwise an empty map. */
export function useSymbolSpecs(): Record<string, SymbolSpec> {
  const [specs, setSpecs] = useState<Record<string, SymbolSpec>>({});
  useEffect(() => {
    if (!site.apiUrl) return;
    let alive = true;
    void load().then((s) => alive && setSpecs(s));
    return () => {
      alive = false;
    };
  }, []);
  return specs;
}
