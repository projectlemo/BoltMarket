import clsx from 'clsx';
import { FaAndroid, FaApple, FaWindows } from 'react-icons/fa6';
import { LuArrowUpRight, LuCheck, LuGlobe, LuMinus, LuSmartphone } from 'react-icons/lu';
import type { IconType } from 'react-icons';
import { site } from '../../config/site';
import { useL } from '../../i18n';

interface DownloadItem {
  id: string;
  icon: IconType;
  label: { en: string; ar: string };
  sub: { en: string; ar: string };
  href: string;
}

export const downloads: DownloadItem[] = [
  { id: 'windows', icon: FaWindows, label: { en: 'Windows', ar: 'ويندوز' }, sub: { en: 'Desktop installer', ar: 'برنامج سطح المكتب' }, href: site.mt5.downloads.windows },
  { id: 'mac', icon: FaApple, label: { en: 'macOS', ar: 'ماك' }, sub: { en: 'Desktop app', ar: 'تطبيق سطح المكتب' }, href: site.mt5.downloads.mac },
  { id: 'ios', icon: LuSmartphone, label: { en: 'iPhone & iPad', ar: 'آيفون وآيباد' }, sub: { en: 'App Store', ar: 'متجر App Store' }, href: site.mt5.downloads.ios },
  { id: 'android', icon: FaAndroid, label: { en: 'Android', ar: 'أندرويد' }, sub: { en: 'Google Play', ar: 'متجر Google Play' }, href: site.mt5.downloads.android },
  { id: 'web', icon: LuGlobe, label: { en: 'Web browser', ar: 'متصفح الويب' }, sub: { en: 'No download', ar: 'دون تنزيل' }, href: site.mt5.downloads.web },
];

export function PlatformDownloads({ only, className }: { only?: string[]; className?: string }) {
  const L = useL();
  const items = only ? downloads.filter((d) => only.includes(d.id)) : downloads;
  return (
    <ul className={clsx('grid gap-3 sm:grid-cols-2 lg:grid-cols-5', className)}>
      {items.map((d) => {
        const Icon = d.icon;
        return (
          <li key={d.id}>
            <a
              href={d.href}
              target="_blank"
              rel="noopener noreferrer"
              className="glass glass-hover group flex h-full items-center gap-4 p-4"
              aria-label={`${L({ en: 'MetaTrader 5 for', ar: 'ميتاتريدر 5 لـ' })} ${L(d.label)} (${L({ en: 'opens in a new tab', ar: 'يفتح في علامة تبويب جديدة' })})`}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-fg transition group-hover:bg-bolt group-hover:text-bolt-ink">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold text-fg">{L(d.label)}</span>
                <span className="text-xs text-fg-subtle">{L(d.sub)}</span>
              </span>
              <LuArrowUpRight className="h-4 w-4 shrink-0 text-fg-subtle transition group-hover:text-bolt rtl:-scale-x-100" aria-hidden="true" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

type Cell = boolean | { en: string; ar: string };

const platformCols = [
  { en: 'MT5 Desktop', ar: 'ميتاتريدر 5 لسطح المكتب' },
  { en: 'MT5 Web', ar: 'ميتاتريدر 5 للويب' },
  { en: 'MT5 Mobile', ar: 'ميتاتريدر 5 للجوال' },
  { en: 'TradingView', ar: 'TradingView' },
];

const platformRows: { label: { en: string; ar: string }; cells: Cell[] }[] = [
  { label: { en: 'Trade your Bolt Markets account', ar: 'التداول على حسابك في Bolt Markets' }, cells: [true, true, true, false] },
  { label: { en: 'Nothing to install', ar: 'لا يحتاج إلى تثبيت' }, cells: [false, true, false, true] },
  { label: { en: 'One-click trading', ar: 'التداول بنقرة واحدة' }, cells: [true, true, true, false] },
  { label: { en: 'Automated trading (Expert Advisors)', ar: 'التداول الآلي (المستشارون الخبراء)' }, cells: [true, false, false, false] },
  {
    label: { en: 'Custom indicators and scripts', ar: 'مؤشرات ونصوص برمجية مخصّصة' },
    cells: [{ en: 'MQL5', ar: 'MQL5' }, false, false, { en: 'Pine Script', ar: 'Pine Script' }],
  },
  {
    label: { en: 'Runs on', ar: 'يعمل على' },
    cells: [
      { en: 'Windows, macOS', ar: 'ويندوز وماك' },
      { en: 'Any modern browser', ar: 'أي متصفح حديث' },
      { en: 'iOS, Android', ar: 'iOS وأندرويد' },
      { en: 'Any modern browser', ar: 'أي متصفح حديث' },
    ],
  },
  {
    label: { en: 'Best for', ar: 'الأنسب لـ' },
    cells: [
      { en: 'Deep analysis and automation', ar: 'التحليل المعمّق والأتمتة' },
      { en: 'Trading from any computer', ar: 'التداول من أي جهاز كمبيوتر' },
      { en: 'Managing trades on the go', ar: 'إدارة الصفقات أثناء التنقل' },
      { en: 'Charting and idea research', ar: 'الرسوم البيانية وبحث الأفكار' },
    ],
  },
];

export function PlatformComparison() {
  const L = useL();
  return (
    <div className="glass overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <caption className="sr-only">{L({ en: 'Platform comparison', ar: 'مقارنة المنصات' })}</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="w-[28%] px-5 py-4 text-start text-xs font-semibold tracking-wide text-fg-subtle uppercase">
                {L({ en: 'Feature', ar: 'الميزة' })}
              </th>
              {platformCols.map((c, i) => (
                <th key={c.en} scope="col" className={clsx('px-4 py-4 text-center font-display text-[0.95rem] font-bold', i === 0 && 'text-bolt')}>
                  {L(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {platformRows.map((row) => (
              <tr key={row.label.en} className="border-b border-line/60 last:border-0">
                <th scope="row" className="px-5 py-3.5 text-start font-medium text-fg-muted">
                  {L(row.label)}
                </th>
                {row.cells.map((cell, i) => (
                  <td key={i} className="px-4 py-3.5 text-center">
                    {cell === true ? (
                      <LuCheck className="mx-auto h-5 w-5 text-up" aria-label={L({ en: 'Yes', ar: 'نعم' })} />
                    ) : cell === false ? (
                      <LuMinus className="mx-auto h-5 w-5 text-fg-subtle/70" aria-label={L({ en: 'No', ar: 'لا' })} />
                    ) : (
                      <span className="text-fg">{L(cell)}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-5 py-3 text-xs text-fg-subtle">
        {L({
          en: 'TradingView is used for charting and analysis; orders are placed on MetaTrader 5.',
          ar: 'يُستخدم TradingView للرسوم البيانية والتحليل، بينما تُنفَّذ الأوامر على ميتاتريدر 5.',
        })}
      </p>
    </div>
  );
}
