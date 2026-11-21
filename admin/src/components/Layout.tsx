import clsx from 'clsx';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import {
  LuBookOpen,
  LuChartCandlestick,
  LuFileSearch,
  LuGauge,
  LuInbox,
  LuLifeBuoy,
  LuLogOut,
  LuMenu,
  LuReceipt,
  LuServer,
  LuShieldCheck,
  LuTrophy,
  LuUsers,
  LuX,
} from 'react-icons/lu';
import { useAuth } from '../lib/auth';
import { useLocation } from '../lib/router';
import type { Permission } from '../lib/types';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  perm: Permission;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: LuGauge, perm: 'users.read' },
  { to: '/clients', label: 'Clients', icon: LuUsers, perm: 'users.read' },
  { to: '/kyc', label: 'Verification', icon: LuShieldCheck, perm: 'kyc' },
  { to: '/transactions', label: 'Money desk', icon: LuReceipt, perm: 'finance' },
  { to: '/accounts', label: 'MT5 accounts', icon: LuChartCandlestick, perm: 'finance' },
  { to: '/challenges', label: 'Bolt Funded', icon: LuTrophy, perm: 'finance' },
  { to: '/tickets', label: 'Tickets', icon: LuLifeBuoy, perm: 'support' },
  { to: '/messages', label: 'Messages', icon: LuInbox, perm: 'support' },
  { to: '/posts', label: 'Blog', icon: LuBookOpen, perm: 'content' },
  { to: '/audit', label: 'Audit log', icon: LuFileSearch, perm: 'audit' },
  { to: '/system', label: 'System', icon: LuServer, perm: 'system' },
];

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-bolt text-bolt-ink" aria-hidden>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M13.5 2 4.5 13.5h6L9.5 22l9-11.5h-6L13.5 2Z" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block font-display text-base font-extrabold">Bolt Markets</span>
        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">Back office</span>
      </span>
    </span>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { me, can, logout, recommend2fa } = useAuth();
  const { path } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const items = NAV.filter((n) => can(n.perm));
  const active = (to: string) => (to === '/' ? path === '/' : path === to || path.startsWith(`${to}/`));

  const nav = (
    <nav aria-label="Back office" className="flex flex-1 flex-col gap-1 p-3">
      {items.map(({ to, label, icon: Icon }) => (
        <a
          key={to}
          href={`#${to}`}
          aria-current={active(to) ? 'page' : undefined}
          className={clsx(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
            active(to) ? 'bg-bolt/12 text-bolt' : 'text-fg-muted hover:bg-white/5 hover:text-fg',
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
          {label}
        </a>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-line p-3">
      <a href="#/profile" className={clsx('block rounded-xl px-3 py-2.5 hover:bg-white/5', path === '/profile' && 'bg-white/5')}>
        <span className="block truncate text-sm font-semibold">{me?.full_name}</span>
        <span className="block truncate text-xs text-fg-subtle">
          {me?.email} · {me?.role}
        </span>
      </a>
      <button type="button" onClick={() => void logout()} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-fg-muted hover:bg-white/5 hover:text-fg">
        <LuLogOut className="h-[18px] w-[18px]" />
        Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="sr-only z-50 rounded-lg bg-bolt font-semibold text-bolt-ink focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:px-4 focus:py-2">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-line bg-surface lg:flex">
        <div className="border-b border-line px-5 py-4">
          <Logo />
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto">{nav}</div>
        {footer}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-ink/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-white/5" aria-label="Open menu" aria-expanded={open}>
          <LuMenu className="h-6 w-6" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="absolute inset-y-0 start-0 flex w-72 flex-col border-e border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <Logo />
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-white/5" aria-label="Close menu">
                <LuX className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-1 flex-col overflow-y-auto">{nav}</div>
            {footer}
          </div>
        </div>
      )}

      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {recommend2fa && (
          <div className="mb-6 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
            Two-factor authentication is off for your login. <a href="#/profile" className="font-semibold underline">Turn it on</a> to protect client data.
          </div>
        )}
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
