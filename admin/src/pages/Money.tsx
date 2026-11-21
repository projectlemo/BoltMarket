import { useState, type ReactNode } from 'react';
import { LuArrowLeft, LuPlus } from 'react-icons/lu';
import {
  Button,
  type Column,
  Dl,
  Empty,
  ErrorNote,
  FilterSelect,
  Modal,
  PageHeader,
  Pager,
  SearchBox,
  Section,
  Select,
  Spinner,
  StatusBadge,
  Table,
  TextArea,
  TextInput,
  useToast,
} from '../components/ui';
import { api } from '../lib/api';
import { dateTime, label, money } from '../lib/format';
import { qs, useAction, useDebounced, useResource } from '../lib/hooks';
import { Link, navigate, setQuery, useLocation } from '../lib/router';
import type { AdminTx, Page } from '../lib/types';

const cols: Column<AdminTx>[] = [
  { key: 'id', header: '#', render: (t) => <span className="font-mono text-fg-subtle">{t.id}</span> },
  {
    key: 'client',
    header: 'Client',
    render: (t) => (
      <span>
        <span className="block font-semibold">{t.user_name}</span>
        <span className="block text-xs text-fg-subtle">{t.user_email}</span>
      </span>
    ),
  },
  { key: 'type', header: 'Type', render: (t) => label(t.type) },
  { key: 'amount', header: 'Amount', render: (t) => <span className="whitespace-nowrap font-semibold">{money(t.amount, t.currency)}</span> },
  { key: 'method', header: 'Method', render: (t) => `${label(t.method)}${t.provider ? ` · ${t.provider}` : ''}` },
  { key: 'acc', header: 'MT5', render: (t) => <span className="font-mono">{t.account_login ?? '—'}</span> },
  { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
  { key: 'date', header: 'Created', render: (t) => <span className="whitespace-nowrap">{dateTime(t.created_at)}</span> },
];

function Adjustment({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ account_id: '', amount: '', type: 'adjustment', note: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, run } = useAction();
  const save = async () => {
    const res = await run(() => api<AdminTx>('/admin/adjustments', { body: { ...form, account_id: Number(form.account_id), amount: Number(form.amount) } }));
    if (res.ok) {
      toast('ok', `Recorded ${money(res.value.amount, res.value.currency)} on account ${res.value.account_login ?? res.value.account_id}.`);
      onClose();
      navigate(`/transactions/${res.value.id}`);
    } else {
      setErrors(res.error.fields);
      toast('error', res.error.message);
    }
  };
  return (
    <Modal title="Balance adjustment or IB payout" open={open} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-fg-muted">When MT5 is connected the amount is applied to the account immediately; otherwise apply it in MT5 Manager and record it here.</p>
        <Select label="Kind" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={[{ value: 'adjustment', label: 'Balance correction (can be negative)' }, { value: 'ib_commission', label: 'IB commission payout' }]} />
        <TextInput label="Internal account ID" hint="The number in the MT5 accounts list (not the MT5 login)." inputMode="numeric" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} error={errors.account_id} />
        <TextInput label="Amount (account currency)" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} error={errors.amount} />
        <TextArea label="Note (shown to the client)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} error={errors.note} rows={2} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" busy={busy} disabled={!form.account_id || !form.amount || form.note.trim().length < 3} onClick={() => void save()}>
            Record
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function Transactions() {
  const { query } = useLocation();
  const [q, setQ] = useState(query.get('q') ?? '');
  const [adjusting, setAdjusting] = useState(false);
  const term = useDebounced(q);
  const type = query.get('type') ?? '';
  const status = query.get('status') ?? '';
  const page = Number(query.get('page') ?? 1);
  const { data, error, loading, reload } = useResource<Page<AdminTx>>(`/admin/transactions${qs({ type, status, q: term, page })}`);
  return (
    <>
      <PageHeader
        title="Money desk"
        subtitle="Deposits, withdrawals, adjustments and Bolt Funded fees."
        actions={
          <Button variant="primary" onClick={() => setAdjusting(true)}>
            <LuPlus className="h-4 w-4" /> Adjustment
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setQuery({ page: null }); }} placeholder="Email, name, MT5 login or #" />
        <FilterSelect label="Type" value={type} onChange={(v) => setQuery({ type: v, page: null })} options={[
          { value: '', label: 'All types' }, { value: 'deposit', label: 'Deposits' }, { value: 'withdrawal', label: 'Withdrawals' },
          { value: 'adjustment', label: 'Adjustments' }, { value: 'ib_commission', label: 'IB commissions' }, { value: 'funded_fee', label: 'Bolt Funded fees' },
        ]} />
        <FilterSelect label="Status" value={status} onChange={(v) => setQuery({ status: v, page: null })} options={[
          { value: '', label: 'Any status' }, { value: 'pending', label: 'Pending' }, { value: 'awaiting_payment', label: 'Awaiting payment' },
          { value: 'processing', label: 'Processing' }, { value: 'completed', label: 'Completed' }, { value: 'rejected', label: 'Rejected' },
          { value: 'failed', label: 'Failed' }, { value: 'cancelled', label: 'Cancelled' },
        ]} />
      </div>
      <ErrorNote error={error} onRetry={reload} />
      <div className="card mt-4 overflow-hidden">
        {loading && !data ? (
          <Spinner />
        ) : (
          <>
            <Table rows={data?.items ?? []} columns={cols} onRow={(t) => navigate(`/transactions/${t.id}`)} empty={<Empty title="No transactions match" />} />
            {data && data.total > 0 && <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={(p) => setQuery({ page: p })} />}
          </>
        )}
      </div>
      {adjusting && <Adjustment open={adjusting} onClose={() => setAdjusting(false)} />}
    </>
  );
}

export function TransactionDetail({ id }: { id: string }) {
  const toast = useToast();
  const { data: t, error, loading, reload, set } = useResource<AdminTx>(`/admin/transactions/${id}`);
  const [dialog, setDialog] = useState<'complete' | 'reject' | null>(null);
  const [text, setText] = useState('');
  const { busy, run } = useAction();

  if (loading && !t) return <Spinner />;
  if (!t) return <ErrorNote error={error} onRetry={reload} />;

  const act = async (path: string, body?: unknown, done?: string) => {
    const res = await run(() => api<AdminTx>(`/admin/transactions/${t.id}/${path}`, { method: 'POST', body }));
    if (res.ok) {
      set(res.value);
      setDialog(null);
      setText('');
      toast('ok', done ?? 'Saved.');
    } else toast('error', res.error.message);
  };

  const isWithdrawal = t.type === 'withdrawal';
  const isDeposit = t.type === 'deposit';
  return (
    <>
      <Link to="/transactions" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
        <LuArrowLeft className="h-4 w-4" /> Money desk
      </Link>
      <PageHeader
        title={`${label(t.type)} #${t.id}`}
        subtitle={
          <span className="flex items-center gap-2">
            <span className="text-lg font-bold text-fg">{money(t.amount, t.currency)}</span> <StatusBadge status={t.status} />
          </span>
        }
        actions={
          <>
            {isWithdrawal && t.status === 'pending' && (
              <Button variant="primary" busy={busy} onClick={() => window.confirm('Approve this withdrawal? MT5 is debited now when it is connected.') && void act('approve', undefined, 'Approved. Send the payout, then mark it paid.')}>
                Approve
              </Button>
            )}
            {isWithdrawal && t.status === 'processing' && (
              <Button variant="primary" onClick={() => setDialog('complete')}>
                Mark paid
              </Button>
            )}
            {isDeposit && t.status === 'processing' && (
              <>
                <Button busy={busy} onClick={() => void act('retry-credit', undefined, 'Credit retried.')}>
                  Retry MT5 credit
                </Button>
                <Button variant="primary" onClick={() => setDialog('complete')}>
                  Mark credited
                </Button>
              </>
            )}
            {((isWithdrawal && ['pending', 'processing'].includes(t.status)) || (!isWithdrawal && ['pending', 'awaiting_payment', 'processing'].includes(t.status) && t.type !== 'adjustment' && t.type !== 'ib_commission')) && (
              <Button variant="danger" onClick={() => setDialog('reject')}>
                {isWithdrawal && t.status === 'processing' ? 'Fail & refund' : 'Reject'}
              </Button>
            )}
          </>
        }
      />
      {t.admin_note && <p className="mb-6 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">{t.admin_note}</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Details">
          <Dl
            items={[
              ['Client', <Link to={`/clients/${t.user_id}`} className="text-bolt hover:underline">{t.user_name} · {t.user_email}</Link>],
              ['MT5 account', t.account_login ? <span className="font-mono">{t.account_login}</span> : '—'],
              ['Method', label(t.method)],
              ['Provider', t.provider ? `${t.provider} · ${t.provider_ref ?? ''}` : '—'],
              ['MT5 deal', t.mt5_ticket],
              ['Reference', t.reference],
              ['Created', dateTime(t.created_at)],
              ['Processed', dateTime(t.processed_at)],
              ['Note to client', t.note],
              ['Bolt Funded', t.challenge_id ? <Link to={`/challenges/${t.challenge_id}`} className="text-bolt hover:underline">Evaluation #{t.challenge_id}</Link> : '—'],
            ]}
          />
        </Section>
        {isWithdrawal && (
          <Section title="Payout destination">
            {t.destination && Object.keys(t.destination).length ? (
              <Dl items={Object.entries(t.destination).map(([k, v]): [string, ReactNode] => [label(k), <span className="font-mono break-all">{v}</span>])} />
            ) : (
              <p className="text-sm text-fg-muted">Return to the card used for deposits (process the refund in the Stripe dashboard).</p>
            )}
            <p className="mt-4 text-xs text-fg-subtle">Always confirm the destination belongs to the verified client before sending funds.</p>
          </Section>
        )}
      </div>

      <Modal title={isWithdrawal ? 'Mark withdrawal paid' : 'Mark deposit credited'} open={dialog === 'complete'} onClose={() => setDialog(null)}>
        <div className="space-y-4">
          <TextInput
            label={isWithdrawal ? 'Payout reference (blockchain hash, bank reference…)' : 'MT5 deal number'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant="primary" busy={busy} onClick={() => void act('complete', { reference: text || null }, isWithdrawal ? 'Marked paid. The client has been emailed.' : 'Marked credited.')}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
      <Modal title="Reject" open={dialog === 'reject'} onClose={() => setDialog(null)}>
        <div className="space-y-4">
          <TextArea label="Reason (sent to the client)" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          {isWithdrawal && t.status === 'processing' && <p className="text-sm text-warn">The amount already debited will be returned to the MT5 account.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant="danger" busy={busy} disabled={text.trim().length < 3} onClick={() => void act('reject', { reason: text }, 'Rejected. The client has been emailed.')}>
              Reject
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
