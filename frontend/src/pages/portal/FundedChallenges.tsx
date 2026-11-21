import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { LuTrophy } from 'react-icons/lu';
import { fundedPlans, fundedRules as R } from '../../config/funded';
import { useL, useT } from '../../i18n';
import type { ApiError } from '../../lib/api';
import { compactUsd } from '../../lib/format';
import { portal, type PublicConfig } from '../../lib/portal-api';
import { Link, useRouter } from '../../router';
import { CopyButton, ErrorNote, StatusBadge, useMoney } from '../../components/portal/Bits';
import { challengeLabel } from '../../components/portal/labels';
import { Panel, PortalShell, useLoad } from '../../components/portal/Shell';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Disclosure';
import { EmptyState, Notice, Spinner } from '../../components/ui/Feedback';
import { Checkbox } from '../../components/ui/Form';

export default function FundedChallenges() {
  const L = useL();
  const t = useT();
  const money = useMoney();
  const { state } = useRouter();
  const list = useLoad(() => portal.challenges(), []);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [plan, setPlan] = useState<number | null>(null);
  const [method, setMethod] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    portal.config().then((c) => {
      setConfig(c);
      if (c.deposit_methods[0]) setMethod(c.deposit_methods[0].id);
    }).catch(() => setConfig(null));
    const p = Number(new URLSearchParams(state.search).get('plan'));
    if (fundedPlans.some((x) => x.size === p)) setPlan(p);
  }, [state.search]);

  const selected = fundedPlans.find((p) => p.size === plan);
  const buy = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await portal.buyChallenge({ plan_size: selected.size, method });
      if (res.redirect_url) window.location.assign(res.redirect_url);
      else {
        setPlan(null);
        list.reload();
      }
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalShell title={L({ en: 'Bolt Funded', ar: 'برنامج التمويل' })}>
      <div className="flex flex-col gap-6">
        <Panel title={L({ en: 'Start an evaluation', ar: 'ابدأ تقييمًا' })} action={<Link to="/funded#rules" className="text-sm font-semibold text-bolt">{L({ en: 'Rules', ar: 'القواعد' })}</Link>}>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {fundedPlans.map((p) => (
              <button
                key={p.size}
                type="button"
                onClick={() => setPlan(p.size)}
                className={clsx('flex flex-col items-start gap-1 rounded-2xl border p-4 text-start transition hover:border-bolt/50', p.popular ? 'border-bolt/40' : 'border-line-strong')}
              >
                <span className="num font-display text-2xl font-extrabold">{compactUsd(p.size)}</span>
                <span className="num text-sm text-fg-muted">{money(p.fee)} {L({ en: 'fee', ar: 'رسوم' })}</span>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title={L({ en: 'Your evaluations', ar: 'تقييماتك' })}>
          {list.loading ? (
            <Spinner label={t.common.loading} />
          ) : list.error ? (
            <ErrorNote message={list.error} onRetry={list.reload} />
          ) : !list.data?.items.length ? (
            <EmptyState icon={<LuTrophy />} title={L({ en: 'No evaluations yet', ar: 'لا توجد تقييمات بعد' })}>
              {L({ en: 'Pick an account size above to begin.', ar: 'اختر حجم الحساب أعلاه للبدء.' })}
            </EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-line/60">
              {list.data.items.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    <span className="num block font-display text-lg font-bold">{compactUsd(c.plan_size)} · #{c.id}</span>
                    {c.account?.login ? (
                      <span className="flex items-center gap-2 text-sm text-fg-muted" dir="ltr">
                        {c.account.login} · {c.account.server}
                        <CopyButton value={c.account.login} />
                      </span>
                    ) : null}
                  </span>
                  <StatusBadge s={challengeLabel[c.status]} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <Dialog open={Boolean(selected)} onClose={() => setPlan(null)} title={selected ? L({ en: `${compactUsd(selected.size)} evaluation`, ar: `تقييم ${compactUsd(selected.size)}` }) : ''} closeLabel={t.common.close}>
        {selected ? (
          <div className="flex flex-col gap-4">
            <ul className="grid grid-cols-2 gap-3 text-sm">
              <li><span className="block text-fg-subtle">{L({ en: 'Phase 1 target', ar: 'هدف المرحلة 1' })}</span><span className="num font-semibold">{money((selected.size * R.phase1Target) / 100)}</span></li>
              <li><span className="block text-fg-subtle">{L({ en: 'Phase 2 target', ar: 'هدف المرحلة 2' })}</span><span className="num font-semibold">{money((selected.size * R.phase2Target) / 100)}</span></li>
              <li><span className="block text-fg-subtle">{L({ en: 'Daily loss limit', ar: 'حد الخسارة اليومية' })}</span><span className="num font-semibold">{money((selected.size * R.maxDailyLoss) / 100)}</span></li>
              <li><span className="block text-fg-subtle">{L({ en: 'Max loss', ar: 'أقصى خسارة' })}</span><span className="num font-semibold">{money((selected.size * R.maxOverallLoss) / 100)}</span></li>
            </ul>
            {config && !config.deposit_methods.length ? (
              <Notice tone="warn">{L({ en: 'Online payment is not available yet. Please contact support to join.', ar: 'الدفع الإلكتروني غير متاح بعد. يرجى التواصل مع الدعم للانضمام.' })}</Notice>
            ) : (
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={L({ en: 'Payment method', ar: 'وسيلة الدفع' })}>
                {config?.deposit_methods.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={method === m.id} onClick={() => setMethod(m.id)} className={clsx('rounded-xl border px-4 py-2 text-sm font-semibold', method === m.id ? 'border-bolt bg-bolt text-bolt-ink' : 'border-line-strong text-fg-muted')}>
                    {m.id === 'card' ? L({ en: 'Card', ar: 'بطاقة' }) : L({ en: 'Crypto', ar: 'عملات رقمية' })}
                  </button>
                ))}
              </div>
            )}
            <Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)} label={L({ en: 'I understand the evaluation uses virtual funds and the fee is not a deposit, and I accept the programme rules.', ar: 'أدرك أن التقييم يستخدم أموالًا افتراضية وأن الرسوم ليست إيداعًا، وأوافق على قواعد البرنامج.' })} />
            {error ? <Notice tone="down">{error}</Notice> : null}
            <Button onClick={() => void buy()} loading={loading} disabled={!agree || !method}>
              {L({ en: `Pay ${money(selected.fee)}`, ar: `ادفع ${money(selected.fee)}` })}
            </Button>
          </div>
        ) : null}
      </Dialog>
    </PortalShell>
  );
}
