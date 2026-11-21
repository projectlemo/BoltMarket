import type { ReactNode } from 'react';
import { LuCheck } from 'react-icons/lu';
import { accountTypes } from '../../config/accounts';
import { useL, useT } from '../../i18n';
import { Link } from '../../router';
import { BoltLines, Logo } from '../ui/Brand';
import { LangSwitch } from './Header';

export function AuthLayout({ children }: { children: ReactNode }) {
  const t = useT();
  const L = useL();
  const lowest = Math.min(...accountTypes.map((a) => a.spreadFrom));
  const maxLev = Math.max(...accountTypes.map((a) => a.maxLeverage));
  const minDep = Math.min(...accountTypes.map((a) => a.minDeposit));
  const points = [
    L({ en: `Spreads from ${lowest.toFixed(1)} pips`, ar: `سبريد يبدأ من ${lowest.toFixed(1)} نقطة` }),
    L({ en: `Leverage up to 1:${maxLev}`, ar: `رافعة مالية حتى 1:${maxLev}` }),
    L({ en: `Start with $${minDep}`, ar: `ابدأ بإيداع ${minDep}$` }),
    L({ en: 'MetaTrader 5 on desktop, web and mobile', ar: 'ميتاتريدر 5 على سطح المكتب والويب والجوال' }),
  ];
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-e border-line bg-[radial-gradient(90%_70%_at_0%_0%,rgb(255_212_0/0.16),transparent_60%),linear-gradient(180deg,#121212,#0a0a0a)] p-10 lg:flex xl:p-14">
        <div className="bg-grid absolute inset-0 opacity-60" aria-hidden="true" />
        <BoltLines className="absolute inset-x-0 bottom-24 h-48 w-full opacity-80" />
        <Link to="/" aria-label={t.a11y.home} className="relative self-start">
          <Logo />
        </Link>
        <div className="relative flex max-w-md flex-col gap-6">
          <h2 className="text-4xl leading-tight font-extrabold">
            {L({ en: 'Fast markets.', ar: 'أسواق سريعة.' })}
            <br />
            <span className="text-bolt">{L({ en: 'Sharp pricing.', ar: 'تسعير دقيق.' })}</span>
          </h2>
          <ul className="flex flex-col gap-3">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-3 text-fg-muted">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-bolt/15 text-bolt">
                  <LuCheck className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative max-w-md text-xs leading-relaxed text-fg-subtle">{t.footer.risk}</p>
      </aside>
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-16 items-center justify-between px-5 sm:px-8">
          <Link to="/" aria-label={t.a11y.home} className="lg:invisible">
            <Logo />
          </Link>
          <LangSwitch />
        </header>
        <main id="main" className="flex flex-1 justify-center px-5 py-6 sm:items-center sm:px-8 sm:py-10">
          <div className="w-full max-w-[28rem]">{children}</div>
        </main>
        <footer className="flex flex-wrap justify-center gap-x-5 gap-y-2 px-5 pb-6 text-xs text-fg-subtle sm:px-8">
          <Link to="/legal/privacy-policy" className="hover:text-fg">
            {t.footer.legal.privacy}
          </Link>
          <Link to="/legal/terms-and-conditions" className="hover:text-fg">
            {t.footer.legal.terms}
          </Link>
          <Link to="/legal/risk-disclaimer" className="hover:text-fg">
            {t.footer.legal.risk}
          </Link>
          <Link to="/help" className="hover:text-fg">
            {t.common.helpCenter}
          </Link>
        </footer>
      </div>
    </div>
  );
}
