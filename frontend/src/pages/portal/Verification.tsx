import clsx from 'clsx';
import { useRef, useState } from 'react';
import { LuBadgeCheck, LuCamera, LuCircleCheck, LuFileText, LuHouse, LuIdCard, LuTrash2, LuUpload } from 'react-icons/lu';
import type { IconType } from 'react-icons';
import { useL, useT } from '../../i18n';
import type { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { portal, type KycDocType, type KycDocument } from '../../lib/portal-api';
import { useLang } from '../../router';
import { ErrorNote, StatusBadge } from '../../components/portal/Bits';
import { kycLabel } from '../../components/portal/labels';
import { Panel, PortalShell, useLoad } from '../../components/portal/Shell';
import { Button } from '../../components/ui/Button';
import { Badge, Notice, Spinner } from '../../components/ui/Feedback';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

const slots: { type: KycDocType; icon: IconType; title: { en: string; ar: string }; hint: { en: string; ar: string } }[] = [
  { type: 'id_front', icon: LuIdCard, title: { en: 'ID document: front', ar: 'وثيقة الهوية: الوجه الأمامي' }, hint: { en: 'Passport photo page, national ID or driving licence.', ar: 'صفحة الصورة في جواز السفر أو بطاقة الهوية أو رخصة القيادة.' } },
  { type: 'id_back', icon: LuIdCard, title: { en: 'ID document: back', ar: 'وثيقة الهوية: الوجه الخلفي' }, hint: { en: 'Not needed for passports; upload the photo page again.', ar: 'غير مطلوب لجواز السفر؛ ارفع صفحة الصورة مرة أخرى.' } },
  { type: 'proof_of_address', icon: LuHouse, title: { en: 'Proof of address', ar: 'إثبات العنوان' }, hint: { en: 'Utility bill or bank statement from the last 3 months.', ar: 'فاتورة خدمات أو كشف حساب بنكي من آخر 3 أشهر.' } },
  { type: 'selfie', icon: LuCamera, title: { en: 'Selfie with your ID', ar: 'صورة شخصية مع هويتك' }, hint: { en: 'Your face and the ID clearly visible in one photo.', ar: 'وجهك والهوية واضحان في صورة واحدة.' } },
];

declare global {
  interface Window {
    snsWebSdk?: {
      init: (token: string, refresh: () => Promise<string>) => {
        withConf: (c: Record<string, unknown>) => { withOptions: (o: Record<string, unknown>) => { on: (e: string, cb: () => void) => { build: () => { launch: (sel: string) => void } } } };
      };
    };
  }
}

function SumsubPanel({ onSubmitted }: { onSubmitted: () => void }) {
  const L = useL();
  const lang = useLang();
  const [state, setState] = useState<'idle' | 'loading' | 'open' | 'error'>('idle');
  const start = async () => {
    setState('loading');
    try {
      const { token } = await portal.sumsubToken();
      if (!window.snsWebSdk) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://static.sumsub.com/idensic/static/sns-websdk-builder.js';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('load'));
          document.body.appendChild(s);
        });
      }
      window
        .snsWebSdk!.init(token, () => portal.sumsubToken().then((r) => r.token))
        .withConf({ lang })
        .withOptions({ addViewportTag: false, adaptIframeHeight: true })
        .on('idCheck.onApplicantSubmitted', onSubmitted)
        .build()
        .launch('#sumsub-websdk');
      setState('open');
    } catch {
      setState('error');
    }
  };
  return (
    <Panel title={L({ en: 'Verify with our identity partner', ar: 'تحقّق عبر شريكنا لخدمات التحقق' })}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-fg-muted">
          {L({ en: 'You will photograph your ID and take a short selfie video. It usually takes a few minutes.', ar: 'ستصوّر هويتك وتسجّل مقطعًا قصيرًا لوجهك، ويستغرق ذلك عادةً بضع دقائق.' })}
        </p>
        {state === 'error' ? <Notice tone="down">{L({ en: 'We could not start verification. Please try again.', ar: 'تعذّر بدء التحقق. يرجى المحاولة مجددًا.' })}</Notice> : null}
        {state !== 'open' ? (
          <Button onClick={() => void start()} loading={state === 'loading'} className="self-start">
            <LuBadgeCheck className="h-4 w-4" aria-hidden="true" />
            {L({ en: 'Start verification', ar: 'ابدأ التحقق' })}
          </Button>
        ) : null}
        <div id="sumsub-websdk" />
      </div>
    </Panel>
  );
}

export default function Verification() {
  const L = useL();
  const t = useT();
  const { user, reload: reloadUser } = useAuth();
  const kyc = useLoad(() => portal.kyc(), []);
  const [busy, setBusy] = useState<KycDocType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputs = useRef<Partial<Record<KycDocType, HTMLInputElement | null>>>({});

  const docsByType = (type: KycDocType): KycDocument | undefined => kyc.data?.documents.filter((d) => d.doc_type === type).slice(-1)[0];
  const status = kyc.data?.status ?? user?.kyc_status ?? 'none';
  const locked = status === 'pending' || status === 'approved';
  const required = kyc.data?.required ?? (['id_front', 'id_back', 'proof_of_address'] as KycDocType[]);
  const ready = required.every((r) => {
    const d = docsByType(r);
    return d && d.status !== 'rejected';
  });

  const upload = async (type: KycDocType, file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) return setError(L({ en: 'Files must be 10 MB or smaller.', ar: 'يجب ألا يتجاوز حجم الملف 10 ميغابايت.' }));
    if (!ACCEPT.split(',').includes(file.type)) return setError(L({ en: 'Upload a JPG, PNG, WEBP or PDF file.', ar: 'ارفع ملفًا بصيغة JPG أو PNG أو WEBP أو PDF.' }));
    setBusy(type);
    try {
      await portal.uploadKyc(type, file);
      kyc.reload();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (doc: KycDocument) => {
    try {
      await portal.deleteKycDocument(doc.id);
      kyc.reload();
    } catch (e) {
      setError((e as ApiError).message);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await portal.submitKyc();
      kyc.reload();
      await reloadUser();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusText: Record<string, { en: string; ar: string }> = {
    none: { en: 'Upload the documents below and submit them for review.', ar: 'ارفع المستندات أدناه وأرسلها للمراجعة.' },
    draft: { en: 'Finish uploading your documents, then submit them for review.', ar: 'أكمل رفع مستنداتك ثم أرسلها للمراجعة.' },
    pending: { en: 'Our compliance team is reviewing your documents. We will email you when it is done.', ar: 'يراجع فريق الامتثال مستنداتك، وسنراسلك عند الانتهاء.' },
    approved: { en: 'Your identity is verified. Deposits and withdrawals are unlocked.', ar: 'تم التحقق من هويتك، وأصبحت الإيداعات والسحوبات متاحة.' },
    rejected: { en: 'Some documents could not be accepted. Replace them and submit again.', ar: 'تعذّر قبول بعض المستندات. استبدلها ثم أرسلها مجددًا.' },
  };

  return (
    <PortalShell title={L({ en: 'Verification', ar: 'التحقق من الهوية' })}>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="glass flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {status === 'approved' ? <LuCircleCheck className="h-10 w-10 text-up" aria-hidden="true" /> : <LuBadgeCheck className="h-10 w-10 text-bolt" aria-hidden="true" />}
            <div>
              <p className="font-display text-lg font-bold">{L({ en: 'Identity verification', ar: 'التحقق من الهوية' })}</p>
              <p className="text-sm text-fg-muted">{L(statusText[status] ?? statusText.none)}</p>
            </div>
          </div>
          <StatusBadge s={kycLabel[status]} />
        </div>
        {kyc.data?.rejection_reason && status === 'rejected' ? <Notice tone="down" title={L({ en: 'Reviewer note', ar: 'ملاحظة المراجع' })}>{kyc.data.rejection_reason}</Notice> : null}
        {error ? <Notice tone="down">{error}</Notice> : null}

        {kyc.loading ? (
          <Spinner label={t.common.loading} />
        ) : kyc.error ? (
          <ErrorNote message={kyc.error} onRetry={kyc.reload} />
        ) : kyc.data?.provider === 'sumsub' && !locked ? (
          <SumsubPanel onSubmitted={() => { kyc.reload(); void reloadUser(); }} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {slots
                .filter((s) => required.includes(s.type) || s.type === 'selfie')
                .map((s) => {
                  const doc = docsByType(s.type);
                  const Icon = s.icon;
                  const optional = !required.includes(s.type);
                  return (
                    <div key={s.type} className={clsx('glass flex flex-col gap-3 p-5', doc?.status === 'rejected' && 'border-down/40')}>
                      <div className="flex items-start gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-fg">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">
                            {L(s.title)} {optional ? <span className="text-xs font-normal text-fg-subtle">({L({ en: 'if requested', ar: 'عند الطلب' })})</span> : null}
                          </p>
                          <p className="text-xs text-fg-subtle">{L(s.hint)}</p>
                        </div>
                      </div>
                      {doc ? (
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <LuFileText className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                            <span className="truncate" dir="ltr">
                              {doc.filename}
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            <Badge tone={doc.status === 'accepted' ? 'up' : doc.status === 'rejected' ? 'down' : 'info'}>
                              {doc.status === 'accepted' ? L({ en: 'Accepted', ar: 'مقبول' }) : doc.status === 'rejected' ? L({ en: 'Rejected', ar: 'مرفوض' }) : L({ en: 'Uploaded', ar: 'مرفوع' })}
                            </Badge>
                            {!locked && doc.status === 'uploaded' ? (
                              <button type="button" onClick={() => void remove(doc)} className="text-fg-subtle hover:text-down" aria-label={L({ en: 'Remove file', ar: 'حذف الملف' })}>
                                <LuTrash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </span>
                        </div>
                      ) : null}
                      {doc?.rejection_reason ? <p className="text-xs text-down">{doc.rejection_reason}</p> : null}
                      {!locked ? (
                        <>
                          <input
                            ref={(el) => {
                              inputs.current[s.type] = el;
                            }}
                            type="file"
                            accept={ACCEPT}
                            className="sr-only"
                            aria-label={L(s.title)}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void upload(s.type, f);
                              e.target.value = '';
                            }}
                          />
                          <Button variant="secondary" size="sm" loading={busy === s.type} onClick={() => inputs.current[s.type]?.click()} className="self-start">
                            <LuUpload className="h-4 w-4" aria-hidden="true" />
                            {doc ? L({ en: 'Replace file', ar: 'استبدال الملف' }) : L({ en: 'Upload file', ar: 'رفع ملف' })}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  );
                })}
            </div>
            {!locked ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-fg-subtle">
                  {L({ en: 'JPG, PNG, WEBP or PDF, up to 10 MB. Make sure all four corners are visible and the text is readable.', ar: 'JPG أو PNG أو WEBP أو PDF حتى 10 ميغابايت. تأكد من ظهور الزوايا الأربع ووضوح النص.' })}
                </p>
                <Button onClick={() => void submit()} disabled={!ready} loading={submitting}>
                  {L({ en: 'Submit for review', ar: 'إرسال للمراجعة' })}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </PortalShell>
  );
}
