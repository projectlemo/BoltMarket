import { ErrorNote, PageHeader, Section, Spinner, Stat } from '../components/ui';
import { useAuth } from '../lib/auth';
import { count, money } from '../lib/format';
import { useResource } from '../lib/hooks';
import type { Overview } from '../lib/types';

function SignupChart({ data }: { data: Overview['signups_14d'] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((n, d) => n + d.count, 0);
  return (
    <figure>
      <div className="flex h-40 items-end gap-1.5" role="img" aria-label={`New client registrations over the last 14 days: ${total} in total`}>
        {data.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end">
            <div className="rounded-t-[4px] bg-bolt/80 transition-colors group-hover:bg-bolt" style={{ height: `${Math.max(d.count ? 6 : 2, (d.count / max) * 100)}%` }} />
            <span className="pointer-events-none absolute -top-7 start-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-surface-3 px-2 py-1 text-xs group-hover:block">
              {d.count} · {d.date.slice(5)}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="mt-2 flex justify-between text-xs text-fg-subtle">
        <span>{data[0]?.date.slice(5)}</span>
        <span>{total} in 14 days</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </figcaption>
    </figure>
  );
}

export default function Dashboard() {
  const { can, me } = useAuth();
  const { data, error, loading, reload } = useResource<Overview>('/admin/overview');
  return (
    <>
      <PageHeader title={`Hello, ${me?.full_name.split(' ')[0] ?? ''}`} subtitle="What needs attention right now." />
      <ErrorNote error={error} onRetry={reload} />
      {loading && !data ? (
        <Spinner />
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {can('kyc') && <Stat label="Verifications to review" value={count(data.kyc_pending)} href="/kyc" tone={data.kyc_pending ? 'attention' : undefined} />}
            {can('finance') && (
              <Stat
                label="Withdrawals to approve"
                value={count(data.withdrawals_pending)}
                hint={money(data.withdrawals_pending_amount)}
                href="/transactions?type=withdrawal&status=pending"
                tone={data.withdrawals_pending ? 'attention' : undefined}
              />
            )}
            {can('finance') && <Stat label="Payouts to send" value={count(data.withdrawals_to_pay)} href="/transactions?type=withdrawal&status=processing" tone={data.withdrawals_to_pay ? 'attention' : undefined} />}
            {can('finance') && <Stat label="Deposits to review" value={count(data.deposits_to_review)} hint="paid, not yet credited" href="/transactions?type=deposit&status=processing" tone={data.deposits_to_review ? 'attention' : undefined} />}
            {can('finance') && <Stat label="MT5 accounts waiting" value={count(data.accounts_pending)} hint="pending or failed" href="/accounts?status=pending" tone={data.accounts_pending ? 'attention' : undefined} />}
            {can('finance') && <Stat label="Evaluations to start" value={count(data.challenges_to_activate)} hint={`${data.challenges_flagged} flagged`} href="/challenges?status=pending_activation" />}
            {can('support') && <Stat label="Open tickets" value={count(data.tickets_open)} href="/tickets?status=open" tone={data.tickets_open ? 'attention' : undefined} />}
            {can('support') && <Stat label="New messages" value={count(data.messages_new)} href="/messages?status=new" />}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Section title="New clients" className="lg:col-span-2">
              <SignupChart data={data.signups_14d} />
            </Section>
            <Section title="Totals">
              <dl className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-fg-subtle">Clients</dt>
                  <dd className="font-semibold">{count(data.clients)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fg-subtle">New this week</dt>
                  <dd className="font-semibold">{count(data.new_clients_7d)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fg-subtle">Deposits, 24 h</dt>
                  <dd className="font-semibold">{money(data.deposits_24h_amount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fg-subtle">Deposits, 7 days</dt>
                  <dd className="font-semibold">{money(data.deposits_7d_amount)}</dd>
                </div>
              </dl>
            </Section>
          </div>
        </div>
      ) : null}
    </>
  );
}
