import type { ComponentType } from 'react';

export interface PageProps {
  params: Record<string, string>;
  /** Result of the route loader (resolved before render, on the server and the client). */
  data?: unknown;
}

export interface LoaderContext {
  params: Record<string, string>;
  lang: 'en' | 'ar';
}

export type Layout = 'site' | 'auth' | 'portal';

type PageModule = { default: ComponentType<PageProps> };

export interface RouteDef {
  path: string;
  layout: Layout;
  load: () => Promise<PageModule>;
  /** Static props merged into `params` (lets one page module serve several URLs). */
  props?: Record<string, string>;
  /** Concrete paths to prerender for a dynamic route. */
  staticPaths?: () => Promise<string[]>;
  /** Client-only route: prerendered as a shell, never indexed. */
  private?: boolean;
  /** Data needed for the first render (e.g. an article body). */
  loader?: (ctx: LoaderContext) => Promise<unknown>;
}

const r = (path: string, load: () => Promise<PageModule>, extra: Partial<RouteDef> = {}): RouteDef => ({
  path,
  load,
  layout: 'site',
  ...extra,
});

const market = () => import('./pages/markets/MarketPage');
const calculator = () => import('./pages/tools/CalculatorPage');
const legalPage = () => import('./pages/legal/LegalPage');
const legal = (doc: string) => ({
  props: { doc },
  loader: (ctx: LoaderContext) => import('./content/legal').then((m) => m.loadLegal(doc, ctx.lang)),
});
const portal = (load: () => Promise<PageModule>, path: string) => r(path, load, { layout: 'portal', private: true });
const auth = (load: () => Promise<PageModule>, path: string) => r(path, load, { layout: 'auth', private: true });

export const routes: RouteDef[] = [
  r('/', () => import('./pages/Home')),

  r('/trading/metatrader-5', () => import('./pages/trading/MetaTrader5')),
  r('/trading/web-trader', () => import('./pages/trading/WebTrader')),
  r('/trading/mobile', () => import('./pages/trading/MobileApp')),
  r('/trading/demo-account', () => import('./pages/trading/DemoAccount')),
  r('/trading/tradingview', () => import('./pages/trading/TradingViewPage')),
  r('/trading/accounts', () => import('./pages/trading/TradingAccounts')),

  r('/markets', () => import('./pages/markets/MarketsHub')),
  r('/markets/forex', market, { props: { market: 'forex' } }),
  r('/markets/indices', market, { props: { market: 'indices' } }),
  r('/markets/crypto', market, { props: { market: 'crypto' } }),
  r('/markets/commodities', market, { props: { market: 'commodities' } }),

  r('/funded', () => import('./pages/Funded')),

  r('/tools', () => import('./pages/tools/ToolsHub')),
  r('/tools/lot-size-calculator', calculator, { props: { tool: 'lot' } }),
  r('/tools/pip-calculator', calculator, { props: { tool: 'pip' } }),
  r('/tools/margin-calculator', calculator, { props: { tool: 'margin' } }),
  r('/tools/profit-calculator', calculator, { props: { tool: 'profit' } }),
  r('/tools/economic-calendar', () => import('./pages/tools/EconomicCalendar')),

  r('/news', () => import('./pages/blog/BlogIndex'), { props: { section: 'news' } }),
  r('/learn', () => import('./pages/blog/BlogIndex'), { props: { section: 'learn' } }),
  r('/blog/:slug', () => import('./pages/blog/Article'), {
    staticPaths: () => import('./content/blog/loader').then((m) => m.allSlugs()).then((s) => s.map((slug) => `/blog/${slug}`)),
    loader: (ctx) => import('./content/blog/loader').then((m) => m.loadArticle(ctx.params.slug, ctx.lang)),
  }),

  r('/company/about', () => import('./pages/company/About')),
  r('/company/contact', () => import('./pages/company/Contact')),
  r('/help', () => import('./pages/company/HelpCenter')),

  r('/legal/privacy-policy', legalPage, legal('privacy')),
  r('/legal/risk-disclaimer', legalPage, legal('risk')),
  r('/legal/terms-and-conditions', legalPage, legal('terms')),
  r('/legal/client-agreement', legalPage, legal('client')),
  r('/legal/order-execution-policy', legalPage, legal('execution')),

  auth(() => import('./pages/auth/Login'), '/login'),
  auth(() => import('./pages/auth/Register'), '/register'),
  auth(() => import('./pages/auth/VerifyEmail'), '/verify-email'),
  auth(() => import('./pages/auth/ForgotPassword'), '/forgot-password'),
  auth(() => import('./pages/auth/ResetPassword'), '/reset-password'),

  portal(() => import('./pages/portal/Dashboard'), '/portal'),
  portal(() => import('./pages/portal/Accounts'), '/portal/accounts'),
  portal(() => import('./pages/portal/Deposit'), '/portal/deposit'),
  portal(() => import('./pages/portal/Withdraw'), '/portal/withdraw'),
  portal(() => import('./pages/portal/Transactions'), '/portal/transactions'),
  portal(() => import('./pages/portal/Verification'), '/portal/verification'),
  portal(() => import('./pages/portal/Partners'), '/portal/partners'),
  portal(() => import('./pages/portal/Support'), '/portal/support'),
  { ...portal(() => import('./pages/portal/Ticket'), '/portal/support/:id'), staticPaths: async () => [] },
  portal(() => import('./pages/portal/Settings'), '/portal/settings'),
  portal(() => import('./pages/portal/FundedChallenges'), '/portal/funded'),
];

export const notFoundRoute: RouteDef = r('*', () => import('./pages/NotFound'));
