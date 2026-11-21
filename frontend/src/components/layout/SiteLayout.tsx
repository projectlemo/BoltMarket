import clsx from 'clsx';
import { useEffect, useState, type ReactNode } from 'react';
import { site } from '../../config/site';
import { useT } from '../../i18n';
import { useAuth } from '../../lib/auth';
import { BoltMark } from '../ui/Brand';
import { ButtonLink } from '../ui/Button';
import { Ticker } from '../market/Prices';
import { Footer } from './Footer';
import { Header } from './Header';

/** Mobile bottom bar that appears after the hero and hides near the footer. */
function StickyCta() {
  const t = useT();
  const { status } = useAuth();
  const [show, setShow] = useState(false);
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const footer = document.querySelector('footer');
      const nearFooter = footer ? footer.getBoundingClientRect().top < window.innerHeight - 40 : false;
      setShow(window.scrollY > 560 && !nearFooter);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  if (status === 'authenticated') return null;
  return (
    <div
      inert={!show}
      className={clsx(
        'fixed inset-x-3 bottom-3 z-40 transition duration-300 lg:hidden',
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-[160%] opacity-0',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="glass glass-blur flex items-center gap-3 rounded-2xl p-2 ps-3 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.9)]">
        <BoltMark className="h-8 w-8 shrink-0" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{t.sticky.text}</p>
        <ButtonLink to="/trading/demo-account" variant="ghost" size="sm" className="max-xs:hidden">
          {t.sticky.demo}
        </ButtonLink>
        <ButtonLink to="/register" size="sm">
          {t.sticky.cta}
        </ButtonLink>
      </div>
    </div>
  );
}

/** Loads the configured live-chat widget after the page is idle (protects Core Web Vitals). */
function LiveChat() {
  useEffect(() => {
    const { liveChatProvider: provider, liveChatId: id } = site.support;
    if (!provider || !id) return;
    const load = () => {
      const w = window as unknown as Record<string, unknown>;
      const s = document.createElement('script');
      s.async = true;
      if (provider === 'crisp') {
        w.$crisp = [];
        w.CRISP_WEBSITE_ID = id;
        s.src = 'https://client.crisp.chat/l.js';
      } else if (provider === 'tawk') {
        s.src = `https://embed.tawk.to/${id}`;
        s.charset = 'UTF-8';
        s.setAttribute('crossorigin', '*');
      } else if (provider === 'intercom') {
        w.intercomSettings = { app_id: id };
        s.src = `https://widget.intercom.io/widget/${id}`;
      } else return;
      document.body.appendChild(s);
    };
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const handle = idle ? idle(load, { timeout: 5000 }) : window.setTimeout(load, 3500);
    return () => {
      if (!idle) window.clearTimeout(handle);
    };
  }, []);
  return null;
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <Ticker />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <Footer />
      <StickyCta />
      <LiveChat />
    </div>
  );
}

export { LiveChat };
