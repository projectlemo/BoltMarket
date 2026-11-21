import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { LuArrowUpFromLine, LuCircleCheck } from 'react-icons/lu';
import { useL, useT } from '../../i18n';
import type { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDateTime } from '../../lib/format';
import { portal, type PublicConfig, type Transaction } from '../../lib/portal-api';
import { parseAmount } from '../../lib/validate';
import { useLang } from '../../router';
import { ErrorNote, StatusBadge, useMoney } from '../../components/portal/Bits';
import { methodLabel, txStatusLabel } from '../../components/portal/labels';
import { Panel, PortalShell, useLoad } from '../../components/portal/Shell';
import { Button, ButtonLink } from '../../components/ui/Button';
import { EmptyState, Notice, Spinner } from '../../components/ui/Feedback';
import { SelectField, TextField } from '../../components/ui/Form';

const NETWORKS = ['TRC20', 'ERC20', 'BEP20', 'BTC', 'ETH'];

export default function Withdraw() {
  const L = useL();
  const t = useT();
  const lang = useLang();
  const money = useMoney();
  const { user } = useAuth();
  const accounts = useLoad(() => portal.accounts(), []);
  const pending = useLoad(() => portal.transactions({ type: 'withdrawal', page: 1, page_size: 10 }), []);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState('TRC20');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<Transaction | null>(null);

  useEffect(() => {
    portal.config().then((c) => {
      setConfig(c);
      if (c.withdrawal_methods[0]) setMethod(c.withdrawal_methods[0].id);
    }).catch(() => setConfig(null));
  }, []);

  const live = useMemo(() => (accounts.data?.items ?? []).filter((a) => a.kind === 'live' && a.status === 'active'), [accounts.data]);
  useEffect(() => {
    if (!accountId && live[0]) setAccountId(String(live[0].id));
  }, [live, accountId]);
  const account = live.find((a) => String(a.id) === accountId);
  const available = account?.margin_free ?? account?.balance ?? 0;

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    const value = parseAmount(amount);
    if (!account) return setError(L({ en: 'Choose a trading account.', ar: 'اختر حساب تداول.' }));
    if (!value) return setError(L({ en: 'Enter an amount.', ar: 'أدخل المبلغ.' }));
    if (value > available) return setError(L({ en: `You can withdraw up to ${money(available, account.currency)}.`, ar: `يمكنك سحب ما يصل إلى ${money(available, account.currency)}.` }));
    if (method === 'crypto' && address.trim().length < 20) return setError(L({ en: 'Enter a valid wallet address.', ar: 'أدخل عنوان محفظة صحيحًا.' }));
    setLoading(true);
    try {
      const tx = await portal.withdraw({
        account_id: account.id,
        amount: value,
        method,
        destination: method === 'crypto' ? { address: address.trim(), network } : {},
      });
      setDone(tx);
      setAmount('');
      pending.reload();
    } catch (e) {
      const ae = e as ApiError;
      setError(ae.code === 'INSUFFICIENT_FUNDS' ? L({ en: 'The amount exceeds the free margin on this account.', ar: 'المبلغ يتجاوز الهامش الحر في هذا الحساب.' }) : ae.message);
    } finally {
      setLoading(false);
    }
  };

  const cancel = async (id: number) => {
    try {
      await portal.cancelWithdrawal(id);
      pending.reload();
      accounts.reload();
    } catch (e) {
      setError((e as ApiError).message);
    }
  };

  const verified = user?.kyc_status === 'approved';

  return (
    <PortalShell title={L({ en: 'Withdraw', ar: 'سحب' })}>
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-4">
          {!verified ? (
            <Notice tone="warn" title={L({ en: 'Verification required', ar: 'التحقق مطلوب' })} action={<ButtonLink to="/portal/verification" size="sm">{L({ en: 'Verify now', ar: 'تحقّق الآن' })}</ButtonLink>}>
              {L({ en: 'Withdrawals are available once your identity is verified.', ar: 'تتاح السحوبات بعد التحقق من هويتك.' })}
            </Notice>
          ) : accounts.loading || !config ? (
            <Spinner label={t.common.loading} />
          ) : !config.withdrawal_methods.length ? (
            <EmptyState icon={<LuArrowUpFromLine />} title={L({ en: 'Withdrawals are not available yet', ar: 'السحوبات غير متاحة بعد' })}>
              {L({ en: 'Please contact support to request a withdrawal.', ar: 'يرجى التواصل مع الدعم لطلب السحب.' })}
            </EmptyState>
          ) : !live.length ? (
            <EmptyState icon={<LuArrowUpFromLine />} title={L({ en: 'No funded live accounts', ar: 'لا توجد حسابات حقيقية ممولة' })} />
          ) : (
            <form onSubmit={submit} noValidate className="glass flex flex-col gap-5 p-6 sm:p-8">
              {done ? (
                <Notice tone="up" title={L({ en: 'Withdrawal requested', ar: 'تم تقديم طلب السحب' })}>
                  <span className="flex items-center gap-2">
                    <LuCircleCheck className="h-4 w-4" aria-hidden="true" />
                    {L({ en: `Request #${done.id} for ${money(done.amount, done.currency)} is with our finance team.`, ar: `الطلب رقم ${done.id} بمبلغ ${money(done.amount, done.currency)} لدى إدارة المالية.` })}
                  </span>
                </Notice>
              ) : null}
              <SelectField label={L({ en: 'From account', ar: 'من الحساب' })} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {live.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.login} · {money(a.margin_free ?? a.balance, a.currency)}
                  </option>
                ))}
              </SelectField>
              <SelectField label={L({ en: 'Method', ar: 'الوسيلة' })} value={method} onChange={(e) => setMethod(e.target.value)}>
                {config.withdrawal_methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {L(methodLabel[m.id] ?? { en: m.id, ar: m.id })}
                  </option>
                ))}
              </SelectField>
              {method === 'crypto' ? (
                <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
                  <TextField label={L({ en: 'Wallet address', ar: 'عنوان المحفظة' })} value={address} onChange={(e) => setAddress(e.target.value)} dir="ltr" autoComplete="off" spellCheck={false} />
                  <SelectField label={L({ en: 'Network', ar: 'الشبكة' })} value={network} onChange={(e) => setNetwork(e.target.value)}>
                    {NETWORKS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </SelectField>
                </div>
              ) : (
                <p className="text-sm text-fg-muted">{L({ en: 'Card withdrawals are refunded to the card you deposited with.', ar: 'تُعاد سحوبات البطاقة إلى البطاقة التي أودعت منها.' })}</p>
              )}
              <TextField
                label={L({ en: 'Amount', ar: 'المبلغ' })}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                suffix={account?.currency ?? 'USD'}
                hint={account ? L({ en: `Available: ${money(available, account.currency)}`, ar: `المتاح: ${money(available, account.currency)}` }) : undefined}
                dir="ltr"
              />
              {error ? <Notice tone="down">{error}</Notice> : null}
              <Button type="submit" size="lg" loading={loading}>
                {L({ en: 'Request withdrawal', ar: 'طلب السحب' })}
              </Button>
            </form>
          )}
        </div>
        <Panel title={L({ en: 'Recent withdrawals', ar: 'السحوبات الأخيرة' })}>
          {pending.loading ? (
            <Spinner />
          ) : pending.error ? (
            <ErrorNote message={pending.error} onRetry={pending.reload} />
          ) : !pending.data?.items.length ? (
            <p className="text-sm text-fg-subtle">{L({ en: 'No withdrawals yet.', ar: 'لا توجد سحوبات بعد.' })}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line/60">
              {pending.data.items.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    <span className="num block font-semibold">{money(tx.amount, tx.currency)}</span>
                    <span className="block text-xs text-fg-subtle">{formatDateTime(tx.created_at, lang)}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1.5">
                    <StatusBadge s={txStatusLabel[tx.status]} />
                    {tx.status === 'pending' ? (
                      <button type="button" className="text-xs font-semibold text-fg-muted hover:text-down" onClick={() => void cancel(tx.id)}>
                        {L({ en: 'Cancel', ar: 'إلغاء' })}
                      </button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PortalShell>
  );
}
