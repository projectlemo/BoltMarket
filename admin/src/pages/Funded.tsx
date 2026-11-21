import { useState } from 'react';
import { LuTriangleAlert } from 'react-icons/lu';
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
  Select,
  Spinner,
  StatusBadge,
  Table,
  TextInput,
  useToast,
} from '../components/ui';
import { api } from '../lib/api';
import { dateTime, money, PLAN } from '../lib/format';
import { qs, useAction, useResource } from '../lib/hooks';
import { Link, navigate, setQuery, useLocation } from '../lib/router';
import type { Challenge, Page } from '../lib/types';

const NEXT: Record<Challenge['status'], { value: string; label: string }[]> = {
  awaiting_payment: [{ value: 'cancelled', label: 'Cancel' }],
  pending_activation: [{ value: 'cancelled', label: 'Cancel' }],
  phase1: [{ value: 'phase2', label: 'Passed Phase 1 → start Phase 2' }, { value: 'failed', label: 'Failed' }, { value: 'cancelled', label: 'Cancel' }],
  phase2: [{ value: 'funded', label: 'Passed Phase 2 → funded' }, { value: 'failed', label: 'Failed' }, { value: 'cancelled', label: 'Cancel' }],
  funded: [{ value: 'failed', label: 'End funded account (rule breach)' }],
  failed: [],
  cancelled: [],
};

function ChallengeDialog({ ch, onClose, onChange }: { ch: Challenge; onClose: () => void; onChange: (c: Challenge) => void }) {
  const toast = useToast();
  const [login, setLogin] = useState('');
  const [server, setServer] = useState('');
  const [next, setNext] = useState(NEXT[ch.status][0]?.value ?? '');
  const [note, setNote] = useState('');
  const { busy, run } = useAction();
  const post = async (path: string, body: unknown, done: string) => {
    const res = await run(() => api<Challenge>(`/admin/challenges/${ch.id}/${path}`, { body }));
    if (res.ok) {
      onChange(res.value);
      toast('ok', done);
    } else toast('error', res.error.message);
  };
  return (
    <Modal title={`Bolt Funded ${PLAN(ch.plan_size)} · #${ch.id}`} open onClose={onClose}>
      <div className="space-y-5">
        <Dl
          items={[
            ['Trader', <Link to={`/clients/${ch.user_id}`} className="text-bolt hover:underline">{ch.user_name}</Link>],
            ['Status', <StatusBadge status={ch.status} />],
            ['Fee paid', money(ch.fee)],
            ['MT5 login', ch.login ? <span className="font-mono">{ch.login}</span> : '—'],
            ['Equity', money(ch.equity)],
            ['Updated', dateTime(ch.updated_at)],
          ]}
        />
        {ch.breach && (
          <p className="flex gap-2 rounded-xl border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">
            <LuTriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {ch.breach}
          </p>
        )}
        {ch.note && <p className="rounded-xl border border-info/30 bg-info/10 px-3 py-2 text-sm text-info">{ch.note}</p>}
        {ch.status === 'pending_activation' && (
          <div className="space-y-3 border-t border-line pt-4">
            <p className="text-sm text-fg-muted">Payment received. Create the evaluation account automatically (MT5 connected) or enter a login you created by hand.</p>
            <TextInput label="MT5 login (leave empty to create automatically)" inputMode="numeric" value={login} onChange={(e) => setLogin(e.target.value.replace(/\D/g, ''))} />
            <TextInput label="Server (optional)" value={server} onChange={(e) => setServer(e.target.value)} />
            <Button variant="primary" busy={busy} onClick={() => void post('activate', { login: login || null, server: server || null }, 'Phase 1 started. The trader has been emailed.')}>
              Start Phase 1
            </Button>
          </div>
        )}
        {NEXT[ch.status].length > 0 && ch.status !== 'pending_activation' && (
          <div className="space-y-3 border-t border-line pt-4">
            <Select label="Move to" value={next} onChange={(e) => setNext(e.target.value)} options={NEXT[ch.status]} />
            <TextInput label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button variant="primary" busy={busy} disabled={!next} onClick={() => void post('status', { status: next, note: note || null }, 'Evaluation updated. The trader has been emailed.')}>
              Update
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function Funded({ openId }: { openId?: string }) {
  const { query } = useLocation();
  const status = query.get('status') ?? '';
  const page = Number(query.get('page') ?? 1);
  const { data, error, loading, reload, set } = useResource<Page<Challenge>>(`/admin/challenges${qs({ status, page })}`);
  const single = useResource<Challenge>(openId ? `/admin/challenges/${openId}` : null);
  const open = openId ? single.data : null;

  const cols: Column<Challenge>[] = [
    { key: 'id', header: '#', render: (c) => <span className="font-mono text-fg-subtle">{c.id}</span> },
    { key: 'trader', header: 'Trader', render: (c) => <span><span className="block font-semibold">{c.user_name}</span><span className="block text-xs text-fg-subtle">{c.user_email}</span></span> },
    { key: 'plan', header: 'Plan', render: (c) => PLAN(c.plan_size) },
    { key: 'login', header: 'MT5', render: (c) => <span className="font-mono">{c.login ?? '—'}</span> },
    { key: 'equity', header: 'Equity', render: (c) => money(c.equity) },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (
        <span className="flex items-center gap-2">
          <StatusBadge status={c.status} />
          {c.breach && <LuTriangleAlert className="h-4 w-4 text-down" aria-label="Rule breach detected" />}
          {!c.breach && c.note && <span className="h-2 w-2 rounded-full bg-info" title={c.note} />}
        </span>
      ),
    },
    { key: 'updated', header: 'Updated', render: (c) => dateTime(c.updated_at) },
  ];

  return (
    <>
      <PageHeader title="Bolt Funded" subtitle="Start paid evaluations, review rule breaches and profit targets, and move traders between phases." />
      <div className="mb-4">
        <FilterSelect label="Status" value={status} onChange={(v) => setQuery({ status: v, page: null })} options={[
          { value: '', label: 'All evaluations' }, { value: 'pending_activation', label: 'Paid — to start' }, { value: 'phase1', label: 'Phase 1' },
          { value: 'phase2', label: 'Phase 2' }, { value: 'funded', label: 'Funded' }, { value: 'failed', label: 'Failed' },
          { value: 'awaiting_payment', label: 'Awaiting payment' }, { value: 'cancelled', label: 'Cancelled' },
        ]} />
      </div>
      <ErrorNote error={error} onRetry={reload} />
      <div className="card mt-4 overflow-hidden">
        {loading && !data ? (
          <Spinner />
        ) : (
          <>
            <Table rows={data?.items ?? []} columns={cols} onRow={(c) => navigate(`/challenges/${c.id}`)} empty={<Empty title="No evaluations here yet" />} />
            {data && data.total > 0 && <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={(p) => setQuery({ page: p })} />}
          </>
        )}
      </div>
      {open && (
        <ChallengeDialog
          key={`${open.id}-${open.status}`}
          ch={open}
          onClose={() => navigate('/challenges')}
          onChange={(c) => {
            single.set(c);
            if (data) set({ ...data, items: data.items.map((x) => (x.id === c.id ? c : x)) });
          }}
        />
      )}
    </>
  );
}
