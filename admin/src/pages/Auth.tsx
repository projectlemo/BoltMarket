import { useState, type FormEvent, type ReactNode } from 'react';
import { Logo } from '../components/Layout';
import { Button, ErrorNote, QrCode, TextInput } from '../components/ui';
import { api, ApiError, apiConfigured } from '../lib/api';
import { useAuth } from '../lib/auth';

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="card p-6 sm:p-8">
          <h1 className="mb-6 text-xl font-extrabold">{title}</h1>
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-fg-subtle">Staff access only. Every action is recorded in the audit log.</p>
      </div>
    </main>
  );
}

export function LoginPage() {
  const { stage, login, verify } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (stage === 'mfa') await verify(code.trim());
      else await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!apiConfigured) {
    return (
      <Shell title="Back office not connected">
        <p className="text-sm text-fg-muted">
          This build has no API address. Rebuild the back office with <span className="kbd">VITE_API_URL</span> set to your Bolt Markets API, for example the Render
          URL of the backend service.
        </p>
      </Shell>
    );
  }

  return (
    <Shell title={stage === 'mfa' ? 'Two-factor code' : 'Sign in'}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {stage === 'mfa' ? (
          <TextInput
            label="6-digit code or recovery code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            inputMode="text"
            autoFocus
            required
          />
        ) : (
          <>
            <TextInput label="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus required />
            <TextInput label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </>
        )}
        <ErrorNote error={error} />
        <Button type="submit" variant="primary" busy={busy} className="w-full" disabled={stage === 'mfa' ? code.trim().length < 6 : !email || !password}>
          {stage === 'mfa' ? 'Verify' : 'Sign in'}
        </Button>
      </form>
    </Shell>
  );
}

/** Shown when the server requires 2FA for staff and this login has not turned it on yet. */
export function TwoFactorGate() {
  const { logout, refreshMe } = useAuth();
  return (
    <Shell title="Turn on two-factor authentication">
      <p className="mb-5 text-sm text-fg-muted">The back office holds identity documents and payment data, so staff logins must use an authenticator app.</p>
      <TwoFactorSetup onDone={() => void refreshMe()} />
      <button type="button" onClick={() => void logout()} className="mt-6 text-sm text-fg-subtle underline hover:text-fg">
        Sign out
      </button>
    </Shell>
  );
}

export function TwoFactorSetup({ onDone }: { onDone: () => void }) {
  const [setup, setSetup] = useState<{ secret: string; otpauth_url: string } | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      setSetup(await api<{ secret: string; otpauth_url: string }>('/me/2fa/setup', { method: 'POST' }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start the setup.');
    } finally {
      setBusy(false);
    }
  };

  const enable = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ recovery_codes: string[] }>('/me/2fa/enable', { body: { code: code.trim() } });
      setCodes(res.recovery_codes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That code did not work.');
    } finally {
      setBusy(false);
    }
  };

  if (codes) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-fg-muted">Two-factor authentication is on. Store these one-time recovery codes somewhere safe — each works once if you lose your phone.</p>
        <ul className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-ink p-4 font-mono text-sm">
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Button onClick={() => void navigator.clipboard?.writeText(codes.join('\n'))}>Copy codes</Button>
          <Button variant="primary" onClick={onDone}>
            I saved them
          </Button>
        </div>
      </div>
    );
  }

  if (!setup) {
    return (
      <div className="space-y-4">
        <ErrorNote error={error} />
        <Button variant="primary" busy={busy} onClick={() => void start()}>
          Set up authenticator
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={enable} className="space-y-4">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <QrCode value={setup.otpauth_url} size={160} />
        <ol className="list-decimal space-y-2 ps-5 text-sm text-fg-muted">
          <li>Scan the code with Google Authenticator, 1Password, Authy or similar.</li>
          <li>
            Or enter this key manually: <span className="kbd break-all">{setup.secret}</span>
          </li>
          <li>Type the 6-digit code it shows.</li>
        </ol>
      </div>
      <TextInput label="Code from the app" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={8} />
      <ErrorNote error={error} />
      <Button type="submit" variant="primary" busy={busy} disabled={code.trim().length < 6}>
        Turn on
      </Button>
    </form>
  );
}
