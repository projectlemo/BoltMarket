import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, refreshSession, session, type TokenPair } from './api';
import type { Me, Permission } from './types';

type Stage = 'loading' | 'signed-out' | 'mfa' | 'setup-2fa' | 'ready';

interface AuthState {
  stage: Stage;
  me: Me | null;
  /** set when 2FA is optional on this server and the user has not turned it on */
  recommend2fa: boolean;
  login: (email: string, password: string) => Promise<void>;
  verify: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  can: (perm: Permission) => boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>('loading');
  const [me, setMe] = useState<Me | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [recommend2fa, setRecommend2fa] = useState(false);

  const signOut = useCallback(() => {
    session.clear();
    setMe(null);
    setStage('signed-out');
  }, []);

  const enter = useCallback(async () => {
    const user = await api<Me>('/me');
    if (user.role === 'client') {
      session.clear();
      throw new ApiError(403, 'NOT_STAFF', 'This login has no back-office access.');
    }
    setMe(user);
    if (user.totp_enabled) {
      setRecommend2fa(false);
      setStage('ready');
      return;
    }
    // Ask the server whether 2FA is mandatory for staff (it is unless ADMIN_REQUIRE_2FA=false).
    try {
      await api('/admin/overview');
      setRecommend2fa(true);
      setStage('ready');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'TWO_FACTOR_REQUIRED') setStage('setup-2fa');
      else {
        setRecommend2fa(true);
        setStage('ready');
      }
    }
  }, []);

  useEffect(() => {
    session.onSignedOut(signOut);
    (async () => {
      if (session.refresh && (await refreshSession())) {
        try {
          await enter();
          return;
        } catch {
          /* fall through */
        }
      }
      setStage('signed-out');
    })();
  }, [enter, signOut]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<TokenPair | { mfa_required: true; mfa_token: string }>('/auth/login', { body: { email, password }, auth: false });
      if ('mfa_required' in res) {
        setMfaToken(res.mfa_token);
        setStage('mfa');
        return;
      }
      session.set(res);
      await enter();
    },
    [enter],
  );

  const verify = useCallback(
    async (code: string) => {
      if (!mfaToken) throw new ApiError(401, 'MFA_EXPIRED', 'Please sign in again.');
      const pair = await api<TokenPair>('/auth/login/2fa', { body: { mfa_token: mfaToken, code }, auth: false });
      session.set(pair);
      setMfaToken(null);
      await enter();
    },
    [mfaToken, enter],
  );

  const logout = useCallback(async () => {
    const rt = session.refresh;
    if (rt) await api('/auth/logout', { body: { refresh_token: rt }, auth: false }).catch(() => undefined);
    signOut();
  }, [signOut]);

  const refreshMe = useCallback(async () => {
    await enter();
  }, [enter]);

  const value = useMemo<AuthState>(
    () => ({
      stage,
      me,
      recommend2fa,
      login,
      verify,
      logout,
      refreshMe,
      can: (perm) => !!me?.permissions.includes(perm),
    }),
    [stage, me, recommend2fa, login, verify, logout, refreshMe],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
