import { useEffect, useState } from 'react';
import { LuArrowLeft, LuCheck, LuDownload, LuX } from 'react-icons/lu';
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
  Section,
  Spinner,
  StatusBadge,
  Table,
  TextArea,
  TextInput,
  useToast,
} from '../components/ui';
import { api, apiBlob } from '../lib/api';
import { bytes, dateTime, DOC_LABELS } from '../lib/format';
import { qs, useAction, useResource } from '../lib/hooks';
import { Link, navigate, setQuery, useLocation } from '../lib/router';
import type { AdminUser, KycDoc, KycQueueItem, Page } from '../lib/types';

const queueCols: Column<KycQueueItem>[] = [
  {
    key: 'client',
    header: 'Client',
    render: (r) => (
      <span>
        <span className="block font-semibold">{r.full_name}</span>
        <span className="block text-xs text-fg-subtle">{r.email}</span>
      </span>
    ),
  },
  { key: 'country', header: 'Country', render: (r) => r.country },
  { key: 'docs', header: 'Documents', render: (r) => r.documents },
  { key: 'submitted', header: 'Submitted', render: (r) => dateTime(r.kyc_submitted_at) },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.kyc_status} /> },
];

export function KycQueue() {
  const { query } = useLocation();
  const status = query.get('status') ?? 'pending';
  const page = Number(query.get('page') ?? 1);
  const { data, error, loading, reload } = useResource<Page<KycQueueItem>>(`/admin/kyc${qs({ status, page })}`);
  return (
    <>
      <PageHeader title="Verification" subtitle="Oldest submissions first. Open a file to see the documents." />
      <div className="mb-4">
        <FilterSelect
          label="Status"
          value={status}
          onChange={(v) => setQuery({ status: v, page: null })}
          options={[
            { value: 'pending', label: 'Waiting for review' },
            { value: 'draft', label: 'Still uploading' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
          ]}
        />
      </div>
      <ErrorNote error={error} onRetry={reload} />
      <div className="card mt-4 overflow-hidden">
        {loading && !data ? (
          <Spinner />
        ) : (
          <>
            <Table rows={data?.items ?? []} columns={queueCols} onRow={(r) => navigate(`/kyc/${r.id}`)} empty={<Empty title="Nothing here">No clients with this verification status.</Empty>} />
            {data && data.total > 0 && <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={(p) => setQuery({ page: p })} />}
          </>
        )}
      </div>
    </>
  );
}

function DocPreview({ doc }: { doc: KycDoc }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let revoked: string | null = null;
    apiBlob(`/admin/kyc/documents/${doc.id}/file`)
      .then((blob) => {
        revoked = URL.createObjectURL(blob);
        setUrl(revoked);
      })
      .catch(() => setFailed(true));
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [doc.id]);
  if (failed) return <p className="text-sm text-down">The file could not be loaded.</p>;
  if (!url) return <Spinner label="Decrypting" />;
  return (
    <div>
      {doc.content_type === 'application/pdf' ? (
        <object data={url} type="application/pdf" className="h-[60vh] w-full rounded-xl bg-white" aria-label={doc.filename}>
          <p className="text-sm">PDF preview is not available in this browser.</p>
        </object>
      ) : (
        <img src={url} alt={DOC_LABELS[doc.doc_type]} className="mx-auto max-h-[60vh] rounded-xl" />
      )}
      <a href={url} download={doc.filename} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-bolt hover:underline">
        <LuDownload className="h-4 w-4" /> Download
      </a>
    </div>
  );
}

interface KycFile {
  user: AdminUser;
  provider: 'manual' | 'sumsub';
  documents: KycDoc[];
}

export function KycReview({ id }: { id: string }) {
  const toast = useToast();
  const { data, error, loading, reload, set } = useResource<KycFile>(`/admin/kyc/${id}`);
  const [viewing, setViewing] = useState<KycDoc | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [docReasons, setDocReasons] = useState<Record<number, string>>({});
  const { busy, run } = useAction();

  if (loading && !data) return <Spinner />;
  if (!data) return <ErrorNote error={error} onRetry={reload} />;
  const u = data.user;

  const approve = async () => {
    const res = await run(() => api<AdminUser>(`/admin/kyc/${u.id}/approve`, { method: 'POST' }));
    if (res.ok) {
      set({ ...data, user: res.value, documents: data.documents.map((d) => ({ ...d, status: 'accepted', rejection_reason: null })) });
      toast('ok', `${u.full_name} is verified. They have been emailed.`);
    } else toast('error', res.error.message);
  };

  const reject = async () => {
    const documents = Object.fromEntries(Object.entries(docReasons).filter(([, v]) => v.trim()));
    const res = await run(() => api<AdminUser>(`/admin/kyc/${u.id}/reject`, { body: { reason, documents } }));
    if (res.ok) {
      setRejecting(false);
      toast('ok', 'Rejection sent. The client can upload new documents.');
      reload();
    } else toast('error', res.error.message);
  };

  return (
    <>
      <Link to="/kyc" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
        <LuArrowLeft className="h-4 w-4" /> Verification queue
      </Link>
      <PageHeader
        title={u.full_name}
        subtitle={
          <span className="flex items-center gap-2">
            {u.email} <StatusBadge status={u.kyc_status} />
          </span>
        }
        actions={
          data.provider === 'manual' && u.kyc_status !== 'approved' && (
            <>
              <Button variant="danger" onClick={() => setRejecting(true)} disabled={!data.documents.length}>
                <LuX className="h-4 w-4" /> Reject
              </Button>
              <Button variant="primary" busy={busy} onClick={() => window.confirm(`Approve ${u.full_name}'s identity?`) && void approve()} disabled={!data.documents.length}>
                <LuCheck className="h-4 w-4" /> Approve
              </Button>
            </>
          )
        }
      />
      {data.provider === 'sumsub' && (
        <p className="mb-6 rounded-xl border border-info/30 bg-info/10 px-4 py-3 text-sm text-info">
          Verification runs through Sumsub. Decisions arrive automatically by webhook; review the applicant in the Sumsub dashboard.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Client" className="lg:col-span-1">
          <Dl
            items={[
              ['Name on account', u.full_name],
              ['Country', u.country],
              ['Submitted', dateTime(u.kyc_submitted_at)],
              ['Last review', dateTime(u.kyc_reviewed_at)],
              ['Previous reason', u.kyc_rejection_reason],
            ]}
          />
          <Link to={`/clients/${u.id}`} className="mt-4 inline-block text-sm font-semibold text-bolt hover:underline">
            Open client file
          </Link>
        </Section>
        <Section title={`Documents (${data.documents.length})`} className="lg:col-span-2">
          {data.documents.length ? (
            <ul className="divide-y divide-line">
              {data.documents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <span>
                    <span className="block font-semibold">{DOC_LABELS[d.doc_type]}</span>
                    <span className="block text-xs text-fg-subtle">
                      {d.filename} · {bytes(d.size_bytes)} · {dateTime(d.created_at)}
                    </span>
                    {d.rejection_reason && <span className="mt-1 block text-xs text-down">{d.rejection_reason}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={d.status} />
                    <Button size="sm" onClick={() => setViewing(d)}>
                      View
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-subtle">No documents uploaded yet.</p>
          )}
        </Section>
      </div>

      <Modal title={viewing ? DOC_LABELS[viewing.doc_type] : ''} open={!!viewing} onClose={() => setViewing(null)} wide>
        {viewing && <DocPreview doc={viewing} />}
      </Modal>

      <Modal title="Reject verification" open={rejecting} onClose={() => setRejecting(false)}>
        <div className="space-y-4">
          <TextArea
            label="Reason (sent to the client)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. The proof of address is older than 3 months. Please upload a recent utility bill or bank statement."
          />
          {data.documents.map((d) => (
            <TextInput
              key={d.id}
              label={`${DOC_LABELS[d.doc_type]} — problem (optional)`}
              value={docReasons[d.id] ?? ''}
              onChange={(e) => setDocReasons({ ...docReasons, [d.id]: e.target.value })}
            />
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
            <Button variant="danger" busy={busy} disabled={reason.trim().length < 3} onClick={() => void reject()}>
              Send rejection
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
