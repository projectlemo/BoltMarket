import { useState } from 'react';
import { LuRefreshCw } from 'react-icons/lu';
import {
  Button,
  type Column,
  Empty,
  ErrorNote,
  FilterSelect,
  Modal,
  PageHeader,
  Pager,
  SearchBox,
  Spinner,
  StatusBadge,
  Table,
  TextInput,
  useToast,
} from '../components/ui';
import { api } from '../lib/api';
import { dateTime, label, money } from '../lib/format';
import { qs, useAction, useDebounced, useResource } from '../lib/hooks';
import { Link, setQuery, useLocation } from '../lib/router';
import type { AdminAccount, Page } from '../lib/types';

function AccountActions({ acc, onChange }: { acc: AdminAccount; onChange: (a: AdminAccount) => void }) {
  const toast = useToast();
  const [linking, setLinking] = useState(false);
  const [login, setLogin] = useState('');
  const [server, setServer] = useState('');
  const { busy, run } = useAction();
  const post = async (path: string, body?: unknown, done = 'Saved.') => {
    const res = await run(() => api<AdminAccount>(`/admin/accounts/${acc.id}/${path}`, { method: 'POST', body }));
    if (res.ok) {
      onChange(res.value);
      setLinking(false);
      toast('ok', done);
    } else toast('error', res.error.message);
  };
  const waiting = acc.status === 'pending' || acc.status === 'failed';
  return (
    <div className="flex flex-wrap justify-end gap-1.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {waiting && (
        <>
          <Button size="sm" busy={busy} onClick={() => void post('provision', undefined, 'Account created in MT5.')}>
            Create in MT5
          </Button>
          <Button size="sm" onClick={() => setLinking(true)}>
            Link login
          </Button>
        </>
      )}
      {acc.status === 'active' && (
        <>
          <Button size="sm" variant="ghost" busy={busy} onClick={() => void post('sync', undefined, 'Balance refreshed.')} aria-label={`Refresh balance of ${acc.login}`}>
            <LuRefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="danger" busy={busy} onClick={() => window.confirm(`Disable MT5 account ${acc.login}?`) && void post('status', { status: 'disabled' }, 'Account disabled.')}>
            Disable
          </Button>
        </>
      )}
      {acc.status === 'disabled' && (
        <Button size="sm" busy={busy} onClick={() => void post('status', { status: 'active' }, 'Account enabled.')}>
          Enable
        </Button>
      )}
      <Modal title={`Link MT5 login for ${acc.user_name ?? 'client'}`} open={linking} onClose={() => setLinking(false)}>
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">
            Create the account in MT5 Administrator/Manager ({label(acc.kind)}, {label(acc.account_type)}, 1:{acc.leverage}, {acc.currency}), then record its login here.
            The client is emailed that the account is ready.
          </p>
          <TextInput label="MT5 login" inputMode="numeric" value={login} onChange={(e) => setLogin(e.target.value.replace(/\D/g, ''))} />
          <TextInput label="Server name (optional)" value={server} onChange={(e) => setServer(e.target.value)} hint="Defaults to the server configured for live/demo accounts." />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setLinking(false)}>
              Cancel
            </Button>
            <Button variant="primary" busy={busy} disabled={login.length < 3} onClick={() => void post('link', { login, server: server || null }, 'Login recorded.')}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function Accounts() {
  const { query } = useLocation();
  const [q, setQ] = useState(query.get('q') ?? '');
  const term = useDebounced(q);
  const status = query.get('status') ?? '';
  const kind = query.get('kind') ?? '';
  const page = Number(query.get('page') ?? 1);
  const { data, error, loading, reload, set } = useResource<Page<AdminAccount>>(`/admin/accounts${qs({ status, kind, q: term, page })}`);
  const replace = (a: AdminAccount) => data && set({ ...data, items: data.items.map((x) => (x.id === a.id ? a : x)) });

  const cols: Column<AdminAccount>[] = [
    { key: 'id', header: 'ID', render: (a) => <span className="font-mono text-fg-subtle">{a.id}</span> },
    {
      key: 'client',
      header: 'Client',
      render: (a) => (
        <Link to={`/clients/${a.user_id}`} className="block hover:underline">
          <span className="block font-semibold">{a.user_name}</span>
          <span className="block text-xs text-fg-subtle">{a.user_email}</span>
        </Link>
      ),
    },
    {
      key: 'login',
      header: 'Login / server',
      render: (a) => (
        <span>
          <span className="block font-mono">{a.login ?? '—'}</span>
          <span className="block text-xs text-fg-subtle">{a.server ?? a.group_name ?? ''}</span>
        </span>
      ),
    },
    { key: 'type', header: 'Type', render: (a) => `${label(a.kind)} · ${label(a.account_type)} · 1:${a.leverage}` },
    { key: 'bal', header: 'Balance / equity', render: (a) => <span className="whitespace-nowrap">{money(a.balance, a.currency)}<span className="block text-xs text-fg-subtle">{money(a.equity, a.currency)}</span></span> },
    {
      key: 'status',
      header: 'Status',
      render: (a) => (
        <span>
          <StatusBadge status={a.status} />
          {a.last_error && <span className="mt-1 block max-w-56 truncate text-xs text-down" title={a.last_error}>{a.last_error}</span>}
          <span className="mt-1 block text-xs text-fg-subtle">synced {dateTime(a.synced_at)}</span>
        </span>
      ),
    },
    { key: 'actions', header: '', className: 'text-end', render: (a) => <AccountActions acc={a} onChange={replace} /> },
  ];

  return (
    <>
      <PageHeader title="MT5 accounts" subtitle="Provision waiting accounts, link logins created by hand, and enable or disable access." />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setQuery({ page: null }); }} placeholder="Email, name or MT5 login" />
        <FilterSelect label="Status" value={status} onChange={(v) => setQuery({ status: v, page: null })} options={[
          { value: '', label: 'Any status' }, { value: 'pending', label: 'Waiting' }, { value: 'failed', label: 'Failed' },
          { value: 'active', label: 'Active' }, { value: 'disabled', label: 'Disabled' },
        ]} />
        <FilterSelect label="Kind" value={kind} onChange={(v) => setQuery({ kind: v, page: null })} options={[{ value: '', label: 'Live and demo' }, { value: 'live', label: 'Live' }, { value: 'demo', label: 'Demo' }]} />
      </div>
      <ErrorNote error={error} onRetry={reload} />
      <div className="card mt-4 overflow-hidden">
        {loading && !data ? (
          <Spinner />
        ) : (
          <>
            <Table rows={data?.items ?? []} columns={cols} empty={<Empty title="No accounts match" />} />
            {data && data.total > 0 && <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={(p) => setQuery({ page: p })} />}
          </>
        )}
      </div>
    </>
  );
}
