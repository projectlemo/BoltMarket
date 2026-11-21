import { useEffect, useState, type FormEvent } from 'react';
import { LuArrowRight, LuShieldCheck } from 'react-icons/lu';
import { useL, useT } from '../../i18n';
import { api, apiConfigured, type ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Seo } from '../../lib/head';
import { isEmail } from '../../lib/validate';
import { Link, useNavigate, useRouter } from '../../router';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthCard, safeNext } from '../../components/portal/AuthBits';
import { Button } from '../../components/ui/Button';
import { Notice } from '../../components/ui/Feedback';
import { PasswordField, TextField } from '../../components/ui/Form';

export default function Login() {
  const L = useL();
  const t = useT();
  const { state } = useRouter();
  const navigate = useNavigate();
  const { login, verifyMfa, status } = useAuth();
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [next, setNext] = useState('/portal');

  useEffect(() => {
    setNext(safeNext(new URLSearchParams(state.search).get('next')));
  }, [state.search]);

  useEffect(() => {
    if (status === 'authenticated') navigate(next, { replace: true });
  }, [status, next, navigate]);

  const explain = (e: ApiError) => {
    if (e.code === 'EMAIL_NOT_VERIFIED') {
      setUnverified(true);
      return L({ en: 'Please confirm your email address first.', ar: 'يرجى تأكيد بريدك الإلكتروني أولًا.' });
    }
    if (e.code === 'INVALID_CREDENTIALS') return L({ en: 'The email or password is incorrect.', ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
    if (e.code === 'INVALID_CODE') return L({ en: 'That code is not valid. Check your authenticator app and try again.', ar: 'الرمز غير صحيح. تحقق من تطبيق المصادقة وحاول مجددًا.' });
    if (e.code === 'ACCOUNT_SUSPENDED') return L({ en: 'This account is suspended. Please contact support.', ar: 'هذا الحساب موقوف. يرجى التواصل مع الدعم.' });
    if (e.status === 429) return L({ en: 'Too many attempts. Please wait a few minutes and try again.', ar: 'محاولات كثيرة. يرجى الانتظار بضع دقائق ثم المحاولة مجددًا.' });
    if (e.code === 'MFA_EXPIRED') {
      setStep('credentials');
      return L({ en: 'Your sign-in took too long. Please enter your password again.', ar: 'استغرق تسجيل الدخول وقتًا طويلًا. يرجى إدخال كلمة المرور مجددًا.' });
    }
    return e.message;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    setUnverified(false);
    if (!isEmail(email) || !password) {
      setError(L({ en: 'Enter your email and password.', ar: 'أدخل بريدك الإلكتروني وكلمة المرور.' }));
      return;
    }
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      if (res.mfaRequired) {
        setMfaToken(res.mfaToken);
        setStep('mfa');
      }
    } catch (e) {
      setError(explain(e as ApiError));
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyMfa(mfaToken, code.replace(/\s/g, ''));
    } catch (e) {
      setError(explain(e as ApiError));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      await api('/auth/resend-verification', { body: { email: email.trim(), language: state.lang }, auth: false });
    } finally {
      setResent(true);
    }
  };

  return (
    <AuthLayout>
      <Seo title={t.common.login} noindex />
      {step === 'credentials' ? (
        <AuthCard
          title={L({ en: 'Welcome back', ar: 'مرحبًا بعودتك' })}
          subtitle={L({ en: 'Log in to your Bolt Markets client portal.', ar: 'سجّل الدخول إلى بوابة عملاء Bolt Markets.' })}
          footer={
            <>
              {L({ en: 'New to Bolt Markets? ', ar: 'جديد في Bolt Markets؟ ' })}
              <Link to="/register" className="link">
                {t.common.createAccount}
              </Link>
            </>
          }
        >
          {!apiConfigured ? (
            <Notice tone="warn">{L({ en: 'The client portal is not reachable right now. Please try again later.', ar: 'لا يمكن الوصول إلى بوابة العملاء حاليًا. يرجى المحاولة لاحقًا.' })}</Notice>
          ) : null}
          <form noValidate onSubmit={submit} className="flex flex-col gap-5">
            <TextField label={L({ en: 'Email', ar: 'البريد الإلكتروني' })} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" required />
            <PasswordField
              label={L({ en: 'Password', ar: 'كلمة المرور' })}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              showLabel={L({ en: 'Show password', ar: 'إظهار كلمة المرور' })}
              hideLabel={L({ en: 'Hide password', ar: 'إخفاء كلمة المرور' })}
              required
            />
            <div className="-mt-2 flex justify-end">
              <Link to="/forgot-password" className="text-sm text-fg-muted hover:text-fg">
                {L({ en: 'Forgot password?', ar: 'نسيت كلمة المرور؟' })}
              </Link>
            </div>
            {error ? (
              <Notice
                tone="down"
                action={
                  unverified ? (
                    resent ? (
                      <span className="text-sm text-up">{L({ en: 'If the account exists, a new link is on its way.', ar: 'إذا كان الحساب موجودًا فرابط جديد في طريقه إليك.' })}</span>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => void resend()}>
                        {L({ en: 'Resend confirmation email', ar: 'إعادة إرسال رسالة التأكيد' })}
                      </Button>
                    )
                  ) : undefined
                }
              >
                {error}
              </Notice>
            ) : null}
            <Button type="submit" size="lg" loading={loading} disabled={!apiConfigured}>
              {t.common.login}
              <LuArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
            </Button>
          </form>
        </AuthCard>
      ) : (
        <AuthCard
          title={L({ en: 'Two-step verification', ar: 'التحقق بخطوتين' })}
          subtitle={L({ en: 'Enter the 6-digit code from your authenticator app, or one of your recovery codes.', ar: 'أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة، أو أحد رموز الاسترداد.' })}
        >
          <form noValidate onSubmit={submitCode} className="flex flex-col gap-5">
            <TextField
              label={L({ en: 'Authentication code', ar: 'رمز المصادقة' })}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="num text-center text-2xl tracking-[0.4em]"
              maxLength={20}
              dir="ltr"
              autoFocus
            />
            {error ? <Notice tone="down">{error}</Notice> : null}
            <Button type="submit" size="lg" loading={loading} disabled={code.replace(/\s/g, '').length < 6}>
              <LuShieldCheck className="h-4 w-4" aria-hidden="true" />
              {L({ en: 'Verify and log in', ar: 'تحقق وسجّل الدخول' })}
            </Button>
            <button type="button" className="text-sm text-fg-muted hover:text-fg" onClick={() => setStep('credentials')}>
              {t.common.back}
            </button>
          </form>
        </AuthCard>
      )}
    </AuthLayout>
  );
}
