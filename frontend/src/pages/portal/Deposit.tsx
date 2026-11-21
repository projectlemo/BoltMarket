import clsx from 'clsx';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { LuCircleCheck, LuClock, LuCoins, LuCreditCard, LuExternalLink, LuWallet } from 'react-icons/lu';
import { accountById } from '../../config/accounts';
import { useL, useT } from '../../i18n';
import type { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { portal, type PublicConfig, type Transaction } from '../../lib/portal-api';
import { parseAmount } from '../../lib/validate';
import { useRouter } from '../../router';
import { ErrorNote, StatusBadge, useMoney } from '../../components/portal/Bits';
import { accountTypeName, txStatusLabel } from '../../components/portal/labels';
import { Panel, PortalShell, useLoad } from '../../components/portal/Shell';
import { Button, ButtonLink } from '../../components/ui/Button';
import { EmptyState, Notice, Spinner } from '../../components/ui/Feedback';
import { SelectField, TextField } from '../../components/ui/Form';

/** Polls a transaction after returning from the payment provider. */
function ReturnStatus({ id }: { id: number }) {
  const L = useL();
  const money = useMoney();
  const [tx, setTx] = useState<Transaction | null>(null);
  useEffect(() => {
    let alive = true;
    let timer = 0;
    const poll = async (n: number) => {
      try {
        const t = await portal.transaction(id);
        if (!alive) return;
        setTx(t);
        if ((t.status === 'awaiting_payment' || t.status === 'processing' || t.status === 'pending') && n < 40) timer = window.setTimeout(() => void poll(n + 1), 4000);
      } catch {
        /* keep last known */
      }
    };
    void poll(0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [id]);
  if (!tx) return <Spinner />;
  const done = tx.status === 'completed';
  return (
    <Panel>
      <div className="flex items-center gap-4">
        {done ? <LuCircleCheck className="h-10 w-10 shrink-0 text-up" aria-hidden="true" /> : <LuClock className="h-10 w-10 shrink-0 text-warn" aria-hidden="true" />}
        <div className="flex-1">
          <p className="font-semibold">
            {done
              ? L({ en: 'Deposit credited to your MT5 account', ar: 'أُضيف الإيداع إلى حساب ميتاتريدر 5' })
              : L({ en: 'We are waiting for the payment confirmation', ar: 'بانتظار تأكيد الدفع' })}
          </p>
          <p className="num text-sm text-fg-muted">
            {money(tx.amount, tx.currency)} · #{tx.id}
          </p>
        </div>
        <StatusBadge s={txStatusLabel[tx.status]} />
      </div>
    </Panel>
  );
}

export default function Deposit() {
  const L = useL();
  const t = useT();
  const money = useMoney();
  const { user } = useAuth();
  const { state } = useRouter();
  const accounts = useLoad(() => portal.accounts(), []);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [returnId, setReturnId] = useState<number | null>(null);
  const [returnCancelled, setReturnCancelled] = useState(false);

  useEffect(() => {
    portal.config().then((c) => {
      setConfig(c);
      if (c.deposit_methods[0]) setMethod(c.deposit_methods[0].id);
    }).catch(() => setConfig(null));
    const q = new URLSearchParams(state.search);
    const tx = Number(q.get('tx'));
    if (tx) setReturnId(tx);
    if (q.get('status') === 'cancelled') setReturnCancelled(true);
  }, [state.search]);

  const live = useMemo(() => (accounts.data?.items ?? []).filter((a) => a.kind === 'live' && a.status === 'active'), [accounts.data]);
  useEffect(() => {
    if (!accountId && live[0]) setAccountId(String(live[0].id));
  }, [live, accountId]);

  const account = live.find((a) => String(a.id) === accountId);
  const typeMin = account ? (accountById(account.account_type)?.minDeposit ?? 0) : 0;
  const firstDeposit = account ? (account.balance ?? 0) === 0 : false;
  const methodCfg = config?.deposit_methods.find((m) => m.id === method);
  const minimum = Math.max(methodCfg?.min_amount ?? 0, firstDeposit ? typeMin : 0);
  const kycBlocked = Boolean(config?.require_kyc_for_deposit && user?.kyc_status !== 'approved');

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    const value = parseAmount(amount);
    if (!account) return setError(L({ en: 'Choose a trading account.', ar: 'اختر حساب تداول.' }));
    if (!value || value < minimum) return setError(L({ en: `The minimum for this deposit is ${money(minimum)}.`, ar: `الحد الأدنى لهذا الإيداع ${money(minimum)}.` }));
    setLoading(true);
    try {
      const res = await portal.deposit({ account_id: account.id, amount: value, method });
      if (res.redirect_url) window.location.assign(res.redirect_url);
      else setReturnId(res.transaction.id);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  };

  const icon = (id: string) => (id === 'card' ? <LuCreditCard className="h-6 w-6" /> : <LuCoins className="h-6 w-6" />);

  return (
    <PortalShell title={L({ en: 'Deposit', ar: 'إيداع' })}>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {returnCancelled ? <Notice tone="warn">{L({ en: 'The payment was cancelled. No money was taken.', ar: 'أُلغي الدفع ولم يُخصم أي مبلغ.' })}</Notice> : null}
        {returnId ? <ReturnStatus id={returnId} /> : null}
        {accounts.loading || !config ? (
          accounts.error ? <ErrorNote message={accounts.error} onRetry={accounts.reload} /> : <Spinner label={t.common.loading} />
        ) : !config.deposit_methods.length ? (
          <EmptyState icon={<LuWallet />} title={L({ en: 'Deposits are not available yet', ar: 'الإيداعات غير متاحة بعد' })}>
            {L({ en: 'No payment method is enabled at the moment. Please contact support.', ar: 'لا توجد وسيلة دفع مفعّلة حاليًا. يرجى التواصل مع الدعم.' })}
          </EmptyState>
        ) : kycBlocked ? (
          <Notice tone="warn" title={L({ en: 'Verify your identity first', ar: 'تحقّق من هويتك أولًا' })} action={<ButtonLink to="/portal/verification" size="sm">{L({ en: 'Go to verification', ar: 'انتقل إلى التحقق' })}</ButtonLink>}>
            {L({ en: 'Deposits open as soon as your documents are approved.', ar: 'تُتاح الإيداعات فور اعتماد مستنداتك.' })}
          </Notice>
        ) : !live.length ? (
          <EmptyState icon={<LuWallet />} title={L({ en: 'Open a live account first', ar: 'افتح حسابًا حقيقيًا أولًا' })} action={<ButtonLink to="/portal/accounts?open=1">{L({ en: 'Open account', ar: 'فتح حساب' })}</ButtonLink>} />
        ) : (
          <form onSubmit={submit} className="glass flex flex-col gap-6 p-6 sm:p-8" noValidate>
            <SelectField label={L({ en: 'To account', ar: 'إلى الحساب' })} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {live.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.login} · {L(accountTypeName[a.account_type] ?? accountTypeName.standard)} · {money(a.balance, a.currency)}
                </option>
              ))}
            </SelectField>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">{L({ en: 'Payment method', ar: 'وسيلة الدفع' })}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {config.deposit_methods.map((m) => (
                  <label
                    key={m.id}
                    className={clsx(
                      'flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-bolt',
                      method === m.id ? 'border-bolt bg-bolt/[0.07]' : 'border-line-strong hover:border-white/30',
                    )}
                  >
                    <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="sr-only" />
                    <span className="text-bolt">{icon(m.id)}</span>
                    <span>
                      <span className="block font-semibold">{m.id === 'card' ? L({ en: 'Card', ar: 'بطاقة' }) : L({ en: 'Cryptocurrency', ar: 'عملات رقمية' })}</span>
                      <span className="block text-xs text-fg-subtle">
                        {L({ en: 'Min.', ar: 'الحد الأدنى' })} {money(m.min_amount, m.currency)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <TextField
              label={L({ en: 'Amount', ar: 'المبلغ' })}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              suffix={account?.currency ?? 'USD'}
              hint={L({ en: `Minimum ${money(minimum)}${firstDeposit && typeMin ? ' for the first deposit on this account type' : ''}.`, ar: `الحد الأدنى ${money(minimum)}${firstDeposit && typeMin ? ' لأول إيداع على هذا النوع من الحسابات' : ''}.` })}
              dir="ltr"
            />
            {error ? <Notice tone="down">{error}</Notice> : null}
            <Button type="submit" size="lg" loading={loading}>
              {L({ en: 'Continue to secure payment', ar: 'المتابعة إلى الدفع الآمن' })}
              <LuExternalLink className="h-4 w-4" aria-hidden="true" />
            </Button>
            <p className="text-xs leading-relaxed text-fg-subtle">
              {L({
                en: 'You will complete the payment on our payment provider’s secure page. Payments must come from a card or wallet in your own name; third-party payments are returned.',
                ar: 'ستُكمل الدفع على صفحة مزوّد الدفع الآمنة. يجب أن يتم الدفع من بطاقة أو محفظة باسمك، وتُعاد المدفوعات الواردة من أطراف ثالثة.',
              })}
            </p>
          </form>
        )}
      </div>
    </PortalShell>
  );
}
