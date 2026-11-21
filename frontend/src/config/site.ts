/**
 * Central, environment-driven site configuration.
 *
 * Anything that depends on business or legal details that have not been supplied
 * yet (company registration, regulator, support channels, social links, MT5 server
 * names…) is read from VITE_* build variables. When a value is empty, the UI that
 * depends on it is switched off instead of showing invented information.
 * See frontend/.env.example for the full list.
 */
const env = import.meta.env;

const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const list = (v: unknown): string[] =>
  s(v)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
const bool = (v: unknown, fallback = false): boolean => {
  const t = s(v).toLowerCase();
  if (!t) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(t);
};

export type RegulatoryStatus = '' | 'regulated' | 'unregulated';
export type LiveChatProvider = '' | 'crisp' | 'tawk' | 'intercom';

export const site = {
  brand: 'Bolt Markets',
  shortBrand: 'Bolt',
  /** Absolute public URL including any base path, without trailing slash. */
  url: s(env.VITE_SITE_URL).replace(/\/+$/, ''),
  /** Bolt Markets API base URL (backend/). Empty = client portal runs in "API not configured" mode. */
  apiUrl: s(env.VITE_API_URL).replace(/\/+$/, ''),
  company: {
    legalName: s(env.VITE_COMPANY_LEGAL_NAME),
    registrationNumber: s(env.VITE_COMPANY_REG_NUMBER),
    address: s(env.VITE_COMPANY_ADDRESS),
    regulatoryStatus: s(env.VITE_REGULATORY_STATUS).toLowerCase() as RegulatoryStatus,
    regulator: s(env.VITE_REGULATOR_NAME),
    licenseNumber: s(env.VITE_LICENSE_NUMBER),
    jurisdiction: s(env.VITE_JURISDICTION),
    governingLaw: s(env.VITE_GOVERNING_LAW),
  },
  /** ISO 3166-1 alpha-2 codes, e.g. "US,CA,KP". Shown in the footer and blocked at sign-up. */
  restrictedCountries: list(env.VITE_RESTRICTED_COUNTRIES).map((c) => c.toUpperCase()),
  support: {
    email: s(env.VITE_SUPPORT_EMAIL),
    phone: s(env.VITE_SUPPORT_PHONE),
    whatsapp: s(env.VITE_SUPPORT_WHATSAPP).replace(/[^\d]/g, ''),
    liveChatProvider: s(env.VITE_LIVE_CHAT_PROVIDER).toLowerCase() as LiveChatProvider,
    liveChatId: s(env.VITE_LIVE_CHAT_ID),
  },
  social: {
    x: s(env.VITE_SOCIAL_X),
    instagram: s(env.VITE_SOCIAL_INSTAGRAM),
    youtube: s(env.VITE_SOCIAL_YOUTUBE),
    discord: s(env.VITE_SOCIAL_DISCORD),
  },
  mt5: {
    liveServer: s(env.VITE_MT5_SERVER_LIVE),
    demoServer: s(env.VITE_MT5_SERVER_DEMO),
    // Official MetaQuotes installers. Your white-label provider can give you branded
    // installers that pre-select your server: set the VITE_MT5_DOWNLOAD_* variables.
    downloads: {
      windows: s(env.VITE_MT5_DOWNLOAD_WINDOWS) || 'https://download.terminal.free/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe',
      mac: s(env.VITE_MT5_DOWNLOAD_MAC) || 'https://download.terminal.free/cdn/web/metaquotes.software.corp/mt5/MetaTrader5.pkg.zip',
      ios: s(env.VITE_MT5_DOWNLOAD_IOS) || 'https://apps.apple.com/app/metatrader-5/id413251709',
      android: s(env.VITE_MT5_DOWNLOAD_ANDROID) || 'https://play.google.com/store/apps/details?id=net.metaquotes.metatrader5',
      web: s(env.VITE_MT5_WEB_TERMINAL) || 'https://web.metatrader.app/terminal',
    },
    /** Broker-specific WebTerminal URL to embed in an iframe (from your MT5 white-label provider). */
    webTerminalEmbed: s(env.VITE_MT5_WEB_TERMINAL_EMBED),
  },
  features: {
    /** Animated, clearly-labelled simulated prices for design review only. Never enable in production. */
    demoPrices: bool(env.VITE_DEMO_PRICES),
    economicCalendar: bool(env.VITE_ECONOMIC_CALENDAR, true),
    tradingViewWidgets: bool(env.VITE_TRADINGVIEW_WIDGETS, true),
    /** Set to true once a lawyer has approved the legal documents; removes the draft banner. */
    legalReviewed: bool(env.VITE_LEGAL_REVIEWED),
  },
} as const;

export const companyConfigured = Boolean(site.company.legalName && site.company.registrationNumber);

export const regulatoryConfigured =
  site.company.regulatoryStatus === 'regulated'
    ? Boolean(site.company.regulator && site.company.licenseNumber)
    : site.company.regulatoryStatus === 'unregulated'
      ? Boolean(site.company.jurisdiction)
      : false;

/**
 * URL for the embedded MT5 WebTerminal, or '' when it cannot be embedded yet.
 * Uses the broker-specific terminal if provided, otherwise MetaQuotes' iframe widget
 * pre-configured with your server names.
 */
export function webTerminalEmbedUrl(lang: 'en' | 'ar'): string {
  const { webTerminalEmbed, liveServer, demoServer } = site.mt5;
  if (webTerminalEmbed) return webTerminalEmbed;
  if (!liveServer) return '';
  const servers = [liveServer, demoServer].filter(Boolean).join(',');
  const q = new URLSearchParams({ servers, trade_server: liveServer, startup_mode: 'open_trade', lang, save_password: 'off' });
  return `https://metatraderweb.app/trade?${q.toString()}`;
}

export const supportChannelsConfigured = Boolean(
  site.support.email || site.support.phone || site.support.whatsapp || (site.support.liveChatProvider && site.support.liveChatId),
);

export const socialLinks = (
  [
    ['x', site.social.x],
    ['instagram', site.social.instagram],
    ['youtube', site.social.youtube],
    ['discord', site.social.discord],
  ] as const
).filter(([, url]) => Boolean(url));
