import { useEffect, useState, type FormEvent } from 'react';
import { LuCircleCheck } from 'react-icons/lu';
import { useL, useT } from '../../i18n';
import { api, type ApiError } from '../../lib/api';
import { Seo } from '../../lib/head';
import { passwordOk } from '../../lib/validate';
import { Link, useRouter } from '../../router';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthCard, PasswordChecklist } from '../../components/portal/AuthBits';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Notice } from '../../components/ui/Feedback';
import { PasswordField } from '../../components/ui/Form';

export default function ResetPassword() {
  const L = useL();
  const t = useT();
  const { state } = useRouter();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => setToken(new URLSearchParams(state.search).get('token') ?? ''), [state.search]);

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (!passwordOk(password)) return setError(L({ en: 'Choose a stronger password.', ar: 'اختر كلمة مرور أقوى.' }));
    if (password !== confirm) return setError(L({ en: 'The passwords do not match.', ar: 'كلمتا المرور غير متطابقتين.' }));
    setLoading(true);
    try {
      await api('/auth/reset-password', { body: { token, password }, auth: false });
      setDone(true);
    } catch (e) {
      const ae = e as ApiError;
      setError(
        ae.code === 'TOKEN_EXPIRED' || ae.code === 'INVALID_TOKEN'
          ? L({ en: 'This reset link has expired or was already used. Request a new one.', ar: 'انتهت صلاحية رابط إعادة التعيين أو سبق استخدامه. اطلب رابطًا جديدًا.' })
          : ae.message,
      );
    } finally {
      setLoading(false);
    }
  };

  const show = L({ en: 'Show password', ar: 'إظهار كلمة المرور' });
  const hide = L({ en: 'Hide password', ar: 'إخفاء كلمة المرور' });

  return (
    <AuthLayout>
      <Seo title={L({ en: 'Choose a new password', ar: 'اختر كلمة مرور جديدة' })} noindex />
      {done ? (
        <AuthCard title={L({ en: 'Password updated', ar: 'تم تحديث كلمة المرور' })}>
          <div className="glass flex flex-col items-center gap-4 p-6 text-center">
            <LuCircleCheck className="h-12 w-12 text-up" aria-hidden="true" />
            <p className="text-fg-muted">{L({ en: 'For your security, all other sessions were signed out.', ar: 'حرصًا على أمانك، سُجّل الخروج من جميع الجلسات الأخرى.' })}</p>
            <ButtonLink to="/login">{t.common.login}</ButtonLink>
          </div>
        </AuthCard>
      ) : !token ? (
        <AuthCard title={L({ en: 'Link missing', ar: 'الرابط غير مكتمل' })} subtitle={L({ en: 'Open the reset link from your email, or request a new one.', ar: 'افتح رابط إعادة التعيين من بريدك، أو اطلب رابطًا جديدًا.' })}>
          <ButtonLink to="/forgot-password">{L({ en: 'Request a new link', ar: 'اطلب رابطًا جديدًا' })}</ButtonLink>
        </AuthCard>
      ) : (
        <AuthCard
          title={L({ en: 'Choose a new password', ar: 'اختر كلمة مرور جديدة' })}
          footer={
            <Link to="/login" className="link">
              {t.common.login}
            </Link>
          }
        >
          <form noValidate onSubmit={submit} className="flex flex-col gap-4">
            <PasswordField label={L({ en: 'New password', ar: 'كلمة المرور الجديدة' })} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} showLabel={show} hideLabel={hide} />
            <PasswordChecklist value={password} />
            <PasswordField label={L({ en: 'Confirm new password', ar: 'تأكيد كلمة المرور الجديدة' })} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} showLabel={show} hideLabel={hide} />
            {error ? <Notice tone="down">{error}</Notice> : null}
            <Button type="submit" size="lg" loading={loading}>
              {L({ en: 'Update password', ar: 'تحديث كلمة المرور' })}
            </Button>
          </form>
        </AuthCard>
      )}
    </AuthLayout>
  );
}
