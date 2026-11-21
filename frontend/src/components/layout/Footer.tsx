import { FaDiscord, FaInstagram, FaXTwitter, FaYoutube } from 'react-icons/fa6';
import type { IconType } from 'react-icons';
import { companyConfigured, regulatoryConfigured, site, socialLinks } from '../../config/site';
import { fmt, useT } from '../../i18n';
import { countryNamesFor } from '../../content/legal/countries';
import { Link, useLang } from '../../router';
import { Logo } from '../ui/Brand';
import { LangSwitch } from './Header';

const socialIcons: Record<string, IconType> = { x: FaXTwitter, instagram: FaInstagram, youtube: FaYoutube, discord: FaDiscord };

export function Footer() {
  const t = useT();
  const lang = useLang();
  const c = site.company;

  const cols: { title: string; links: [string, string][] }[] = [
    {
      title: t.footer.cols.trading,
      links: [
        ['/trading/metatrader-5', t.nav.trading.mt5[0]],
        ['/trading/web-trader', t.nav.trading.web[0]],
        ['/trading/mobile', t.nav.trading.mobile[0]],
        ['/trading/demo-account', t.nav.trading.demo[0]],
        ['/trading/tradingview', t.nav.trading.tradingview[0]],
        ['/trading/accounts', t.nav.trading.accounts[0]],
      ],
    },
    {
      title: t.footer.cols.markets,
      links: [
        ['/markets/forex', t.nav.markets.forex[0]],
        ['/markets/indices', t.nav.markets.indices[0]],
        ['/markets/crypto', t.nav.markets.crypto[0]],
        ['/markets/commodities', t.nav.markets.commodities[0]],
        ['/funded', t.nav.funded.label],
      ],
    },
    {
      title: t.footer.cols.tools,
      links: [
        ['/tools/lot-size-calculator', t.nav.tools.lot[0]],
        ['/tools/pip-calculator', t.nav.tools.pip[0]],
        ['/tools/margin-calculator', t.nav.tools.margin[0]],
        ['/tools/profit-calculator', t.nav.tools.profit[0]],
        ['/tools/economic-calendar', t.nav.tools.calendar[0]],
        ['/news', t.nav.news.label],
        ['/learn', t.nav.learn.label],
      ],
    },
    {
      title: t.footer.cols.company,
      links: [
        ['/company/about', t.nav.company.about[0]],
        ['/company/contact', t.nav.company.contact[0]],
        ['/help', t.nav.company.help[0]],
      ],
    },
    {
      title: t.footer.cols.legal,
      links: [
        ['/legal/privacy-policy', t.footer.legal.privacy],
        ['/legal/risk-disclaimer', t.footer.legal.risk],
        ['/legal/terms-and-conditions', t.footer.legal.terms],
        ['/legal/client-agreement', t.footer.legal.client],
        ['/legal/order-execution-policy', t.footer.legal.execution],
      ],
    },
  ];

  return (
    <footer className="relative mt-8 border-t border-line bg-[linear-gradient(180deg,#0d0d0d,#080808)]">
      <div className="container-x py-14">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_2.4fr]">
          <div className="flex flex-col items-start gap-4">
            <Link to="/" aria-label={t.a11y.home}>
              <Logo />
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-fg-muted">{t.footer.tagline}</p>
            {socialLinks.length ? (
              <ul className="flex gap-2" aria-label={t.footer.social}>
                {socialLinks.map(([id, url]) => {
                  const Icon = socialIcons[id];
                  return (
                    <li key={id}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={id === 'x' ? 'X' : id[0].toUpperCase() + id.slice(1)}
                        className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-fg-muted transition hover:border-bolt/40 hover:text-bolt"
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <LangSwitch full className="-ms-3" />
          </div>
          <nav aria-label={t.a11y.footerNav} className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {cols.map((col) => (
              <div key={col.title}>
                <h2 className="mb-3 font-sans text-xs font-semibold tracking-[0.12em] text-fg-subtle uppercase">{col.title}</h2>
                <ul className="flex flex-col gap-2.5">
                  {col.links.map(([to, label]) => (
                    <li key={to}>
                      <Link to={to} className="text-sm text-fg-muted transition hover:text-fg">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-5 border-t border-line pt-8 text-[0.8rem] leading-relaxed text-fg-subtle">
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
            <h2 className="mb-2 font-sans text-sm font-semibold text-fg-muted">{t.footer.riskTitle}</h2>
            <p>{t.footer.risk}</p>
          </div>
          {site.restrictedCountries.length ? (
            <p>
              <strong className="font-semibold text-fg-muted">{t.footer.restrictedTitle}: </strong>
              <span suppressHydrationWarning>
                {fmt(t.footer.restricted, { list: countryNamesFor(site.restrictedCountries, lang).join(lang === 'ar' ? '، ' : ', ') })}
              </span>
            </p>
          ) : null}
          {companyConfigured ? (
            <p>{fmt(t.footer.registered, { name: c.legalName, number: c.registrationNumber, address: c.address || '—' })}</p>
          ) : null}
          {regulatoryConfigured ? (
            <p>
              {c.regulatoryStatus === 'regulated'
                ? fmt(t.footer.regulated, { regulator: c.regulator, license: c.licenseNumber })
                : fmt(t.footer.unregulated, { name: c.legalName || site.brand, jurisdiction: c.jurisdiction })}
            </p>
          ) : null}
          <p>{t.footer.distribution}</p>
          <p className="text-fg-subtle" suppressHydrationWarning>
            © {new Date().getFullYear()} {site.brand}. {t.common.allRights}
          </p>
        </div>
      </div>
    </footer>
  );
}
