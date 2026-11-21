import { LuArrowDownToLine, LuArrowUpFromLine, LuDownload, LuLayers, LuPlus, LuWallet } from 'react-icons/lu';
import { useL } from '../../i18n';
import { useAuth } from '../../lib/auth';
import { formatDateTime } from '../../lib/format';
import { portal } from '../../lib/portal-api';
import { Link, toHref, useLang } from '../../router';
import { absoluteUrl } from '../../lib/head';
import { CopyButton, ErrorNote, StatusBadge, useMoney } from '../../components/portal/Bits';
import { accountStatusLabel, accountTypeName, txStatusLabel, txTypeLabel } from '../../components/portal/labels';
import { Panel, PortalShell, Stat, useLoad } from '../../components/portal/Shell';
import { ButtonLink } from '../../components/ui/Button';
import { EmptyState, Spinner } from '../../components/ui/Feedback';

export default function Dashboard() {
  const L = useL();
  const lang = useLang();
  const money = useMoney();
  const { user } = useAuth();
  const accounts = useLoad(() => portal.accounts(), []);
  const txs = useLoad(() => portal.transactions({ page: 1, page_size: 6 }), []);

  const live = (accounts.data?.items ?? []).filter((a) => a.kind === 'live');
  const demo = (accounts.data?.items ?? []).filter((a) => a.kind === 'demo');
  const usdLive = live.filter((a) => a.currency === 'USD');
  const sum = (k: 'balance' | 'equity') => usdLive.reduce((n, a) => n + (a[k] ?? 0), 0);
  const refBase = absoluteUrl('/register', lang) || (typeof window !== 'undefined' ? window.location.origin + toHref('/register', lang) : '');
  const refLink = user ? `${refBase}?ref=${user.referral_code}` : '';

  return (
    <PortalShell
      title={L({ en: 'Dashboard', ar: 'لوحة التحكم' })}
      actions={
        <ButtonLink to="/portal/deposit" size="sm" className="max-sm:hidden">
          <LuArrowDownToLine className="h-4 w-4" aria-hidden="true" />
          {L({ en: 'Deposit', ar: 'إيداع' })}
        </ButtonLink>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <p className="text-2xl font-bold">
            {L({ en: 'Hello', ar: 'مرحبًا' })}, {user?.full_name.split(' ')[0]}
          </p>
          <p className="text-fg-muted">{L({ en: 'Here is an overview of your accounts and recent activity.', ar: 'إليك نظرة عامة على حساباتك ونشاطك الأخير.' })}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label={L({ en: 'Live balance (USD)', ar: 'الرصيد الحقيقي (USD)' })} value={accounts.loading ? '…' : money(sum('balance'))} icon={<LuWallet />} />
          <Stat label={L({ en: 'Live equity (USD)', ar: 'حقوق الملكية (USD)' })} value={accounts.loading ? '…' : money(sum('equity'))} icon={<LuLayers />} />
          <Stat label={L({ en: 'Live accounts', ar: 'الحسابات الحقيقية' })} value={accounts.loading ? '…' : String(live.length)} />
          <Stat label={L({ en: 'Demo accounts', ar: 'الحسابات التجريبية' })} value={accounts.loading ? '…' : String(demo.length)} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: '/portal/deposit', icon: LuArrowDownToLine, label: L({ en: 'Deposit funds', ar: 'إيداع الأموال' }) },
            { to: '/portal/withdraw', icon: LuArrowUpFromLine, label: L({ en: 'Withdraw', ar: 'سحب' }) },
            { to: '/portal/accounts?open=1', icon: LuPlus, label: L({ en: 'Open MT5 account', ar: 'فتح حساب MT5' }) },
            { to: '/trading/metatrader-5', icon: LuDownload, label: L({ en: 'Download MT5', ar: 'تنزيل MT5' }) },
          ].map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} className="glass glass-hover flex items-center gap-3 p-4 font-semibold">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-bolt/12 text-bolt">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              {label}
            </Link>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Panel
            title={L({ en: 'Trading accounts', ar: 'حسابات التداول' })}
            action={
              <Link to="/portal/accounts" className="text-sm font-semibold text-bolt">
                {L({ en: 'Manage', ar: 'إدارة' })}
              </Link>
            }
          >
            {accounts.loading ? (
              <Spinner />
            ) : accounts.error ? (
              <ErrorNote message={accounts.error} onRetry={accounts.reload} />
            ) : !accounts.data?.items.length ? (
              <EmptyState
                icon={<LuLayers />}
                title={L({ en: 'No trading accounts yet', ar: 'لا توجد حسابات تداول بعد' })}
                action={<ButtonLink to="/portal/accounts?open=1">{L({ en: 'Open your first account', ar: 'افتح حسابك الأول' })}</ButtonLink>}
              >
                {L({ en: 'Open a live or demo MetaTrader 5 account in a few seconds.', ar: 'افتح حساب ميتاتريدر 5 حقيقيًا أو تجريبيًا خلال ثوانٍ.' })}
              </EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead>
                    <tr className="text-xs text-fg-subtle">
                      <th className="pb-2 text-start font-medium">{L({ en: 'Account', ar: 'الحساب' })}</th>
                      <th className="pb-2 text-start font-medium">{L({ en: 'Type', ar: 'النوع' })}</th>
                      <th className="pb-2 text-end font-medium">{L({ en: 'Balance', ar: 'الرصيد' })}</th>
                      <th className="pb-2 text-end font-medium">{L({ en: 'Status', ar: 'الحالة' })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.data.items.slice(0, 6).map((a) => (
                      <tr key={a.id} className="border-t border-line/60">
                        <td className="py-3">
                          <span className="num font-semibold" dir="ltr">
                            {a.login ?? '—'}
                          </span>
                          <span className="ms-2 text-xs text-fg-subtle uppercase">{a.kind === 'live' ? L({ en: 'Live', ar: 'حقيقي' }) : L({ en: 'Demo', ar: 'تجريبي' })}</span>
                        </td>
                        <td className="py-3 text-fg-muted">
                          {L(accountTypeName[a.account_type] ?? accountTypeName.standard)} · 1:{a.leverage}
                        </td>
                        <td className="num py-3 text-end">{money(a.balance, a.currency)}</td>
                        <td className="py-3 text-end">
                          <StatusBadge s={accountStatusLabel[a.status]} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="flex flex-col gap-6">
            <Panel
              title={L({ en: 'Recent activity', ar: 'النشاط الأخير' })}
              action={
                <Link to="/portal/transactions" className="text-sm font-semibold text-bolt">
                  {L({ en: 'All', ar: 'الكل' })}
                </Link>
              }
            >
              {txs.loading ? (
                <Spinner />
              ) : txs.error ? (
                <ErrorNote message={txs.error} onRetry={txs.reload} />
              ) : !txs.data?.items.length ? (
                <p className="text-sm text-fg-subtle">{L({ en: 'No transactions yet.', ar: 'لا توجد معاملات بعد.' })}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line/60">
                  {txs.data.items.map((tx) => (
                    <li key={tx.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <span>
                        <span className="block font-semibold">{L(txTypeLabel[tx.type])}</span>
                        <span className="block text-xs text-fg-subtle">{formatDateTime(tx.created_at, lang)}</span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        <span className={`num font-semibold ${tx.type === 'withdrawal' ? 'text-fg' : 'text-up'}`} dir="ltr">
                          {tx.type === 'withdrawal' ? '−' : '+'}
                          {money(tx.amount, tx.currency)}
                        </span>
                        <StatusBadge s={txStatusLabel[tx.status]} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            {user ? (
              <Panel title={L({ en: 'Invite friends', ar: 'ادعُ أصدقاءك' })}>
                <p className="text-sm text-fg-muted">{L({ en: 'Share your referral code. Clients who join with it are linked to your profile.', ar: 'شارك رمز الإحالة الخاص بك، ويرتبط العملاء الذين ينضمون به بملفك.' })}</p>
                <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2">
                  <span className="num truncate font-semibold" dir="ltr">
                    {refLink || user.referral_code}
                  </span>
                  <CopyButton value={refLink || user.referral_code} />
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
