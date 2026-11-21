import type { IconType } from 'react-icons';
import {
  LuAppWindow,
  LuArrowLeftRight,
  LuBitcoin,
  LuBuilding2,
  LuCalculator,
  LuCalendarDays,
  LuChartArea,
  LuChartColumn,
  LuGauge,
  LuGem,
  LuGlobe,
  LuLayers,
  LuLifeBuoy,
  LuMail,
  LuMonitor,
  LuPercent,
  LuPlay,
  LuSmartphone,
  LuTrendingUp,
} from 'react-icons/lu';
import type { Dict } from '../../i18n';

export interface NavLeaf {
  to: string;
  icon: IconType;
  text: (t: Dict) => string[];
}

export interface NavGroup {
  id: string;
  label: (t: Dict) => string;
  to?: string;
  items?: NavLeaf[];
}

export const NAV: NavGroup[] = [
  {
    id: 'trading',
    label: (t) => t.nav.trading.label,
    items: [
      { to: '/trading/metatrader-5', icon: LuMonitor, text: (t) => t.nav.trading.mt5 },
      { to: '/trading/web-trader', icon: LuAppWindow, text: (t) => t.nav.trading.web },
      { to: '/trading/mobile', icon: LuSmartphone, text: (t) => t.nav.trading.mobile },
      { to: '/trading/demo-account', icon: LuPlay, text: (t) => t.nav.trading.demo },
      { to: '/trading/tradingview', icon: LuChartArea, text: (t) => t.nav.trading.tradingview },
      { to: '/trading/accounts', icon: LuLayers, text: (t) => t.nav.trading.accounts },
    ],
  },
  {
    id: 'markets',
    label: (t) => t.nav.markets.label,
    items: [
      { to: '/markets', icon: LuGlobe, text: (t) => t.nav.markets.all },
      { to: '/markets/forex', icon: LuArrowLeftRight, text: (t) => t.nav.markets.forex },
      { to: '/markets/indices', icon: LuChartColumn, text: (t) => t.nav.markets.indices },
      { to: '/markets/crypto', icon: LuBitcoin, text: (t) => t.nav.markets.crypto },
      { to: '/markets/commodities', icon: LuGem, text: (t) => t.nav.markets.commodities },
    ],
  },
  { id: 'funded', label: (t) => t.nav.funded.label, to: '/funded' },
  {
    id: 'tools',
    label: (t) => t.nav.tools.label,
    items: [
      { to: '/tools/lot-size-calculator', icon: LuCalculator, text: (t) => t.nav.tools.lot },
      { to: '/tools/pip-calculator', icon: LuPercent, text: (t) => t.nav.tools.pip },
      { to: '/tools/margin-calculator', icon: LuGauge, text: (t) => t.nav.tools.margin },
      { to: '/tools/profit-calculator', icon: LuTrendingUp, text: (t) => t.nav.tools.profit },
      { to: '/tools/economic-calendar', icon: LuCalendarDays, text: (t) => t.nav.tools.calendar },
    ],
  },
  { id: 'news', label: (t) => t.nav.news.label, to: '/news' },
  { id: 'learn', label: (t) => t.nav.learn.label, to: '/learn' },
  {
    id: 'company',
    label: (t) => t.nav.company.label,
    items: [
      { to: '/company/about', icon: LuBuilding2, text: (t) => t.nav.company.about },
      { to: '/company/contact', icon: LuMail, text: (t) => t.nav.company.contact },
      { to: '/help', icon: LuLifeBuoy, text: (t) => t.nav.company.help },
    ],
  },
];
