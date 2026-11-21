import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';

export interface Resource<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
  set: (data: T) => void;
}

/** GET a resource; re-fetches whenever `path` changes. Pass null to skip. */
export function useResource<T>(path: string | null): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (path === null) return;
    const id = ++latest.current;
    setLoading(true);
    api<T>(path)
      .then((d) => {
        if (id === latest.current) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (id === latest.current) setError(e instanceof ApiError ? e : new ApiError(0, 'UNKNOWN', String(e)));
      })
      .finally(() => {
        if (id === latest.current) setLoading(false);
      });
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, set: setData };
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Runs an async action with a busy flag; errors are returned rather than thrown. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: ApiError }> => {
    setBusy(true);
    try {
      return { ok: true, value: await fn() };
    } catch (e) {
      return { ok: false, error: e instanceof ApiError ? e : new ApiError(0, 'UNKNOWN', String(e)) };
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, run };
}

export function qs(params: Record<string, string | number | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}
