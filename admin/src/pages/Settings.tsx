import { useState } from 'react';
import { LuCircleCheck, LuCircleX } from 'react-icons/lu';
import { Badge, Button, type Column, Dl, Empty, ErrorNote, FilterSelect, PageHeader, Pager, Section, Spinner, Table, TextInput, useToast } from '../components/ui';
import { api, API_URL } from '../lib/api';
import { useAuth } from '../lib/auth';
import { dateTime } from '../lib/format';
import { qs, useAction, useDebounced, useResource } from '../lib/hooks';
import { setQuery, useLocation } from '../lib/router';
import type { AuditEntry, Page, SystemStatus } from '../lib/types';
import { TwoFactorSetup } from './Auth';

const auditCols: Column<AuditEntry>[] = [
  { key: 'when', header: 'When', render: (a) => <span className="whitespace-nowrap">{dateTime(a.created_at)}</span> },
  { key: 'who', header: 'Who', render: (a) => a.actor_email ?? (a.actor_id ? `#${a.actor_id}` : <span className="text-fg-subtle">system</span>) },
  { key: 'action', header: 'Action', render: (a) => <span className="font-mono text-xs">{a.action}</span> },
  { key: 'target', header: 'Target', render: (a) => (a.target_type ? `${a.target_type} #${a.target_id}` : '—') },
  {
    key: 'data',
    header: 'Details',
    render: (a) =>
      a.data && Object.keys(a.data).length ? (
        <span className="block max-w-md truncate font-mono text-xs text-fg-subtle" title={JSON.stringify(a.data)}>
          {JSON.stringify(a.data)}
        </span>
      ) : (
        '—'
      ),
  },
  { key: 'ip', header: 'IP', render: (a) => <span className="font-mono text-xs text-fg-subtle">{a.ip ?? '—'}</span> },
];

export function Audit() {
  const { query } = useLocation();
  const [action, setAction] = useState(query.get('action') ?? '');
  const debounced = useDebounced(action);
  const target = query.get('target_type') ?? '';
  const page = Number(query.get('page') ?? 1);
  const { data, error, loading, reload } = useResource<Page<AuditEntry>>(`/admin/audit${qs({ action: debounced, target_type: target, target_id: query.get('target_id'), page })}`);
  return (
    <>
      <PageHeader title="Audit log" subtitle="Every sign-in, review, money movement and setting change, newest first." />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input h-10 w-full sm:w-72" placeholder="Action starts with… e.g. withdrawal." value={action} onChange={(e) => { setAction(e.target.value); setQuery({ page: null }); }} aria-label="Filter by action" />
        <FilterSelect label="Target" value={target} onChange={(v) => setQuery({ target_type: v, page: null })} options={[
          { value: '', label: 'Any target' }, { value: 'user', label: 'Users' }, { value: 'transaction', label: 'Transactions' }, { value: 'trading_account', label: 'MT5 accounts' },
          { value: 'kyc_document', label: 'KYC documents' }, { value: 'ticket', label: 'Tickets' }, { value: 'challenge', label: 'Evaluations' }, { value: 'post', label: 'Blog posts' },
        ]} />
      </div>
      <ErrorNote error={error} onRetry={reload} />
      <div className="card mt-4 overflow-hidden">
        {loading && !data ? (
          <Spinner />
        ) : (
          <>
            <Table rows={data?.items ?? []} columns={auditCols} empty={<Empty title="No entries" />} />
            {data && data.total > 0 && <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={(p) => setQuery({ page: p })} />}
          </>
        )}
      </div>
    </>
  );
}

function Flag({ on, children }: { on: boolean; children: string }) {
  return (
    <span className="flex items-center gap-2">
      {on ? <LuCircleCheck className="h-4 w-4 text-up" aria-label="on" /> : <LuCircleX className="h-4 w-4 text-fg-subtle" aria-label="off" />}
      {children}
    </span>
  );
}

export function System() {
  const toast = useToast();
  const { data, error, loading, reload } = useResource<SystemStatus>('/admin/system');
  const { busy, run } = useAction();
  if (loading && !data) return <Spinner />;
  if (!data) return <ErrorNote error={error} onRetry={reload} />;
  const retry = async () => {
    const res = await run(() => api<{ requeued: number }>('/admin/system/outbox/retry', { method: 'POST' }));
    if (res.ok) {
      toast('ok', `${res.value.requeued} email(s) queued again.`);
      reload();
    } else toast('error', res.error.message);
  };
  return (
    <>
      <PageHeader title="System" subtitle="Which integrations are connected. Secrets are never shown; change them in the API host's environment settings." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Platform">
          <Dl
            items={[
              ['API', <span className="font-mono text-xs break-all">{API_URL}</span>],
              ['Version', data.version],
              ['Environment', <Badge tone={data.environment === 'production' ? 'green' : 'orange'}>{data.environment}</Badge>],
              ['Database', `${data.database} · ${data.migrations.length} migration(s)`],
              ['Registration', data.registration_open ? 'Open' : 'Closed'],
              ['Restricted countries', data.restricted_countries.length ? data.restricted_countries.join(', ') : 'None set'],
            ]}
          />
        </Section>
        <Section title="MetaTrader 5 and prices">
          <Dl
            items={[
              ['MT5 connection', <Flag on={data.mt5.enabled}>{data.mt5.mode}</Flag>],
              ['Live server', data.mt5.server_live],
              ['Demo server', data.mt5.server_demo],
              ['Price feed', <Flag on={data.quotes.mode !== 'disabled'}>{data.quotes.mode}</Flag>],
              ['Symbols with prices', `${data.quotes.live_symbols} of ${data.quotes.symbols}`],
              ['Last price update', dateTime(data.quotes.last_update)],
              ['Live viewers', String(data.quotes.clients)],
            ]}
          />
        </Section>
        <Section title="Payments and verification">
          <Dl
            items={[
              ['Card deposits (Stripe)', <Flag on={data.payments.card_stripe}>{data.payments.card_stripe ? 'Connected' : 'Not configured'}</Flag>],
              ['Crypto deposits (NOWPayments)', <Flag on={data.payments.crypto_nowpayments}>{data.payments.crypto_nowpayments ? (data.payments.nowpayments_sandbox ? 'Sandbox' : 'Connected') : 'Not configured'}</Flag>],
              ['KYC', `${data.kyc.provider} · files in ${data.kyc.storage}`],
              ['KYC before deposit', data.kyc.require_for_deposit ? 'Required' : 'Not required'],
            ]}
          />
        </Section>
        <Section title="Email and security" actions={<Button size="sm" busy={busy} onClick={() => void retry()}>Retry failed emails</Button>}>
          <Dl
            items={[
              ['SMTP', <Flag on={data.email.smtp}>{data.email.smtp ? 'Connected' : 'Not configured — emails are not sent'}</Flag>],
              ['Staff notifications inbox', <Flag on={data.email.support_inbox}>{data.email.support_inbox ? 'Set' : 'Not set'}</Flag>],
              ['Email queue', Object.entries(data.email.outbox).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'Empty'],
              ['Staff 2FA required', data.security.admin_require_2fa ? 'Yes' : 'No'],
              ['Data encryption key', <Flag on={data.security.data_key_set}>{data.security.data_key_set ? 'Set' : 'Development key in use'}</Flag>],
              ['Rebuild site on publish', <Flag on={data.site_rebuild}>{data.site_rebuild ? 'On' : 'Off'}</Flag>],
            ]}
          />
        </Section>
      </div>
    </>
  );
}

export function Profile() {
  const { me, refreshMe } = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState({ current_password: '', new_password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [disable, setDisable] = useState({ password: '', code: '' });
  const { busy, run } = useAction();
  if (!me) return null;

  const changePassword = async () => {
    setErrors({});
    const res = await run(() => api('/me/password', { body: pw }));
    if (res.ok) {
      setPw({ current_password: '', new_password: '' });
      toast('ok', 'Password changed. Other sessions were signed out.');
    } else setErrors(res.error.fields);
  };
  const turnOff = async () => {
    const res = await run(() => api('/me/2fa/disable', { body: disable }));
    if (res.ok) {
      toast('ok', 'Two-factor authentication is off.');
      await refreshMe();
    } else toast('error', res.error.message);
  };

  return (
    <>
      <PageHeader title="Your login" subtitle={`${me.email} · ${me.role}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Two-factor authentication">
          {me.totp_enabled ? (
            <div className="space-y-4">
              <p className="flex items-center gap-2 text-sm text-up">
                <LuCircleCheck className="h-4 w-4" /> On. You sign in with your password and an authenticator code.
              </p>
              <details className="text-sm">
                <summary className="cursor-pointer text-fg-subtle hover:text-fg">Turn it off</summary>
                <div className="mt-3 space-y-3">
                  <TextInput label="Password" type="password" value={disable.password} onChange={(e) => setDisable({ ...disable, password: e.target.value })} autoComplete="current-password" />
                  <TextInput label="Code" value={disable.code} onChange={(e) => setDisable({ ...disable, code: e.target.value })} autoComplete="one-time-code" />
                  <Button variant="danger" busy={busy} onClick={() => void turnOff()}>
                    Turn off
                  </Button>
                </div>
              </details>
            </div>
          ) : (
            <TwoFactorSetup onDone={() => void refreshMe()} />
          )}
        </Section>
        <Section title="Password">
          <div className="space-y-4">
            <TextInput label="Current password" type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} error={errors.current_password} />
            <TextInput label="New password" type="password" autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} error={errors.new_password} hint="At least 10 characters with a letter and a number." />
            <Button variant="primary" busy={busy} disabled={!pw.current_password || pw.new_password.length < 10} onClick={() => void changePassword()}>
              Change password
            </Button>
          </div>
        </Section>
      </div>
    </>
  );
}
