import clsx from 'clsx';
import { useState, type FormEvent } from 'react';
import { LuArrowLeft, LuSend } from 'react-icons/lu';
import { useL, useT } from '../../i18n';
import type { ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { portal } from '../../lib/portal-api';
import { Link, useLang } from '../../router';
import type { PageProps } from '../../routes';
import { ErrorNote, StatusBadge } from '../../components/portal/Bits';
import { ticketStatusLabel } from '../../components/portal/labels';
import { PortalShell, useLoad } from '../../components/portal/Shell';
import { Button } from '../../components/ui/Button';
import { Notice, Spinner } from '../../components/ui/Feedback';
import { TextareaField } from '../../components/ui/Form';

export default function TicketPage({ params }: PageProps) {
  const L = useL();
  const t = useT();
  const lang = useLang();
  const id = Number(params.id);
  const data = useLoad(() => portal.ticket(id), [id]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (ev: FormEvent) => {
    ev.preventDefault();
    if (reply.trim().length < 2) return;
    setSending(true);
    setError(null);
    try {
      await portal.replyTicket(id, reply.trim());
      setReply('');
      data.reload();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSending(false);
    }
  };

  const close = async () => {
    try {
      await portal.closeTicket(id);
      data.reload();
    } catch (e) {
      setError((e as ApiError).message);
    }
  };

  return (
    <PortalShell title={data.data ? `#${id} · ${data.data.ticket.subject}` : L({ en: 'Ticket', ar: 'تذكرة' })}>
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <Link to="/portal/support" className="inline-flex items-center gap-2 text-sm font-semibold text-fg-muted hover:text-fg">
          <LuArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
          {L({ en: 'All tickets', ar: 'كل التذاكر' })}
        </Link>
        {data.loading ? (
          <Spinner label={t.common.loading} />
        ) : data.error ? (
          <ErrorNote message={data.error} onRetry={data.reload} />
        ) : data.data ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <StatusBadge s={ticketStatusLabel[data.data.ticket.status]} />
              {data.data.ticket.status !== 'closed' ? (
                <Button size="sm" variant="ghost" onClick={() => void close()}>
                  {L({ en: 'Mark as resolved', ar: 'تعليم كمحلولة' })}
                </Button>
              ) : null}
            </div>
            <ol className="flex flex-col gap-4">
              {data.data.messages.map((m) => (
                <li key={m.id} className={clsx('flex', m.is_staff ? 'justify-start' : 'justify-end')}>
                  <div className={clsx('max-w-[85%] rounded-2xl border px-4 py-3', m.is_staff ? 'border-bolt/25 bg-bolt/[0.06]' : 'border-line bg-surface-2')}>
                    <p className="mb-1 text-xs text-fg-subtle">
                      {m.is_staff ? `${m.author_name} · ${L({ en: 'Bolt Markets support', ar: 'دعم Bolt Markets' })}` : L({ en: 'You', ar: 'أنت' })} · {formatDateTime(m.created_at, lang)}
                    </p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            {data.data.ticket.status !== 'closed' ? (
              <form onSubmit={send} className="glass flex flex-col gap-3 p-4">
                <TextareaField label={L({ en: 'Reply', ar: 'رد' })} value={reply} onChange={(e) => setReply(e.target.value)} className="min-h-28" maxLength={5000} />
                {error ? <Notice tone="down">{error}</Notice> : null}
                <Button type="submit" loading={sending} className="self-end">
                  <LuSend className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                  {L({ en: 'Send reply', ar: 'إرسال الرد' })}
                </Button>
              </form>
            ) : (
              <p className="text-center text-sm text-fg-subtle">{L({ en: 'This ticket is closed. Open a new ticket if you need more help.', ar: 'هذه التذكرة مغلقة. افتح تذكرة جديدة إذا احتجت مزيدًا من المساعدة.' })}</p>
            )}
          </>
        ) : null}
      </div>
    </PortalShell>
  );
}
