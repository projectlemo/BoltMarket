import { useState, type FormEvent } from 'react';
import { FaWhatsapp } from 'react-icons/fa6';
import { LuCircleCheck, LuLifeBuoy, LuMail, LuMapPin, LuPhone, LuSend, LuTicket } from 'react-icons/lu';
import { companyConfigured, site } from '../../config/site';
import { useL, useT } from '../../i18n';
import { api, ApiError } from '../../lib/api';
import { Seo } from '../../lib/head';
import { isEmail } from '../../lib/validate';
import { Link, useLang } from '../../router';
import { Button } from '../../components/ui/Button';
import { Notice } from '../../components/ui/Feedback';
import { Checkbox, SelectField, TextareaField, TextField } from '../../components/ui/Form';
import { PageHero, Section } from '../../components/ui/Section';

type Errors = Partial<Record<'name' | 'email' | 'subject' | 'message' | 'consent', string>>;

export default function Contact() {
  const L = useL();
  const t = useT();
  const lang = useLang();
  const [form, setForm] = useState({ name: '', email: '', topic: 'general', subject: '', message: '', consent: false, website: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [serverError, setServerError] = useState('');

  const topics = [
    ['general', L({ en: 'General question', ar: 'سؤال عام' })],
    ['accounts', L({ en: 'Accounts and verification', ar: 'الحسابات والتحقق' })],
    ['payments', L({ en: 'Deposits and withdrawals', ar: 'الإيداع والسحب' })],
    ['platform', L({ en: 'Platforms and technical help', ar: 'المنصات والدعم الفني' })],
    ['funded', L({ en: 'Bolt Funded', ar: 'برنامج التمويل' })],
    ['partnerships', L({ en: 'Partnerships and IB', ar: 'الشراكات والوسطاء المعرّفون' })],
  ];

  const validate = (): Errors => {
    const e: Errors = {};
    if (form.name.trim().length < 2) e.name = L({ en: 'Please enter your name.', ar: 'يرجى إدخال اسمك.' });
    if (!isEmail(form.email)) e.email = L({ en: 'Please enter a valid email address.', ar: 'يرجى إدخال بريد إلكتروني صحيح.' });
    if (form.subject.trim().length < 3) e.subject = L({ en: 'Please add a short subject.', ar: 'يرجى إضافة موضوع مختصر.' });
    if (form.message.trim().length < 20) e.message = L({ en: 'Please write at least 20 characters so we can help.', ar: 'يرجى كتابة 20 حرفًا على الأقل حتى نتمكن من المساعدة.' });
    if (!form.consent) e.consent = L({ en: 'Please confirm you have read the Privacy Policy.', ar: 'يرجى تأكيد اطلاعك على سياسة الخصوصية.' });
    return e;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setState('sending');
    setServerError('');
    try {
      await api('/contact', {
        auth: false,
        body: {
          name: form.name.trim(),
          email: form.email.trim(),
          topic: form.topic,
          subject: form.subject.trim(),
          message: form.message.trim(),
          language: lang,
          website: form.website,
        },
      });
      setState('sent');
    } catch (err) {
      setState('error');
      const apiErr = err as ApiError;
      setServerError(
        apiErr.code === 'API_NOT_CONFIGURED' || apiErr.code === 'NETWORK'
          ? L({ en: 'We could not send your message right now. Please try again in a few minutes or use the Help Center.', ar: 'تعذّر إرسال رسالتك الآن. يرجى المحاولة بعد دقائق أو استخدام مركز المساعدة.' })
          : apiErr.status === 429
            ? L({ en: 'Too many messages from this connection. Please wait a little and try again.', ar: 'رسائل كثيرة من هذا الاتصال. يرجى الانتظار قليلًا ثم المحاولة مجددًا.' })
            : apiErr.message,
      );
    }
  };

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const s = site.support;

  return (
    <>
      <Seo
        title={L({ en: 'Contact us', ar: 'اتصل بنا' })}
        description={L({ en: 'Send Bolt Markets a message about accounts, payments, platforms or partnerships.', ar: 'راسل Bolt Markets بشأن الحسابات أو المدفوعات أو المنصات أو الشراكات.' })}
      />
      <PageHero
        crumbs={[{ label: t.nav.company.label }, { label: t.nav.company.contact[0] }]}
        eyebrow={L({ en: 'Contact', ar: 'التواصل' })}
        title={L({ en: 'Talk to Bolt Markets', ar: 'تحدّث إلى Bolt Markets' })}
        subtitle={L({
          en: 'Send us a message and the right team will reply by email. Existing clients get the fastest help through support tickets in the portal.',
          ar: 'أرسل لنا رسالة وسيرد عليك الفريق المختص عبر البريد الإلكتروني. يحصل العملاء الحاليون على أسرع مساعدة عبر تذاكر الدعم في البوابة.',
        })}
      />
      <Section>
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="glass p-6 sm:p-8">
            {state === 'sent' ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center" role="status">
                <LuCircleCheck className="h-14 w-14 text-up" aria-hidden="true" />
                <h2 className="text-2xl font-bold">{L({ en: 'Message sent', ar: 'تم إرسال الرسالة' })}</h2>
                <p className="max-w-md text-fg-muted">
                  {L({ en: 'Thank you. We have received your message and will reply to the email address you provided.', ar: 'شكرًا لك. استلمنا رسالتك وسنرد على البريد الإلكتروني الذي أدخلته.' })}
                </p>
                <Button variant="secondary" onClick={() => { setForm({ name: '', email: '', topic: 'general', subject: '', message: '', consent: false, website: '' }); setState('idle'); }}>
                  {L({ en: 'Send another message', ar: 'إرسال رسالة أخرى' })}
                </Button>
              </div>
            ) : (
              <form noValidate onSubmit={submit} className="grid gap-5 sm:grid-cols-2" aria-label={L({ en: 'Contact form', ar: 'نموذج التواصل' })}>
                <TextField label={L({ en: 'Full name', ar: 'الاسم الكامل' })} name="name" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} required />
                <TextField label={L({ en: 'Email', ar: 'البريد الإلكتروني' })} name="email" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} required dir="ltr" />
                <SelectField label={L({ en: 'Topic', ar: 'الموضوع' })} name="topic" value={form.topic} onChange={(e) => set('topic', e.target.value)}>
                  {topics.map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </SelectField>
                <TextField label={L({ en: 'Subject', ar: 'العنوان' })} name="subject" value={form.subject} onChange={(e) => set('subject', e.target.value)} error={errors.subject} required maxLength={150} />
                <TextareaField fieldClassName="sm:col-span-2" label={L({ en: 'Message', ar: 'الرسالة' })} name="message" value={form.message} onChange={(e) => set('message', e.target.value)} error={errors.message} required maxLength={5000} />
                {/* Honeypot: hidden from people, filled in by bots. */}
                <div aria-hidden="true" className="absolute -start-[9999px] h-0 w-0 overflow-hidden">
                  <label>
                    Website
                    <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} />
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <Checkbox
                    checked={form.consent}
                    onChange={(e) => set('consent', e.target.checked)}
                    error={errors.consent}
                    label={
                      <>
                        {L({ en: 'I have read the ', ar: 'اطّلعت على ' })}
                        <Link to="/legal/privacy-policy" className="link">{t.footer.legal.privacy}</Link>
                        {L({ en: ' and agree that Bolt Markets may use my details to reply.', ar: ' وأوافق على استخدام Bolt Markets لبياناتي للرد عليّ.' })}
                      </>
                    }
                  />
                </div>
                {state === 'error' ? <Notice tone="down" className="sm:col-span-2">{serverError}</Notice> : null}
                <div className="sm:col-span-2">
                  <Button type="submit" size="lg" loading={state === 'sending'}>
                    <LuSend className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                    {L({ en: 'Send message', ar: 'إرسال الرسالة' })}
                  </Button>
                </div>
              </form>
            )}
          </div>
          <aside className="flex flex-col gap-4">
            <Link to="/help" className="glass glass-hover flex gap-4 p-5">
              <LuLifeBuoy className="h-6 w-6 shrink-0 text-bolt" aria-hidden="true" />
              <span>
                <span className="block font-semibold">{t.common.helpCenter}</span>
                <span className="block text-sm text-fg-muted">{L({ en: 'Instant answers to common questions.', ar: 'إجابات فورية عن الأسئلة الشائعة.' })}</span>
              </span>
            </Link>
            <Link to="/portal/support" className="glass glass-hover flex gap-4 p-5">
              <LuTicket className="h-6 w-6 shrink-0 text-bolt" aria-hidden="true" />
              <span>
                <span className="block font-semibold">{L({ en: 'Support tickets', ar: 'تذاكر الدعم' })}</span>
                <span className="block text-sm text-fg-muted">{L({ en: 'For clients: track requests in the portal.', ar: 'للعملاء: تابع طلباتك من البوابة.' })}</span>
              </span>
            </Link>
            {s.email ? (
              <a href={`mailto:${s.email}`} className="glass glass-hover flex gap-4 p-5">
                <LuMail className="h-6 w-6 shrink-0 text-bolt" aria-hidden="true" />
                <span>
                  <span className="block font-semibold">{L({ en: 'Email', ar: 'البريد الإلكتروني' })}</span>
                  <span className="block text-sm text-fg-muted" dir="ltr">{s.email}</span>
                </span>
              </a>
            ) : null}
            {s.phone ? (
              <a href={`tel:${s.phone.replace(/[^\d+]/g, '')}`} className="glass glass-hover flex gap-4 p-5">
                <LuPhone className="h-6 w-6 shrink-0 text-bolt" aria-hidden="true" />
                <span>
                  <span className="block font-semibold">{L({ en: 'Phone', ar: 'الهاتف' })}</span>
                  <span className="block text-sm text-fg-muted" dir="ltr">{s.phone}</span>
                </span>
              </a>
            ) : null}
            {s.whatsapp ? (
              <a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noopener noreferrer" className="glass glass-hover flex gap-4 p-5">
                <FaWhatsapp className="h-6 w-6 shrink-0 text-bolt" aria-hidden="true" />
                <span>
                  <span className="block font-semibold">WhatsApp</span>
                  <span className="block text-sm text-fg-muted" dir="ltr">+{s.whatsapp}</span>
                </span>
              </a>
            ) : null}
            {companyConfigured && site.company.address ? (
              <div className="glass flex gap-4 p-5">
                <LuMapPin className="h-6 w-6 shrink-0 text-bolt" aria-hidden="true" />
                <span>
                  <span className="block font-semibold">{site.company.legalName}</span>
                  <span className="block text-sm text-fg-muted">{site.company.address}</span>
                </span>
              </div>
            ) : null}
          </aside>
        </div>
      </Section>
    </>
  );
}
