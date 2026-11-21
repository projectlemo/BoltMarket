import { useState } from 'react';
import { LuArrowLeft, LuBan, LuCheck, LuKeyRound, LuPencil } from 'react-icons/lu';
import {
  Badge,
  Button,
  type Column,
  Dl,
  Empty,
  ErrorNote,
  Modal,
  PageHeader,
  Section,
  Select,
  Spinner,
  StatusBadge,
  Table,
  TextArea,
  TextInput,
  useToast,
} from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { date, dateTime, DOC_LABELS, label, money, PLAN } from '../lib/format';
import { useAction, useResource } from '../lib/hooks';
import { Link, navigate } from '../lib/router';
import type { AdminAccount, AdminTx, AdminUser, ClientFile } from '../lib/types';

const accountCols: Column<AdminAccount>[] = [
  { key: 'login', header: 'Login', render: (a) => <span className="font-mono">{a.login ?? '—'}</span> },
  { key: 'type', header: 'Type', render: (a) => `${label(a.kind)} · ${label(a.account_type)}` },
  { key: 'lev', header: 'Leverage', render: (a) => `1:${a.leverage}` },
  { key: 'bal', header: 'Balance', render: (a) => <span className="whitespace-nowrap">{money(a.balance, a.currency)}</span> },
  { key: 'eq', header: 'Equity', render: (a) => <span className="whitespace-nowrap">{money(a.equity, a.currency)}</span> },
  { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
];

const txCols: Column<AdminTx>[] = [
  { key: 'id', header: '#', render: (t) => <span className="font-mono text-fg-subtle">{t.id}</span> },
  { key: 'type', header: 'Type', render: (t) => label(t.type) },
  { key: 'amount', header: 'Amount', render: (t) => <span className="whitespace-nowrap font-semibold">{money(t.amount, t.currency)}</span> },
  { key: 'method', header: 'Method', render: (t) => label(t.method) },
  { key: 'acc', header: 'Account', render: (t) => <span className="font-mono">{t.account_login ?? '—'}</span> },
  { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
  { key: 'date', header: 'Created', render: (t) => <span className="whitespace-nowrap">{dateTime(t.created_at)}</span> },
];

function EditProfile({ user, open, onClose, onSaved }: { user: AdminUser; open: boolean; onClose: () => void; onSaved: (u: AdminUser) => void }) {
  const [form, setForm] = useState({ full_name: user.full_name, phone: user.phone ?? '', country: user.country, language: user.language });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, run } = useAction();
  const save = async () => {
    const res = await run(() => api<AdminUser>(`/admin/users/${user.id}`, { method: 'PATCH', body: { ...form, phone: form.phone || null } }));
    if (res.ok) onSaved(res.value);
    else setErrors(res.error.fields);
  };
  return (
    <Modal title="Edit client details" open={open} onClose={onClose}>
      <div className="space-y-4">
        <TextInput label="Full name (as on ID)" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} error={errors.full_name} />
        <TextInput label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} />
        <TextInput label="Country (ISO code)" value={form.country} maxLength={2} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} error={errors.country} />
        <Select label="Email language" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as 'en' | 'ar' })} options={[{ value: 'en', label: 'English' }, { value: 'ar', label: 'Arabic' }]} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" busy={busy} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function ClientDetail({ id }: { id: string }) {
  const { can, me } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload, set } = useResource<ClientFile>(`/admin/users/${id}`);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const { busy, run } = useAction();

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return null;
  const u = data.user;
  const self = me?.id === u.id;

  const patch = async (body: Record<string, unknown>, done: string) => {
    const res = await run(() => api<AdminUser>(`/admin/users/${u.id}`, { method: 'PATCH', body }));
    if (res.ok) {
      set({ ...data, user: res.value });
      toast('ok', done);
    } else toast('error', res.error.message);
  };

  const addNote = async () => {
    const res = await run(() => api<ClientFile['notes'][number]>(`/admin/users/${u.id}/notes`, { body: { body: note } }));
    if (res.ok) {
      set({ ...data, notes: [res.value, ...data.notes] });
      setNote('');
    } else toast('error', res.error.message);
  };

  const reset2fa = async () => {
    if (!window.confirm(`Turn off two-factor authentication for ${u.full_name}? They will be signed out everywhere.`)) return;
    const res = await run(() => api<AdminUser>(`/admin/users/${u.id}/reset-2fa`, { method: 'POST' }));
    if (res.ok) {
      set({ ...data, user: res.value });
      toast('ok', 'Two-factor authentication was turned off.');
    } else toast('error', res.error.message);
  };

  return (
    <>
      <Link to="/clients" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
        <LuArrowLeft className="h-4 w-4" /> Clients
      </Link>
      <PageHeader
        title={u.full_name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{u.email}</span>
            <StatusBadge status={u.status} />
            <StatusBadge status={u.kyc_status} />
            {u.role !== 'client' && <Badge tone="yellow">{u.role}</Badge>}
          </span>
        }
        actions={
          <>
            {can('users.write') && (
              <Button onClick={() => setEditing(true)}>
                <LuPencil className="h-4 w-4" /> Edit
              </Button>
            )}
            {can('users.write') && !u.email_verified && (
              <Button busy={busy} onClick={() => void patch({ email_verified: true }, 'Email marked as verified.')}>
                <LuCheck className="h-4 w-4" /> Mark email verified
              </Button>
            )}
            {can('users.write') && !self && (u.status === 'active' ? (
              <Button
                variant="danger"
                busy={busy}
                onClick={() => window.confirm(`Suspend ${u.full_name}? They will be signed out and cannot log in.`) && void patch({ status: 'suspended' }, 'Client suspended.')}
              >
                <LuBan className="h-4 w-4" /> Suspend
              </Button>
            ) : (
              <Button variant="primary" busy={busy} onClick={() => void patch({ status: 'active' }, 'Client reactivated.')}>
                Reactivate
              </Button>
            ))}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section title="Profile">
            <Dl
              items={[
                ['Client number', `#${u.id}`],
                ['Country', u.country],
                ['Phone', u.phone],
                ['Language', u.language === 'ar' ? 'Arabic' : 'English'],
                ['Email', u.email_verified ? 'Verified' : 'Not verified'],
                ['Two-factor', u.totp_enabled ? 'On' : 'Off'],
                ['Joined', dateTime(u.created_at)],
                ['Last login', dateTime(u.last_login_at)],
                ['Referral code', <span className="font-mono">{u.referral_code}</span>],
                ['Referred by', data.referrer ? <Link to={`/clients/${data.referrer.id}`} className="text-bolt hover:underline">{data.referrer.full_name}</Link> : '—'],
                ['Referred clients', String(data.referrals)],
                ['Locked until', u.locked_until ? dateTime(u.locked_until) : '—'],
              ]}
            />
          </Section>

          <Section title={`MT5 accounts (${data.accounts.length})`}>
            <div className="-m-5">
              <Table rows={data.accounts} columns={accountCols} onRow={can('finance') ? (a) => navigate(`/accounts?q=${a.login ?? u.email}`) : undefined} empty={<Empty title="No trading accounts yet" />} />
            </div>
          </Section>

          <Section title="Latest transactions">
            <div className="-m-5">
              <Table rows={data.transactions} columns={txCols} onRow={can('finance') ? (t) => navigate(`/transactions/${t.id}`) : undefined} empty={<Empty title="No transactions yet" />} />
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Verification" actions={can('kyc') && data.documents.length > 0 ? <Link to={`/kyc/${u.id}`} className="text-sm font-semibold text-bolt hover:underline">Review</Link> : undefined}>
            {u.kyc_rejection_reason && <p className="mb-3 rounded-lg bg-down/10 px-3 py-2 text-sm text-down">{u.kyc_rejection_reason}</p>}
            {data.documents.length ? (
              <ul className="space-y-2 text-sm">
                {data.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2">
                    <span>{DOC_LABELS[d.doc_type]}</span>
                    <StatusBadge status={d.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-subtle">No documents uploaded.</p>
            )}
          </Section>

          <Section title="Internal notes">
            <TextArea label="Add a note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visible to staff only" rows={3} />
            <Button className="mt-3" size="sm" variant="primary" disabled={note.trim().length < 2} busy={busy} onClick={() => void addNote()}>
              Save note
            </Button>
            <ul className="mt-5 space-y-4">
              {data.notes.map((n) => (
                <li key={n.id} className="border-s-2 border-line-strong ps-3">
                  <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                  <p className="mt-1 text-xs text-fg-subtle">
                    {n.author_name ?? 'Staff'} · {dateTime(n.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          </Section>

          {(data.tickets.length > 0 || data.challenges.length > 0) && (
            <Section title="Activity">
              <ul className="space-y-2 text-sm">
                {data.tickets.map((t) => (
                  <li key={`t${t.id}`} className="flex items-center justify-between gap-2">
                    <Link to={`/tickets/${t.id}`} className="truncate hover:underline">
                      Ticket: {t.subject}
                    </Link>
                    <StatusBadge status={t.status} />
                  </li>
                ))}
                {data.challenges.map((c) => (
                  <li key={`c${c.id}`} className="flex items-center justify-between gap-2">
                    <Link to={`/challenges/${c.id}`} className="hover:underline">
                      Bolt Funded {PLAN(c.plan_size)} · {date(c.created_at)}
                    </Link>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {can('users.role') && !self && (
            <Section title="Access">
              <div className="space-y-3">
                <Select
                  label="Role"
                  value={role ?? u.role}
                  onChange={(e) => setRole(e.target.value)}
                  options={['client', 'support', 'compliance', 'finance', 'admin'].map((r) => ({ value: r, label: label(r) }))}
                />
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!role || role === u.role}
                  busy={busy}
                  onClick={() => window.confirm(`Change role to ${role}? The user will be signed out.`) && void patch({ role }, 'Role updated.').then(() => setRole(null))}
                >
                  Save role
                </Button>
                {u.totp_enabled && (
                  <Button size="sm" variant="danger" busy={busy} onClick={() => void reset2fa()}>
                    <LuKeyRound className="h-4 w-4" /> Reset two-factor
                  </Button>
                )}
              </div>
            </Section>
          )}
        </div>
      </div>
      {editing && (
        <EditProfile
          user={u}
          open={editing}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            set({ ...data, user: updated });
            setEditing(false);
            toast('ok', 'Details saved.');
          }}
        />
      )}
      {error && data && <ErrorNote error={error instanceof ApiError ? error : null} />}
    </>
  );
}
