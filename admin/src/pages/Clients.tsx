import { useState } from 'react';
import { LuUserPlus } from 'react-icons/lu';
import {
  Badge,
  Button,
  type Column,
  Empty,
  ErrorNote,
  FilterSelect,
  Modal,
  PageHeader,
  Pager,
  SearchBox,
  Select,
  Spinner,
  StatusBadge,
  Table,
  TextInput,
  useToast,
} from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ago, date } from '../lib/format';
import { qs, useDebounced, useResource } from '../lib/hooks';
import { navigate, setQuery, useLocation } from '../lib/router';
import type { AdminUser, Page } from '../lib/types';

const columns: Column<AdminUser>[] = [
  {
    key: 'name',
    header: 'Client',
    render: (u) => (
      <span className="block min-w-0">
        <span className="block truncate font-semibold">{u.full_name}</span>
        <span className="block truncate text-xs text-fg-subtle">{u.email}</span>
      </span>
    ),
  },
  { key: 'country', header: 'Country', render: (u) => u.country },
  { key: 'kyc', header: 'Verification', render: (u) => <StatusBadge status={u.kyc_status} /> },
  { key: 'status', header: 'Status', render: (u) => <StatusBadge status={u.status} /> },
  { key: 'role', header: 'Role', render: (u) => (u.role === 'client' ? <span className="text-fg-subtle">client</span> : <Badge tone="yellow">{u.role}</Badge>) },
  { key: 'joined', header: 'Joined', render: (u) => date(u.created_at) },
  { key: 'seen', header: 'Last login', render: (u) => <span className="text-fg-subtle">{ago(u.last_login_at)}</span> },
];

function NewStaff({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (u: AdminUser) => void }) {
  const [form, setForm] = useState({ full_name: '', email: '', role: 'support', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      onCreated(await api<AdminUser>('/admin/users', { body: form }));
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fields);
        setError(e.message);
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Add a staff login" open={open} onClose={onClose}>
      <div className="space-y-4">
        <TextInput label="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} error={errors.full_name} />
        <TextInput label="Work email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
        <Select
          label="Role"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          options={[
            { value: 'support', label: 'Support — tickets, messages, blog' },
            { value: 'compliance', label: 'Compliance — verification, client status, audit' },
            { value: 'finance', label: 'Finance — money desk, MT5 accounts, Bolt Funded' },
            { value: 'admin', label: 'Administrator — everything' },
          ]}
        />
        <TextInput
          label="Temporary password"
          type="text"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={errors.password}
          hint="10+ characters with a letter and a number. Share it privately; they will set up 2FA at first sign-in."
          autoComplete="off"
        />
        <ErrorNote error={error && !Object.keys(errors).length ? error : null} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" busy={busy} onClick={() => void save()}>
            Create login
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function Clients() {
  const { query } = useLocation();
  const { can } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState(query.get('q') ?? '');
  const [adding, setAdding] = useState(false);
  const term = useDebounced(q);
  const page = Number(query.get('page') ?? 1);
  const filters = { kyc: query.get('kyc') ?? '', role: query.get('role') ?? '', status: query.get('status') ?? '' };
  const { data, error, loading, reload } = useResource<Page<AdminUser>>(`/admin/users${qs({ q: term, ...filters, page })}`);

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Search by name, email or client number."
        actions={
          can('users.role') && (
            <Button variant="primary" onClick={() => setAdding(true)}>
              <LuUserPlus className="h-4 w-4" /> Add staff
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setQuery({ page: null }); }} placeholder="Search clients" />
        <FilterSelect label="Verification" value={filters.kyc} onChange={(v) => setQuery({ kyc: v, page: null })} options={[
          { value: '', label: 'Any verification' }, { value: 'none', label: 'Not started' }, { value: 'draft', label: 'Uploading' },
          { value: 'pending', label: 'Pending review' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' },
        ]} />
        <FilterSelect label="Status" value={filters.status} onChange={(v) => setQuery({ status: v, page: null })} options={[
          { value: '', label: 'Any status' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' },
        ]} />
        <FilterSelect label="Role" value={filters.role} onChange={(v) => setQuery({ role: v, page: null })} options={[
          { value: '', label: 'Clients and staff' }, { value: 'client', label: 'Clients' }, { value: 'support', label: 'Support' },
          { value: 'compliance', label: 'Compliance' }, { value: 'finance', label: 'Finance' }, { value: 'admin', label: 'Administrators' },
        ]} />
      </div>
      <ErrorNote error={error} onRetry={reload} />
      <div className="card mt-4 overflow-hidden">
        {loading && !data ? (
          <Spinner />
        ) : (
          <>
            <Table rows={data?.items ?? []} columns={columns} onRow={(u) => navigate(`/clients/${u.id}`)} empty={<Empty title="No matching clients">Try another name or remove a filter.</Empty>} />
            {data && data.total > 0 && <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={(p) => setQuery({ page: p })} />}
          </>
        )}
      </div>
      <NewStaff
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(u) => {
          setAdding(false);
          toast('ok', `${u.full_name} can now sign in as ${u.role}.`);
          navigate(`/clients/${u.id}`);
        }}
      />
    </>
  );
}
