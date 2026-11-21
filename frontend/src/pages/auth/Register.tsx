import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { LuArrowRight, LuMailCheck } from 'react-icons/lu';
import { site } from '../../config/site';
import { countryOptions } from '../../content/legal/countries';
import { useL, useT } from '../../i18n';
import { api, apiConfigured, type ApiError } from '../../lib/api';
import { Seo } from '../../lib/head';
import type { PublicConfig } from '../../lib/portal-api';
import { isEmail, passwordOk } from '../../lib/validate';
import { storedReferral } from '../../lib/referral';
import { Link, useLang, useRouter } from '../../router';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthCard, PasswordChecklist } from '../../components/portal/AuthBits';
import { Button } from '../../components/ui/Button';
import { Notice } from '../../components/ui/Feedback';
import { Checkbox, PasswordField, SelectField, TextField } from '../../components/ui/Form';

type Errors = Partial<Record<'full_name' | 'email' | 'password' | 'country' | 'accept_terms' | 'referral_code', string>>;

export default function Register() {
  const L = useL();
  const t = useT();
  const lang = useLang();
  const { state } = useRouter();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', country: '', referral_code: '', accept_terms: false });
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [resent, setResent] = useState(false);
  const [config, setConfig] = useState<PublicConfig | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(state.search);
    setForm((f) => ({ ...f, email: q.get('email') ?? f.email, referral_code: (q.get('ref') ?? storedReferral()) || f.referral_code }));
    const account = q.get('account');
    try {
      if (account) localStorage.setItem('bolt.pref.account', account);
      if (q.get('demo')) localStorage.setItem('bolt.pref.demo', '1');
    } catch {
      /* ignore */
    }
  }, [state.search]);

  useEffect(() => {
    if (!apiConfigured) return;
    api<PublicConfig>('/public/config', { auth: false })
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  // Country names come from the browser's Intl data, so the list is built after hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const restricted = useMemo(() => new Set([...site.restrictedCountries, ...(config?.restricted_countries ?? [])]), [config]);
  const countries = useMemo(() => (mounted ? countryOptions(lang).filter((c) => !restricted.has(c.code)) : []), [mounted, lang, restricted]);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const validate = (): Errors => {
    const e: Errors = {};
    if (form.full_name.trim().split(/\s+/).length < 2) e.full_name = L({ en: 'Enter your first and last name as on your ID.', ar: 'أدخل اسمك الأول والأخير كما في هويتك.' });
    if (!isEmail(form.email)) e.email = L({ en: 'Enter a valid email address.', ar: 'أدخل بريدًا إلكترونيًا صحيحًا.' });
    if (!passwordOk(form.password)) e.password = L({ en: 'Choose a stronger password.', ar: 'اختر كلمة مرور أقوى.' });
    if (!form.country) e.country = L({ en: 'Select your country of residence.', ar: 'اختر دولة إقامتك.' });
    if (!form.accept_terms) e.accept_terms = L({ en: 'You need to accept the terms to continue.', ar: 'يجب الموافقة على الشروط للمتابعة.' });
    return e;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    setServerError(null);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      await api('/auth/register', {
        auth: false,
        body: {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          password: form.password,
          country: form.country,
          language: lang,
          referral_code: form.referral_code.trim() || null,
          accept_terms: true,
        },
      });
      setDone(true);
    } catch (err) {
      const ae = err as ApiError;
      if (ae.code === 'EMAIL_TAKEN') setErrors({ email: L({ en: 'An account with this email already exists. Try logging in.', ar: 'يوجد حساب بهذا البريد بالفعل. جرّب تسجيل الدخول.' }) });
      else if (ae.code === 'COUNTRY_RESTRICTED') setErrors({ country: L({ en: 'We cannot offer accounts to residents of this country.', ar: 'لا يمكننا تقديم حسابات للمقيمين في هذه الدولة.' }) });
      else if (ae.code === 'REGISTRATION_CLOSED') setServerError(L({ en: 'Account opening is not available at the moment.', ar: 'فتح الحسابات غير متاح في الوقت الحالي.' }));
      else if (Object.keys(ae.fields).length) setErrors(ae.fields as Errors);
      else setServerError(ae.message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      await api('/auth/resend-verification', { body: { email: form.email.trim(), language: lang }, auth: false });
    } finally {
      setResent(true);
    }
  };

  if (done) {
    return (
      <AuthLayout>
        <Seo title={t.common.createAccount} noindex />
        <AuthCard title={L({ en: 'Check your inbox', ar: 'تحقّق من بريدك الوارد' })}>
          <div className="glass flex flex-col items-center gap-4 p-6 text-center">
            <LuMailCheck className="h-12 w-12 text-bolt" aria-hidden="true" />
            <p className="text-fg-muted">
              {L({ en: 'We sent a confirmation link to ', ar: 'أرسلنا رابط التأكيد إلى ' })}
              <strong className="text-fg" dir="ltr">
                {form.email}
              </strong>
              {L({ en: '. Open it to activate your profile, then log in to open your MT5 account.', ar: '. افتحه لتفعيل ملفك، ثم سجّل الدخول لفتح حساب ميتاتريدر 5.' })}
            </p>
            {resent ? (
              <p className="text-sm text-up">{L({ en: 'A new link is on its way.', ar: 'رابط جديد في طريقه إليك.' })}</p>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => void resend()}>
                {L({ en: 'Resend email', ar: 'إعادة إرسال البريد' })}
              </Button>
            )}
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  const closed = config ? !config.registration_open : false;

  return (
    <AuthLayout>
      <Seo title={t.common.createAccount} noindex />
      <AuthCard
        title={L({ en: 'Create your account', ar: 'أنشئ حسابك' })}
        subtitle={L({ en: 'It takes about a minute. You will verify your identity later in the portal.', ar: 'يستغرق الأمر دقيقة تقريبًا، وستتحقق من هويتك لاحقًا في البوابة.' })}
        footer={
          <>
            {L({ en: 'Already have an account? ', ar: 'لديك حساب بالفعل؟ ' })}
            <Link to="/login" className="link">
              {t.common.login}
            </Link>
          </>
        }
      >
        {!apiConfigured || closed ? (
          <Notice tone="warn" title={L({ en: 'Account opening is not available right now', ar: 'فتح الحسابات غير متاح حاليًا' })}>
            {L({ en: 'Please check back later, or contact us if you have questions.', ar: 'يرجى العودة لاحقًا، أو التواصل معنا إذا كانت لديك أسئلة.' })}
          </Notice>
        ) : null}
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <TextField label={L({ en: 'Full name', ar: 'الاسم الكامل' })} autoComplete="name" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} error={errors.full_name} required />
          <TextField label={L({ en: 'Email', ar: 'البريد الإلكتروني' })} type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} dir="ltr" required />
          <div className="flex flex-col gap-2">
            <PasswordField
              label={L({ en: 'Password', ar: 'كلمة المرور' })}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              error={errors.password}
              showLabel={L({ en: 'Show password', ar: 'إظهار كلمة المرور' })}
              hideLabel={L({ en: 'Hide password', ar: 'إخفاء كلمة المرور' })}
              required
            />
            <PasswordChecklist value={form.password} />
          </div>
          <SelectField label={L({ en: 'Country of residence', ar: 'دولة الإقامة' })} value={form.country} onChange={(e) => set('country', e.target.value)} error={errors.country} required>
            <option value="">{L({ en: 'Select…', ar: 'اختر…' })}</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <TextField
            label={L({ en: 'Referral code', ar: 'رمز الإحالة' })}
            optional={L({ en: 'optional', ar: 'اختياري' })}
            value={form.referral_code}
            onChange={(e) => set('referral_code', e.target.value.toUpperCase())}
            error={errors.referral_code}
            dir="ltr"
            maxLength={16}
          />
          <Checkbox
            checked={form.accept_terms}
            onChange={(e) => set('accept_terms', e.target.checked)}
            error={errors.accept_terms}
            label={
              <>
                {L({ en: 'I am over 18 and accept the ', ar: 'أؤكد أن عمري يزيد على 18 عامًا وأوافق على ' })}
                <Link to="/legal/terms-and-conditions" className="link" target="_blank">
                  {t.footer.legal.terms}
                </Link>
                {', '}
                <Link to="/legal/client-agreement" className="link" target="_blank">
                  {t.footer.legal.client}
                </Link>
                {L({ en: ' and ', ar: ' و' })}
                <Link to="/legal/privacy-policy" className="link" target="_blank">
                  {t.footer.legal.privacy}
                </Link>
                {L({ en: ', and I have read the ', ar: '، وقد قرأت ' })}
                <Link to="/legal/risk-disclaimer" className="link" target="_blank">
                  {t.footer.legal.risk}
                </Link>
                .
              </>
            }
          />
          {serverError ? <Notice tone="down">{serverError}</Notice> : null}
          <Button type="submit" size="lg" loading={loading} disabled={!apiConfigured || closed}>
            {t.common.createAccount}
            <LuArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
