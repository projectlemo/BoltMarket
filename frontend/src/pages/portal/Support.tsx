import { useState, type FormEvent } from 'react';
import { LuLifeBuoy, LuPlus } from 'react-icons/lu';
import { useL, useT } from '../../i18n';
import type { ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { portal } from '../../lib/portal-api';
import { Link, useLang, useNavigate } from '../../router';
import { ErrorNote, StatusBadge } from '../../components/portal/Bits';
import { ticketCategories, ticketStatusLabel } from '../../components/portal/labels';
import { PortalShell, useLoad } from '../../components/portal/Shell';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Disclosure';
import { EmptyState, Notice, Spinner } from '../../components/ui/Feedback';
import { SelectField, TextareaField, TextField } from '../../components/ui/Form';

export default function Support() {
  const L = useL();
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const list = useLoad(() => portal.tickets(), []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: '', category: 'account', message: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (form.subject.trim().length < 3 || form.message.trim().length < 10) {
      setError(L({ en: 'Add a subject and a message of at least 10 characters.', ar: 'أضف عنوانًا ورسالة لا تقل عن 10 أحرف.' }));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ticket = await portal.createTicket({ subject: form.subject.trim(), category: form.category, message: form.message.trim() });
      setOpen(false);
      navigate(`/portal/support/${ticket.id}`);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalShell
      title={L({ en: 'Support', ar: 'الدعم' })}
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          <LuPlus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{L({ en: 'New ticket', ar: 'تذكرة جديدة' })}</span>
        </Button>
      }
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <Notice tone="info" action={<ButtonLink to="/help" size="sm" variant="secondary">{t.common.helpCenter}</ButtonLink>}>
          {L({ en: 'Many questions are answered instantly in the Help Center.', ar: 'تجد إجابات فورية عن كثير من الأسئلة في مركز المساعدة.' })}
        </Notice>
        {list.loading ? (
          <Spinner label={t.common.loading} />
        ) : list.error ? (
          <ErrorNote message={list.error} onRetry={list.reload} />
        ) : !list.data?.items.length ? (
          <EmptyState icon={<LuLifeBuoy />} title={L({ en: 'No support tickets', ar: 'لا توجد تذاكر دعم' })} action={<Button onClick={() => setOpen(true)}>{L({ en: 'Open a ticket', ar: 'افتح تذكرة' })}</Button>} />
        ) : (
          <ul className="flex flex-col gap-3">
            {list.data.items.map((tk) => (
              <li key={tk.id}>
                <Link to={`/portal/support/${tk.id}`} className="glass glass-hover flex items-center justify-between gap-4 p-5">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{tk.subject}</span>
                    <span className="block text-xs text-fg-subtle">
                      #{tk.id} · {L(ticketCategories.find((c) => c.id === tk.category)?.label ?? { en: tk.category, ar: tk.category })} · {formatDateTime(tk.updated_at, lang)}
                    </span>
                  </span>
                  <StatusBadge s={ticketStatusLabel[tk.status]} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title={L({ en: 'New support ticket', ar: 'تذكرة دعم جديدة' })} closeLabel={t.common.close} wide>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <TextField label={L({ en: 'Subject', ar: 'العنوان' })} value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} maxLength={150} />
          <SelectField label={L({ en: 'Category', ar: 'الفئة' })} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            {ticketCategories.map((c) => (
              <option key={c.id} value={c.id}>{L(c.label)}</option>
            ))}
          </SelectField>
          <TextareaField label={L({ en: 'How can we help?', ar: 'كيف يمكننا مساعدتك؟' })} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} maxLength={5000} hint={L({ en: 'Never share your passwords or 2FA codes.', ar: 'لا تشارك أبدًا كلمات المرور أو رموز المصادقة الثنائية.' })} />
          {error ? <Notice tone="down">{error}</Notice> : null}
          <Button type="submit" loading={loading}>{L({ en: 'Send', ar: 'إرسال' })}</Button>
        </form>
      </Dialog>
    </PortalShell>
  );
}
