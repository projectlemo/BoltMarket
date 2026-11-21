/**
 * Back-office API client. The access token lives in memory; the refresh token is kept in
 * sessionStorage, so closing the browser tab ends the staff session.
 */
export const API_URL = String(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
export const apiConfigured = API_URL.length > 0;

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

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
}

const RT_KEY = 'bolt_admin_refresh';
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSignedOut: (() => void) | null = null;

export const session = {
  get refresh(): string | null {
    try {
      return sessionStorage.getItem(RT_KEY);
    } catch {
      return null;
    }
  },
  set(pair: TokenPair) {
    accessToken = pair.access_token;
    try {
      sessionStorage.setItem(RT_KEY, pair.refresh_token);
    } catch {
      /* storage unavailable: session lasts until reload */
    }
  },
  clear() {
    accessToken = null;
    try {
      sessionStorage.removeItem(RT_KEY);
    } catch {
      /* ignore */
    }
  },
  onSignedOut(fn: () => void) {
    onSignedOut = fn;
  },
};

async function parseError(res: Response): Promise<ApiError> {
  const data = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null;
  const err = data?.error;
  return new ApiError(res.status, err?.code ?? `HTTP_${res.status}`, err?.message ?? `Request failed (${res.status}).`, err?.fields ?? {});
}

export async function refreshSession(): Promise<boolean> {
  const rt = session.refresh;
  if (!rt || !apiConfigured) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refresh_token: rt }),
        });
        if (res.status === 409) return false; // refreshed by another tab a moment ago
        if (!res.ok) {
          session.clear();
          onSignedOut?.();
          return false;
        }
        session.set((await res.json()) as TokenPair);
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => (refreshing = null), 0);
      }
    })();
  }
  return refreshing;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

async function request(path: string, opts: RequestOptions = {}): Promise<Response> {
  if (!apiConfigured) throw new ApiError(0, 'API_NOT_CONFIGURED', 'Set VITE_API_URL when building the back office.');
  const make = (): RequestInit => {
    const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': 'en' };
    let body: BodyInit | undefined;
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
    if (opts.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body };
  };
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, make());
    if (res.status === 401 && opts.auth !== false && (await refreshSession())) res = await fetch(`${API_URL}/api/v1${path}`, make());
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the API. Check your connection.');
  }
  if (!res.ok) throw await parseError(res);
  return res;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await request(path, opts);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function apiBlob(path: string): Promise<Blob> {
  return (await request(path)).blob();
}

export function hasSession(): boolean {
  return accessToken !== null;
}
