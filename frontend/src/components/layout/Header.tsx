import clsx from 'clsx';
import { useEffect, useId, useRef, useState } from 'react';
import { LuChevronDown, LuGlobe, LuMenu, LuX, LuLayoutDashboard } from 'react-icons/lu';
import { Link, isActivePath, useRouter } from '../../router';
import { useT } from '../../i18n';
import { useAuth } from '../../lib/auth';
import { Logo } from '../ui/Brand';
import { ButtonLink } from '../ui/Button';
import { NAV, type NavGroup } from './nav';

export function LangSwitch({ className, full = false }: { className?: string; full?: boolean }) {
  const { state } = useRouter();
  const t = useT();
  const other = state.lang === 'en' ? 'ar' : 'en';
  const target = state.match.route.path === '*' ? '/' : state.path + state.search;
  return (
    <Link
      to={target}
      lang={other}
      hrefLang={other}
      className={clsx(
        'inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-fg-muted transition hover:bg-white/[0.06] hover:text-fg',
        className,
      )}
      aria-label={`${t.a11y.switchLang}: ${t.langName[other]}`}
    >
      <LuGlobe className="h-4 w-4" aria-hidden="true" />
      <span lang={other}>{full ? t.langName[other] : other === 'ar' ? 'عربي' : 'EN'}</span>
    </Link>
  );
}

function Dropdown({ group, open, onOpen, onClose }: { group: NavGroup; open: boolean; onOpen: () => void; onClose: () => void }) {
  const t = useT();
  const { state } = useRouter();
  const panelId = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = group.items?.some((i) => isActivePath(state.path, i.to)) ?? false;
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  return (
    <div
      className="relative"
      onMouseEnter={() => {
        clear();
        timer.current = setTimeout(onOpen, 80);
      }}
      onMouseLeave={() => {
        clear();
        timer.current = setTimeout(onClose, 140);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? onClose() : onOpen())}
        className={clsx(
          'inline-flex h-9 items-center gap-1 rounded-xl px-3 text-[0.94rem] font-medium transition',
          open || active ? 'text-fg' : 'text-fg-muted hover:text-fg',
          open && 'bg-white/[0.06]',
        )}
      >
        {group.label(t)}
        <LuChevronDown className={clsx('h-4 w-4 transition', open && 'rotate-180')} aria-hidden="true" />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className={clsx(
          'absolute top-full z-50 pt-3',
          (group.items?.length ?? 0) > 3 ? 'start-1/2 w-[min(34rem,90vw)] -translate-x-1/2 rtl:translate-x-1/2' : 'end-0 w-80',
        )}
      >
        <div className={clsx('glass glass-blur grid gap-1 p-2', (group.items?.length ?? 0) > 3 && 'sm:grid-cols-2')}>
          {group.items?.map((item) => {
            const [title, desc] = item.text(t);
            const Icon = item.icon;
            const here = isActivePath(state.path, item.to, true);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                aria-current={here ? 'page' : undefined}
                className={clsx('group flex gap-3 rounded-xl p-3 transition hover:bg-white/[0.06]', here && 'bg-white/[0.05]')}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-fg-muted transition group-hover:border-bolt/40 group-hover:text-bolt">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-fg">{title}</span>
                  <span className="text-xs leading-snug text-fg-subtle">{desc}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { status } = useAuth();
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div id="mobile-menu" className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto border-t border-line bg-ink/98 backdrop-blur-xl lg:hidden">
      <nav aria-label={t.a11y.mainNav} className="container-x flex flex-col gap-1 py-4">
        {NAV.map((g) =>
          g.items ? (
            <details key={g.id} className="group rounded-2xl border border-line/70 open:bg-white/[0.02]">
              <summary className="flex items-center justify-between px-4 py-3.5 text-base font-semibold text-fg">
                {g.label(t)}
                <LuChevronDown className="h-5 w-5 text-fg-subtle transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="flex flex-col gap-0.5 px-2 pb-2">
                {g.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.to} to={item.to} onClick={onClose} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-fg-muted hover:bg-white/5 hover:text-fg">
                      <Icon className="h-4.5 w-4.5 text-bolt" aria-hidden="true" />
                      <span className="text-[0.95rem]">{item.text(t)[0]}</span>
                    </Link>
                  );
                })}
              </div>
            </details>
          ) : (
            <Link key={g.id} to={g.to!} onClick={onClose} className="rounded-2xl border border-line/70 px-4 py-3.5 text-base font-semibold text-fg">
              {g.label(t)}
            </Link>
          ),
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {status === 'authenticated' ? (
            <ButtonLink to="/portal" className="col-span-2" onClick={onClose}>
              {t.common.portal}
            </ButtonLink>
          ) : (
            <>
              <ButtonLink to="/login" variant="secondary" onClick={onClose}>
                {t.common.login}
              </ButtonLink>
              <ButtonLink to="/register" onClick={onClose}>
                {t.common.createAccount}
              </ButtonLink>
            </>
          )}
        </div>
        <LangSwitch full className="mt-2 self-center" />
      </nav>
    </div>
  );
}

export function Header() {
  const t = useT();
  const { state } = useRouter();
  const { status } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpenId(null);
    setMobile(false);
  }, [state.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!openId) return;
    const onDown = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenId(null);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openId]);

  return (
    <header
      className={clsx(
        'sticky top-0 z-50 border-b transition-colors duration-300',
        scrolled || mobile ? 'border-line/80 bg-ink/85 backdrop-blur-xl' : 'border-transparent bg-ink/40 backdrop-blur-md',
      )}
    >
      <a
        href="#main"
        className="sr-only z-[60] rounded-lg bg-bolt font-semibold text-bolt-ink focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:px-4 focus:py-2"
      >
        {t.a11y.skip}
      </a>
      <div className="container-x flex h-16 items-center gap-4 lg:gap-6">
        <Link to="/" aria-label={t.a11y.home} className="shrink-0 rounded-lg">
          <Logo />
        </Link>
        <div ref={navRef} className="hidden lg:block">
          <nav aria-label={t.a11y.mainNav} className="flex items-center gap-0.5">
            {NAV.map((g) =>
              g.items ? (
                <Dropdown key={g.id} group={g} open={openId === g.id} onOpen={() => setOpenId(g.id)} onClose={() => setOpenId((cur) => (cur === g.id ? null : cur))} />
              ) : (
                <Link
                  key={g.id}
                  to={g.to!}
                  aria-current={isActivePath(state.path, g.to!) ? 'page' : undefined}
                  className={clsx(
                    'inline-flex h-9 items-center rounded-xl px-3 text-[0.94rem] font-medium transition hover:text-fg',
                    isActivePath(state.path, g.to!) ? 'text-fg' : 'text-fg-muted',
                  )}
                >
                  {g.label(t)}
                </Link>
              ),
            )}
          </nav>
        </div>
        <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
          <LangSwitch className="max-sm:hidden" />
          {status === 'authenticated' ? (
            <ButtonLink to="/portal" size="sm">
              <LuLayoutDashboard className="h-4 w-4" aria-hidden="true" />
              {t.common.portal}
            </ButtonLink>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost" size="sm" className="max-sm:hidden">
                {t.common.login}
              </ButtonLink>
              <ButtonLink to="/register" size="sm">
                {t.common.createAccount}
              </ButtonLink>
            </>
          )}
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-xl text-fg hover:bg-white/[0.06] lg:hidden"
            aria-expanded={mobile}
            aria-controls="mobile-menu"
            aria-label={mobile ? t.a11y.closeMenu : t.a11y.openMenu}
            onClick={() => setMobile((v) => !v)}
          >
            {mobile ? <LuX className="h-6 w-6" /> : <LuMenu className="h-6 w-6" />}
          </button>
        </div>
      </div>
      <MobileMenu open={mobile} onClose={() => setMobile(false)} />
    </header>
  );
}
