import { useEffect, useState, type FormEvent } from 'react';
import { LuKeyRound, LuLayers, LuPlus, LuRefreshCw, LuTriangleAlert } from 'react-icons/lu';
import { accountCopy, accountTypes, leverageOptions } from '../../config/accounts';
import { useL, useT } from '../../i18n';
import type { ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { portal, type AccountKind, type PublicConfig, type TradingAccount } from '../../lib/portal-api';
import { useLang, useRouter } from '../../router';
import { CopyButton, ErrorNote, StatusBadge, useMoney } from '../../components/portal/Bits';
import { accountStatusLabel, accountTypeName } from '../../components/portal/labels';
import { PortalShell, useLoad } from '../../components/portal/Shell';
import { Button } from '../../components/ui/Button';
import { Dialog, Tabs } from '../../components/ui/Disclosure';
import { EmptyState, Notice, Spinner } from '../../components/ui/Feedback';
import { SelectField } from '../../components/ui/Form';

interface Credentials {
  account: TradingAccount;
  password: string | null;
  investor_password: string | null;
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
      <span>
        <span className="block text-xs text-fg-subtle">{label}</span>
        <span className="num block font-semibold break-all" dir="ltr">
          {value}
        </span>
      </span>
      <CopyButton value={value} label={label} />
    </div>
  );
}

export default function Accounts() {
  const L = useL();
  const t = useT();
  const lang = useLang();
  const money = useMoney();
  const { state } = useRouter();
  const list = useLoad(() => portal.accounts(), []);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [tab, setTab] = useState<AccountKind>('live');
  const [openDialog, setOpenDialog] = useState(false);
  const [form, setForm] = useState({ kind: 'live' as AccountKind, account_type: 'standard', leverage: 100, currency: 'USD' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    portal.config().then(setConfig).catch(() => setConfig(null));
    const q = new URLSearchParams(state.search);
    let pref: string | null = null;
    let demo = false;
    try {
      pref = localStorage.getItem('bolt.pref.account');
      demo = localStorage.getItem('bolt.pref.demo') === '1';
    } catch {
      /* ignore */
    }
    if (pref && accountTypes.some((a) => a.id === pref)) setForm((f) => ({ ...f, account_type: pref as string }));
    if (demo) setForm((f) => ({ ...f, kind: 'demo' }));
    if (q.get('open')) setOpenDialog(true);
  }, [state.search]);

  const items = (list.data?.items ?? []).filter((a) => a.kind === tab);
  const leverages = config?.leverage_options?.length ? config.leverage_options : leverageOptions;
  const currencies = config?.account_currencies?.length ? config.account_currencies : ['USD'];

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await portal.openAccount(form);
      setOpenDialog(false);
      setCreds(res);
      setTab(res.account.kind);
      list.reload();
      try {
        localStorage.removeItem('bolt.pref.demo');
      } catch {
        /* ignore */
      }
    } catch (e) {
      const ae = e as ApiError;
      setFormError(
        ae.code === 'EMAIL_NOT_VERIFIED'
          ? L({ en: 'Confirm your email before opening accounts.', ar: 'أكّد بريدك الإلكتروني قبل فتح الحسابات.' })
          : ae.code === 'ACCOUNT_LIMIT'
            ? L({ en: 'You have reached the maximum number of accounts. Contact support to open more.', ar: 'بلغت الحد الأقصى لعدد الحسابات. تواصل مع الدعم لفتح المزيد.' })
            : ae.message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async (a: TradingAccount) => {
    setBusyId(a.id);
    setActionError(null);
    try {
      const r = await portal.resetTradingPassword(a.id);
      setCreds({ account: a, password: r.password, investor_password: null });
    } catch (e) {
      setActionError((e as ApiError).message);
    } finally {
      setBusyId(null);
    }
  };

  const sync = async (a: TradingAccount) => {
    setBusyId(a.id);
    setActionError(null);
    try {
      const updated = await portal.syncAccount(a.id);
      list.setData((d) => (d ? { items: d.items.map((x) => (x.id === a.id ? updated : x)) } : d));
    } catch (e) {
      setActionError((e as ApiError).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PortalShell
      title={L({ en: 'MT5 accounts', ar: 'حسابات ميتاتريدر 5' })}
      actions={
        <Button size="sm" onClick={() => setOpenDialog(true)}>
          <LuPlus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{L({ en: 'Open account', ar: 'فتح حساب' })}</span>
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <Tabs
          label={L({ en: 'Account kind', ar: 'نوع الحساب' })}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'live', label: L({ en: 'Live', ar: 'حقيقي' }) },
            { id: 'demo', label: L({ en: 'Demo', ar: 'تجريبي' }) },
          ]}
          className="self-start"
        />
        {actionError ? <ErrorNote message={actionError} /> : null}
        {list.loading ? (
          <Spinner label={t.common.loading} />
        ) : list.error ? (
          <ErrorNote message={list.error} onRetry={list.reload} />
        ) : !items.length ? (
          <EmptyState
            icon={<LuLayers />}
            title={tab === 'live' ? L({ en: 'No live accounts yet', ar: 'لا توجد حسابات حقيقية بعد' }) : L({ en: 'No demo accounts yet', ar: 'لا توجد حسابات تجريبية بعد' })}
            action={
              <Button
                onClick={() => {
                  setForm((f) => ({ ...f, kind: tab }));
                  setOpenDialog(true);
                }}
              >
                {L({ en: 'Open account', ar: 'فتح حساب' })}
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map((a) => (
              <article key={a.id} className="glass flex flex-col gap-4 p-5">
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-fg-subtle uppercase">
                      {L(accountTypeName[a.account_type] ?? accountTypeName.standard)} · {a.kind === 'live' ? L({ en: 'Live', ar: 'حقيقي' }) : L({ en: 'Demo', ar: 'تجريبي' })}
                    </p>
                    <p className="num font-display text-2xl font-extrabold" dir="ltr">
                      {a.login ?? L({ en: 'Pending', ar: 'قيد الإعداد' })}
                    </p>
                  </div>
                  <StatusBadge s={accountStatusLabel[a.status]} />
                </header>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-fg-subtle">{L({ en: 'Balance', ar: 'الرصيد' })}</dt>
                    <dd className="num font-semibold">{money(a.balance, a.currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-fg-subtle">{L({ en: 'Equity', ar: 'حقوق الملكية' })}</dt>
                    <dd className="num font-semibold">{money(a.equity, a.currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-fg-subtle">{L({ en: 'Leverage', ar: 'الرافعة' })}</dt>
                    <dd className="num font-semibold">1:{a.leverage}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-fg-subtle">{L({ en: 'Server', ar: 'الخادم' })}</dt>
                    <dd className="truncate font-semibold" dir="ltr" title={a.server ?? ''}>
                      {a.server ?? '—'}
                    </dd>
                  </div>
                </dl>
                {a.status === 'pending' ? (
                  <p className="text-sm text-fg-muted">
                    {L({ en: 'We are setting up this account. Your login appears here and by email once it is ready.', ar: 'نعمل على إعداد هذا الحساب، وستظهر بيانات الدخول هنا وفي بريدك فور جاهزيته.' })}
                  </p>
                ) : null}
                <footer className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  {a.login ? <CopyButton value={a.login} label={L({ en: 'login', ar: 'رقم الدخول' })} /> : null}
                  {a.status === 'active' ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => void resetPassword(a)} disabled={busyId === a.id}>
                        <LuKeyRound className="h-4 w-4" aria-hidden="true" />
                        {L({ en: 'Reset trading password', ar: 'إعادة تعيين كلمة مرور التداول' })}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void sync(a)} disabled={busyId === a.id}>
                        <LuRefreshCw className="h-4 w-4" aria-hidden="true" />
                        {L({ en: 'Refresh balance', ar: 'تحديث الرصيد' })}
                      </Button>
                    </>
                  ) : null}
                  {a.synced_at ? <span className="ms-auto text-xs text-fg-subtle">{formatDateTime(a.synced_at, lang)}</span> : null}
                </footer>
              </article>
            ))}
          </div>
        )}
      </div>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} title={L({ en: 'Open an MT5 account', ar: 'فتح حساب ميتاتريدر 5' })} closeLabel={t.common.close}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Tabs
            label={L({ en: 'Account kind', ar: 'نوع الحساب' })}
            value={form.kind}
            onChange={(k) => setForm((f) => ({ ...f, kind: k }))}
            tabs={[
              { id: 'live', label: L({ en: 'Live', ar: 'حقيقي' }) },
              { id: 'demo', label: L({ en: 'Demo', ar: 'تجريبي' }) },
            ]}
          />
          <SelectField label={L({ en: 'Account type', ar: 'نوع الحساب' })} value={form.account_type} onChange={(e) => setForm((f) => ({ ...f, account_type: e.target.value }))}>
            {accountTypes.map((a) => (
              <option key={a.id} value={a.id}>
                {L(accountCopy[a.id].name)} — {L({ en: 'from', ar: 'من' })} {a.spreadFrom.toFixed(1)} {t.common.pips}
              </option>
            ))}
          </SelectField>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label={L({ en: 'Leverage', ar: 'الرافعة' })} value={String(form.leverage)} onChange={(e) => setForm((f) => ({ ...f, leverage: Number(e.target.value) }))}>
              {leverages.map((l) => (
                <option key={l} value={l}>
                  1:{l}
                </option>
              ))}
            </SelectField>
            <SelectField label={L({ en: 'Currency', ar: 'العملة' })} value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectField>
          </div>
          {form.kind === 'demo' && config ? (
            <p className="text-sm text-fg-muted">{L({ en: `Demo accounts start with ${money(config.demo_balance)} in virtual funds.`, ar: `تبدأ الحسابات التجريبية برصيد افتراضي قدره ${money(config.demo_balance)}.` })}</p>
          ) : null}
          {config && !config.mt5_enabled ? (
            <Notice tone="info">{L({ en: 'Your account will be set up by our team and the login sent to you by email.', ar: 'سيُعِد فريقنا حسابك وسنرسل إليك بيانات الدخول عبر البريد.' })}</Notice>
          ) : null}
          {formError ? <Notice tone="down">{formError}</Notice> : null}
          <Button type="submit" loading={submitting}>
            {L({ en: 'Open account', ar: 'فتح الحساب' })}
          </Button>
        </form>
      </Dialog>

      <Dialog open={Boolean(creds)} onClose={() => setCreds(null)} title={L({ en: 'Your MT5 login details', ar: 'بيانات الدخول إلى ميتاتريدر 5' })} closeLabel={t.common.close}>
        {creds ? (
          <div className="flex flex-col gap-3">
            {creds.account.login ? (
              <>
                <CredentialRow label={L({ en: 'Login', ar: 'رقم الدخول' })} value={creds.account.login} />
                {creds.account.server ? <CredentialRow label={L({ en: 'Server', ar: 'الخادم' })} value={creds.account.server} /> : null}
                {creds.password ? <CredentialRow label={L({ en: 'Trading password', ar: 'كلمة مرور التداول' })} value={creds.password} /> : null}
                {creds.investor_password ? <CredentialRow label={L({ en: 'Investor (read-only) password', ar: 'كلمة مرور المستثمر (للعرض فقط)' })} value={creds.investor_password} /> : null}
                {creds.password ? (
                  <Notice tone="warn">
                    <span className="flex items-center gap-2">
                      <LuTriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {L({ en: 'Save these details now. For security, the password is shown only once.', ar: 'احفظ هذه البيانات الآن، فلدواعٍ أمنية تُعرض كلمة المرور مرة واحدة فقط.' })}
                    </span>
                  </Notice>
                ) : null}
              </>
            ) : (
              <Notice tone="info" title={L({ en: 'Request received', ar: 'تم استلام الطلب' })}>
                {L({ en: 'We will email your login details as soon as the account is ready.', ar: 'سنرسل بيانات الدخول إلى بريدك فور جاهزية الحساب.' })}
              </Notice>
            )}
            <Button onClick={() => setCreds(null)}>{L({ en: 'Done', ar: 'تم' })}</Button>
          </div>
        ) : null}
      </Dialog>
    </PortalShell>
  );
}
