import { useState, type FormEvent } from 'react';
import { LuMailCheck } from 'react-icons/lu';
import { useL, useT } from '../../i18n';
import { api, type ApiError } from '../../lib/api';
import { Seo } from '../../lib/head';
import { isEmail } from '../../lib/validate';
import { Link, useLang } from '../../router';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthCard } from '../../components/portal/AuthBits';
import { Button } from '../../components/ui/Button';
import { Notice } from '../../components/ui/Feedback';
import { TextField } from '../../components/ui/Form';

export default function ForgotPassword() {
  const L = useL();
  const t = useT();
  const lang = useLang();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!isEmail(email)) {
      setError(L({ en: 'Enter a valid email address.', ar: 'أدخل بريدًا إلكترونيًا صحيحًا.' }));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api('/auth/forgot-password', { body: { email: email.trim(), language: lang }, auth: false });
      setSent(true);
    } catch (e) {
      setError((e as ApiError).status === 429 ? L({ en: 'Too many requests. Please wait and try again.', ar: 'طلبات كثيرة. يرجى الانتظار ثم المحاولة.' }) : (e as ApiError).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Seo title={L({ en: 'Reset your password', ar: 'إعادة تعيين كلمة المرور' })} noindex />
      <AuthCard
        title={L({ en: 'Reset your password', ar: 'إعادة تعيين كلمة المرور' })}
        subtitle={L({ en: 'Enter the email on your profile and we will send you a reset link.', ar: 'أدخل البريد المسجّل في ملفك وسنرسل إليك رابط إعادة التعيين.' })}
        footer={
          <Link to="/login" className="link">
            {t.common.back} · {t.common.login}
          </Link>
        }
      >
        {sent ? (
          <div className="glass flex flex-col items-center gap-3 p-6 text-center">
            <LuMailCheck className="h-10 w-10 text-bolt" aria-hidden="true" />
            <p className="text-fg-muted">
              {L({ en: 'If an account exists for that email, a reset link is on its way. It expires in one hour.', ar: 'إذا كان هناك حساب بهذا البريد، فرابط إعادة التعيين في طريقه إليك، وتنتهي صلاحيته خلال ساعة.' })}
            </p>
          </div>
        ) : (
          <form noValidate onSubmit={submit} className="flex flex-col gap-5">
            <TextField label={L({ en: 'Email', ar: 'البريد الإلكتروني' })} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
            {error ? <Notice tone="down">{error}</Notice> : null}
            <Button type="submit" size="lg" loading={loading}>
              {L({ en: 'Send reset link', ar: 'أرسل رابط إعادة التعيين' })}
            </Button>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
