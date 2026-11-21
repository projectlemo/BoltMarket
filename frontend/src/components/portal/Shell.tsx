import clsx from 'clsx';
import { useEffect, useState, type ReactNode } from 'react';
import {
  LuArrowDownToLine,
  LuArrowUpFromLine,
  LuBadgeCheck,
  LuHandshake,
  LuHistory,
  LuLayers,
  LuLayoutDashboard,
  LuLifeBuoy,
  LuLogOut,
  LuMenu,
  LuServerOff,
  LuSettings,
  LuTrophy,
} from 'react-icons/lu';
import type { IconType } from 'react-icons';
import { useL, useT } from '../../i18n';
import { apiConfigured } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Seo } from '../../lib/head';
import { Link, isActivePath, useNavigate, useRouter } from '../../router';
import { LangSwitch } from '../layout/Header';
import { LiveChat } from '../layout/SiteLayout';
import { BoltMark, Logo } from '../ui/Brand';
import { ButtonLink } from '../ui/Button';
import { Badge, Notice, Spinner } from '../ui/Feedback';
import { kycLabel } from './labels';

type LS = { en: string; ar: string };

const NAV: { to: string; icon: IconType; label: LS; exact?: boolean }[] = [
  { to: '/portal', icon: LuLayoutDashboard, label: { en: 'Dashboard', ar: 'لوحة التحكم' }, exact: true },
  { to: '/portal/accounts', icon: LuLayers, label: { en: 'MT5 accounts', ar: 'حسابات MT5' } },
  { to: '/portal/deposit', icon: LuArrowDownToLine, label: { en: 'Deposit', ar: 'إيداع' } },
  { to: '/portal/withdraw', icon: LuArrowUpFromLine, label: { en: 'Withdraw', ar: 'سحب' } },
  { to: '/portal/transactions', icon: LuHistory, label: { en: 'Transactions', ar: 'المعاملات' } },
  { to: '/portal/verification', icon: LuBadgeCheck, label: { en: 'Verification', ar: 'التحقق' } },
  { to: '/portal/funded', icon: LuTrophy, label: { en: 'Bolt Funded', ar: 'برنامج التمويل' } },
  { to: '/portal/partners', icon: LuHandshake, label: { en: 'Partners', ar: 'الشركاء' } },
  { to: '/portal/support', icon: LuLifeBuoy, label: { en: 'Support', ar: 'الدعم' } },
  { to: '/portal/settings', icon: LuSettings, label: { en: 'Settings', ar: 'الإعدادات' } },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const L = useL();
  const { state } = useRouter();
  return (
    <ul className="flex flex-col gap-1">
      {NAV.map((n) => {
        const active = isActivePath(state.path, n.to, n.exact);
        const Icon = n.icon;
        return (
          <li key={n.to}>
            <Link
              to={n.to}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                active ? 'bg-bolt text-bolt-ink shadow-[0_8px_24px_-12px_rgb(255_212_0/0.7)]' : 'text-fg-muted hover:bg-white/[0.06] hover:text-fg',
              )}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
              {L(n.label)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Layout for every authenticated client-portal page. */
export function PortalShell({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const L = useL();
  const t = useT();
  const { status, user, logout } = useAuth();
  const { state } = useRouter();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (apiConfigured && status === 'anonymous') {
      const next = state.path + state.search;
      navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true });
    }
  }, [status, navigate, state.path, state.search]);

  useEffect(() => setOpen(false), [state.pathname]);

  const seo = <Seo title={`${title} · ${L({ en: 'Client portal', ar: 'بوابة العملاء' })}`} noindex />;

  if (!apiConfigured) {
    return (
      <div className="grid min-h-dvh place-items-center px-5">
        {seo}
        <div className="glass flex max-w-md flex-col items-center gap-4 p-8 text-center">
          <LuServerOff className="h-10 w-10 text-warn" aria-hidden="true" />
          <h1 className="text-2xl font-bold">{L({ en: 'Client portal unavailable', ar: 'بوابة العملاء غير متاحة' })}</h1>
          <p className="text-fg-muted">
            {L({
              en: 'The client portal is not reachable right now. Please try again later or contact us.',
              ar: 'لا يمكن الوصول إلى بوابة العملاء حاليًا. يرجى المحاولة لاحقًا أو التواصل معنا.',
            })}
          </p>
          <div className="flex gap-3">
            <ButtonLink to="/">{L({ en: 'Back to website', ar: 'العودة إلى الموقع' })}</ButtonLink>
            <ButtonLink to="/company/contact" variant="secondary">
              {t.common.contactUs}
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  if (status !== 'authenticated' || !user) {
    return (
      <div className="grid min-h-dvh place-items-center">
        {seo}
        <Spinner label={t.common.loading} />
      </div>
    );
  }

  const kyc = kycLabel[user.kyc_status];
  const initials = user.full_name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link to="/" aria-label={t.a11y.home} className="px-2 pt-1">
        <Logo />
      </Link>
      <nav aria-label={L({ en: 'Portal navigation', ar: 'تنقل البوابة' })} className="flex-1 overflow-y-auto">
        <NavList onNavigate={() => setOpen(false)} />
      </nav>
      <div className="glass flex items-center gap-3 p-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-bolt/15 font-bold text-bolt">{initials}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{user.full_name}</span>
          <span className="block truncate text-xs text-fg-subtle" dir="ltr">
            {user.email}
          </span>
        </span>
        <button
          type="button"
          onClick={() => void logout()}
          className="grid h-9 w-9 place-items-center rounded-lg text-fg-subtle hover:bg-white/5 hover:text-fg"
          aria-label={t.common.logout}
          title={t.common.logout}
        >
          <LuLogOut className="h-4.5 w-4.5 rtl:-scale-x-100" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      {seo}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-e border-line bg-surface/60 lg:block">{sidebar}</aside>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={L({ en: 'Portal menu', ar: 'قائمة البوابة' })}>
          <button type="button" className="absolute inset-0 bg-black/70" aria-label={t.a11y.closeMenu} onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 w-72 max-w-[85vw] border-e border-line bg-ink">{sidebar}</div>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-ink/85 px-4 backdrop-blur-xl sm:px-6">
          <button type="button" className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white/5 lg:hidden" onClick={() => setOpen(true)} aria-label={t.a11y.openMenu}>
            <LuMenu className="h-5 w-5" />
          </button>
          <BoltMark className="h-7 w-7 lg:hidden" />
          <h1 className="truncate font-display text-lg font-bold sm:text-xl">{title}</h1>
          <div className="ms-auto flex items-center gap-2">
            <Badge tone={kyc.tone} className="max-sm:hidden">
              {L({ en: 'KYC', ar: 'التحقق' })}: {L(kyc.label)}
            </Badge>
            <LangSwitch />
            {actions}
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {user.kyc_status !== 'approved' && !state.path.startsWith('/portal/verification') ? (
            <Notice
              tone={user.kyc_status === 'rejected' ? 'down' : user.kyc_status === 'pending' ? 'info' : 'warn'}
              className="mb-6"
              title={
                user.kyc_status === 'pending'
                  ? L({ en: 'Your documents are being reviewed', ar: 'مستنداتك قيد المراجعة' })
                  : user.kyc_status === 'rejected'
                    ? L({ en: 'We need more information to verify you', ar: 'نحتاج إلى معلومات إضافية للتحقق منك' })
                    : L({ en: 'Verify your identity to deposit and withdraw', ar: 'تحقّق من هويتك لتتمكن من الإيداع والسحب' })
              }
              action={
                user.kyc_status !== 'pending' ? (
                  <ButtonLink to="/portal/verification" size="sm">
                    {L({ en: 'Go to verification', ar: 'انتقل إلى التحقق' })}
                  </ButtonLink>
                ) : undefined
              }
            />
          ) : null}
          {children}
        </main>
        <footer className="border-t border-line px-4 py-4 text-xs leading-relaxed text-fg-subtle sm:px-6 lg:px-8">{t.footer.risk}</footer>
      </div>
      <LiveChat />
    </div>
  );
}

/** Small stat card used across portal pages. */
export function Stat({ label, value, hint, icon }: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="glass flex flex-col gap-2 p-5">
      <span className="flex items-center justify-between text-sm text-fg-subtle">
        {label}
        {icon ? <span className="text-bolt [&>svg]:h-5 [&>svg]:w-5">{icon}</span> : null}
      </span>
      <span className="num font-display text-2xl font-extrabold sm:text-3xl" dir="ltr">
        {value}
      </span>
      {hint ? <span className="text-xs text-fg-subtle">{hint}</span> : null}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('glass flex flex-col', className)}>
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="font-display text-base font-bold">{title}</h2>
          {action}
        </header>
      ) : null}
      <div className="flex-1 p-5">{children}</div>
    </section>
  );
}

/** Hook for simple data loading with error/loading states. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload: () => setTick((x) => x + 1), setData };
}
