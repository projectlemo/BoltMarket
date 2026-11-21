import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, apiConfigured, refreshSession, tokenStore, type TokenPair } from './api';

export type Role = 'client' | 'support' | 'compliance' | 'finance' | 'admin';
export type KycStatus = 'none' | 'draft' | 'pending' | 'approved' | 'rejected';

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  country: string;
  language: 'en' | 'ar';
  role: Role;
  email_verified: boolean;
  totp_enabled: boolean;
  kyc_status: KycStatus;
  referral_code: string;
  created_at: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export type LoginResult = { mfaRequired: false } | { mfaRequired: true; mfaToken: string };

interface AuthCtx {
  status: AuthStatus;
  user: User | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  setUser: (u: User) => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Always "loading" on first render so prerendered HTML and hydration match.
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUserState] = useState<User | null>(null);

  const loadMe = useCallback(async () => {
    try {
      const me = await api<User>('/me');
      setUserState(me);
      setStatus('authenticated');
    } catch {
      setUserState(null);
      setStatus('anonymous');
    }
  }, []);

  useEffect(() => {
    if (!apiConfigured || !tokenStore.refresh) {
      setStatus('anonymous');
      return;
    }
    void (async () => {
      if (await refreshSession()) await loadMe();
      else setStatus('anonymous');
    })();
  }, [loadMe]);

  useEffect(
    () =>
      tokenStore.onCleared(() => {
        setUserState(null);
        setStatus('anonymous');
      }),
    [],
  );

  const finish = useCallback(
    async (pair: TokenPair) => {
      tokenStore.set(pair.access_token, pair.refresh_token);
      await loadMe();
    },
    [loadMe],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      const res = await api<TokenPair | { mfa_required: true; mfa_token: string }>('/auth/login', {
        body: { email, password },
        auth: false,
      });
      if ('mfa_required' in res) return { mfaRequired: true, mfaToken: res.mfa_token };
      await finish(res);
      return { mfaRequired: false };
    },
    [finish],
  );

  const verifyMfa = useCallback(
    async (mfaToken: string, code: string) => {
      const pair = await api<TokenPair>('/auth/login/2fa', { body: { mfa_token: mfaToken, code }, auth: false });
      await finish(pair);
    },
    [finish],
  );

  const logout = useCallback(async () => {
    const rt = tokenStore.refresh;
    try {
      if (rt) await api('/auth/logout', { body: { refresh_token: rt }, auth: false });
    } catch {
      /* best effort */
    }
    tokenStore.clear();
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ status, user, login, verifyMfa, logout, reload: loadMe, setUser: (u: User) => setUserState(u) }),
    [status, user, login, verifyMfa, logout, loadMe],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
