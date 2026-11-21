import clsx from 'clsx';
import { useState } from 'react';
import { LuArrowLeft, LuSend } from 'react-icons/lu';
import {
  Badge,
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
  Spinner,
  StatusBadge,
  Table,
  TextArea,
  useToast,
} from '../components/ui';
import { api } from '../lib/api';
import { ago, dateTime, label } from '../lib/format';
import { qs, useAction, useDebounced, useResource } from '../lib/hooks';
import { Link, navigate, setQuery, useLocation } from '../lib/router';
import type { ContactMessage, Page, Ticket, TicketMessage } from '../lib/types';

const ticketCols: Column<Ticket>[] = [
  { key: 'id', header: '#', render: (t) => <span className="font-mono text-fg-subtle">{t.id}</span> },
  { key: 'subject', header: 'Subject', render: (t) => <span className="font-semibold">{t.subject}</span> },
  { key: 'client', header: 'Client', render: (t) => <span><span className="block">{t.user_name}</span><span className="block text-xs text-fg-subtle">{t.user_email}</span></span> },
  { key: 'cat', header: 'Category', render: (t) => label(t.category) },
  { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
  { key: 'updated', header: 'Last activity', render: (t) => ago(t.updated_at) },
];

export function Tickets() {
  const { query } = useLocation();
  const [q, setQ] = useState(query.get('q') ?? '');
  const term = useDebounced(q);
  const status = query.get('status') ?? 'open';
  const page = Number(query.get('page') ?? 1);
  const { data, error, loading, reload } = useResource<Page<Ticket>>(`/admin/tickets${qs({ status, q: term, page })}`);
  return (
    <>
      <PageHeader title="Tickets" subtitle="Open tickets wait for a reply; answered tickets wait for the client." />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setQuery({ page: null }); }} placeholder="Subject, email or #" />
        <FilterSelect label="Status" value={status} onChange={(v) => setQuery({ status: v, page: null })} options={[
          { value: 'open', label: 'Needs reply' }, { value: 'answered', label: 'Answered' }, { value: 'closed', label: 'Closed' }, { value: '', label: 'All' },
        ]} />
      </div>
      <ErrorNote error={error} onRetry={reload} />
      <div className="card mt-4 overflow-hidden">
        {loading && !data ? (
          <Spinner />
        ) : (
          <>
            <Table rows={data?.items ?? []} columns={ticketCols} onRow={(t) => navigate(`/tickets/${t.id}`)} empty={<Empty title="Inbox zero">No tickets with this status.</Empty>} />
            {data && data.total > 0 && <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={(p) => setQuery({ page: p })} />}
          </>
        )}
      </div>
    </>
  );
}

export function TicketThread({ id }: { id: string }) {
  const toast = useToast();
  const { data, error, loading, reload, set } = useResource<{ ticket: Ticket; messages: TicketMessage[] }>(`/admin/tickets/${id}`);
  const [reply, setReply] = useState('');
  const { busy, run } = useAction();
  if (loading && !data) return <Spinner />;
  if (!data) return <ErrorNote error={error} onRetry={reload} />;
  const { ticket } = data;

  const send = async () => {
    const res = await run(() => api<TicketMessage>(`/admin/tickets/${ticket.id}/messages`, { body: { body: reply } }));
    if (res.ok) {
      set({ ticket: { ...ticket, status: 'answered' }, messages: [...data.messages, res.value] });
      setReply('');
      toast('ok', 'Reply sent. The client has been emailed.');
    } else toast('error', res.error.message);
  };
  const setStatus = async (status: 'open' | 'closed') => {
    const res = await run(() => api<Ticket>(`/admin/tickets/${ticket.id}/status`, { body: { status } }));
    if (res.ok) set({ ...data, ticket: { ...ticket, status: res.value.status } });
    else toast('error', res.error.message);
  };

  return (
    <>
      <Link to="/tickets" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
        <LuArrowLeft className="h-4 w-4" /> Tickets
      </Link>
      <PageHeader
        title={ticket.subject}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link to={`/clients/${ticket.user_id}`} className="hover:underline">
              {ticket.user_name} · {ticket.user_email}
            </Link>
            <StatusBadge status={ticket.status} />
            <Badge>{label(ticket.category)}</Badge>
            {ticket.user_language === 'ar' && <Badge tone="blue">writes in Arabic</Badge>}
          </span>
        }
        actions={
          ticket.status === 'closed' ? (
            <Button busy={busy} onClick={() => void setStatus('open')}>
              Reopen
            </Button>
          ) : (
            <Button busy={busy} onClick={() => void setStatus('closed')}>
              Close ticket
            </Button>
          )
        }
      />
      <ol className="space-y-4">
        {data.messages.map((m) => (
          <li key={m.id} className={clsx('card max-w-3xl p-4', m.is_staff && 'ms-auto border-bolt/30 bg-bolt/[0.04]')}>
            <p className="mb-2 text-xs text-fg-subtle">
              <span className="font-semibold text-fg-muted">{m.is_staff ? `${m.author_name || 'Support'} (staff)` : m.author_name}</span> · {dateTime(m.created_at)}
            </p>
            <p className="whitespace-pre-wrap text-sm leading-6" dir="auto">
              {m.body}
            </p>
          </li>
        ))}
      </ol>
      {ticket.status !== 'closed' && (
        <div className="card mt-6 max-w-3xl p-4">
          <TextArea label="Reply to the client" value={reply} onChange={(e) => setReply(e.target.value)} rows={5} dir="auto" />
          <div className="mt-3 flex justify-end">
            <Button variant="primary" busy={busy} disabled={reply.trim().length < 2} onClick={() => void send()}>
              <LuSend className="h-4 w-4" /> Send reply
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

const msgCols: Column<ContactMessage>[] = [
  { key: 'from', header: 'From', render: (m) => <span><span className="block font-semibold">{m.name}</span><span className="block text-xs text-fg-subtle">{m.email}</span></span> },
  { key: 'subject', header: 'Subject', render: (m) => m.subject },
  { key: 'topic', header: 'Topic', render: (m) => label(m.topic) },
  { key: 'lang', header: 'Lang', render: (m) => m.language.toUpperCase() },
  { key: 'status', header: 'Status', render: (m) => <StatusBadge status={m.status} /> },
  { key: 'date', header: 'Received', render: (m) => dateTime(m.created_at) },
];

export function Messages({ openId }: { openId?: string }) {
  const toast = useToast();
  const { query } = useLocation();
  const status = query.get('status') ?? 'new';
  const page = Number(query.get('page') ?? 1);
  const { data, error, loading, reload, set } = useResource<Page<ContactMessage>>(`/admin/messages${qs({ status, page })}`);
  const single = useResource<ContactMessage>(openId ? `/admin/messages/${openId}` : null);
  const { busy, run } = useAction();
  const open = openId ? single.data : null;

  const mark = async (m: ContactMessage, next: 'new' | 'handled') => {
    const res = await run(() => api<ContactMessage>(`/admin/messages/${m.id}/status`, { body: { status: next } }));
    if (res.ok) {
      single.set(res.value);
      if (data) set({ ...data, items: data.items.map((x) => (x.id === m.id ? res.value : x)) });
      toast('ok', next === 'handled' ? 'Marked as handled.' : 'Moved back to new.');
    } else toast('error', res.error.message);
  };

  return (
    <>
      <PageHeader title="Messages" subtitle="Contact form submissions from the website. Reply from your support mailbox." />
      <div className="mb-4">
        <FilterSelect label="Status" value={status} onChange={(v) => setQuery({ status: v, page: null })} options={[{ value: 'new', label: 'New' }, { value: 'handled', label: 'Handled' }, { value: '', label: 'All' }]} />
      </div>
      <ErrorNote error={error} onRetry={reload} />
      <div className="card mt-4 overflow-hidden">
        {loading && !data ? (
          <Spinner />
        ) : (
          <>
            <Table rows={data?.items ?? []} columns={msgCols} onRow={(m) => navigate(`/messages/${m.id}`)} empty={<Empty title="No messages here" />} />
            {data && data.total > 0 && <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={(p) => setQuery({ page: p })} />}
          </>
        )}
      </div>
      {open && (
        <Modal title={open.subject} open onClose={() => navigate('/messages')}>
          <Dl items={[['From', `${open.name} <${open.email}>`], ['Topic', label(open.topic)], ['Language', open.language === 'ar' ? 'Arabic' : 'English'], ['Received', dateTime(open.created_at)]]} />
          <p className="mt-5 whitespace-pre-wrap rounded-xl border border-line bg-ink p-4 text-sm leading-6" dir="auto">
            {open.message}
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <a className="inline-flex h-10 items-center rounded-xl border border-line-strong bg-surface-2 px-4 text-sm font-semibold hover:bg-surface-3" href={`mailto:${open.email}?subject=${encodeURIComponent(`Re: ${open.subject}`)}`}>
              Reply by email
            </a>
            {open.status === 'new' ? (
              <Button variant="primary" busy={busy} onClick={() => void mark(open, 'handled')}>
                Mark handled
              </Button>
            ) : (
              <Button busy={busy} onClick={() => void mark(open, 'new')}>
                Move back to new
              </Button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
