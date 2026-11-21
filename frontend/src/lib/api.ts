/**
 * API client for the Bolt Markets API (backend/).
 * Access token lives in memory; the rotating refresh token in localStorage
 * (the backend detects refresh-token reuse and revokes the whole session family).
 */
import { site } from '../config/site';

export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;
  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const RT_KEY = 'bolt.rt';
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
const authListeners = new Set<() => void>();

export const apiConfigured = Boolean(site.apiUrl);

export const tokenStore = {
  get access() {
    return accessToken;
  },
  get refresh(): string | null {
    try {
      return localStorage.getItem(RT_KEY);
    } catch {
      return null;
    }
  },
  set(access: string, refresh: string) {
    accessToken = access;
    try {
      localStorage.setItem(RT_KEY, refresh);
    } catch {
      /* private mode: session-only */
    }
  },
  clear() {
    accessToken = null;
    try {
      localStorage.removeItem(RT_KEY);
    } catch {
      /* ignore */
    }
    authListeners.forEach((l) => l());
  },
  onCleared(l: () => void) {
    authListeners.add(l);
    return () => authListeners.delete(l);
  },
};

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

async function toError(res: Response): Promise<ApiError> {
  let code = `HTTP_${res.status}`;
  let message = res.statusText || 'Request failed';
  const fields: Record<string, string> = {};
  try {
    const body = (await res.json()) as {
      error?: { code?: string; message?: string; fields?: Record<string, string> };
      detail?: unknown;
    };
    if (body.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
      Object.assign(fields, body.error.fields ?? {});
    } else if (typeof body.detail === 'string') {
      message = body.detail;
    } else if (Array.isArray(body.detail)) {
      code = 'VALIDATION_ERROR';
      for (const d of body.detail as { loc?: unknown[]; msg?: string }[]) {
        const key = String(d.loc?.[d.loc.length - 1] ?? 'form');
        fields[key] = d.msg ?? 'Invalid value';
      }
      message = 'Please check the highlighted fields.';
    }
  } catch {
    /* non-JSON error */
  }
  return new ApiError(res.status, code, message, fields);
}

export async function refreshSession(): Promise<boolean> {
  const rt = tokenStore.refresh;
  if (!rt || !apiConfigured) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${site.apiUrl}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refresh_token: rt }),
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 400) tokenStore.clear();
          return false;
        }
        const pair = (await res.json()) as TokenPair;
        tokenStore.set(pair.access_token, pair.refresh_token);
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => {
          refreshing = null;
        }, 0);
      }
    })();
  }
  return refreshing;
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  form?: FormData;
  auth?: boolean;
  signal?: AbortSignal;
}

function pageLanguage(): string {
  return typeof document !== 'undefined' && document.documentElement.lang === 'ar' ? 'ar' : 'en';
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  if (!apiConfigured) throw new ApiError(0, 'API_NOT_CONFIGURED', 'The client portal API is not configured.');
  const useAuth = opts.auth !== false;
  const build = (): RequestInit => {
    // Error messages come back in the language of the page the visitor is using.
    const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': pageLanguage() };
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form;
    else if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
    if (useAuth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body, signal: opts.signal };
  };
  const url = `${site.apiUrl}/api/v1${path}`;
  let res: Response;
  try {
    if (useAuth && !accessToken && tokenStore.refresh) await refreshSession();
    res = await fetch(url, build());
    if (res.status === 401 && useAuth && (await refreshSession())) res = await fetch(url, build());
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK', 'We could not reach Bolt Markets servers. Check your connection and try again.');
  }
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Download an authenticated file (e.g. CSV export or a KYC document for admins). */
export async function apiBlob(path: string): Promise<Blob> {
  if (!apiConfigured) throw new ApiError(0, 'API_NOT_CONFIGURED', 'The client portal API is not configured.');
  const go = () =>
    fetch(`${site.apiUrl}/api/v1${path}`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
  let res = await go();
  if (res.status === 401 && (await refreshSession())) res = await go();
  if (!res.ok) throw await toError(res);
  return res.blob();
}
