import { useEffect, useState, type FormEvent } from 'react';
import { LuCircleCheck, LuMailWarning } from 'react-icons/lu';
import { useL, useT } from '../../i18n';
import { api, type ApiError } from '../../lib/api';
import { Seo } from '../../lib/head';
import { isEmail } from '../../lib/validate';
import { useLang, useRouter } from '../../router';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthCard } from '../../components/portal/AuthBits';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Feedback';
import { TextField } from '../../components/ui/Form';

export default function VerifyEmail() {
  const L = useL();
  const t = useT();
  const lang = useLang();
  const { state } = useRouter();
  const [phase, setPhase] = useState<'idle' | 'verifying' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [resent, setResent] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(state.search).get('token');
    if (!token) return;
    setPhase('verifying');
    api('/auth/verify-email', { body: { token }, auth: false })
      .then(() => setPhase('done'))
      .catch((e: ApiError) => {
        setPhase('error');
        setMessage(
          e.code === 'TOKEN_EXPIRED'
            ? L({ en: 'This link has expired. Request a new one below.', ar: 'انتهت صلاحية هذا الرابط. اطلب رابطًا جديدًا أدناه.' })
            : L({ en: 'This link is not valid. Request a new one below.', ar: 'هذا الرابط غير صالح. اطلب رابطًا جديدًا أدناه.' }),
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.search]);

  const resend = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!isEmail(email)) return;
    try {
      await api('/auth/resend-verification', { body: { email: email.trim(), language: lang }, auth: false });
    } finally {
      setResent(true);
    }
  };

  return (
    <AuthLayout>
      <Seo title={L({ en: 'Confirm your email', ar: 'تأكيد البريد الإلكتروني' })} noindex />
      {phase === 'verifying' ? (
        <div className="flex justify-center py-16">
          <Spinner label={L({ en: 'Confirming your email…', ar: 'جارٍ تأكيد بريدك…' })} />
        </div>
      ) : phase === 'done' ? (
        <AuthCard title={L({ en: 'Email confirmed', ar: 'تم تأكيد البريد' })}>
          <div className="glass flex flex-col items-center gap-4 p-6 text-center">
            <LuCircleCheck className="h-12 w-12 text-up" aria-hidden="true" />
            <p className="text-fg-muted">{L({ en: 'Your profile is active. Log in to open your first MT5 account.', ar: 'ملفك مفعّل الآن. سجّل الدخول لفتح أول حساب على ميتاتريدر 5.' })}</p>
            <ButtonLink to="/login?next=/portal/accounts">{t.common.login}</ButtonLink>
          </div>
        </AuthCard>
      ) : (
        <AuthCard
          title={L({ en: 'Confirm your email', ar: 'أكّد بريدك الإلكتروني' })}
          subtitle={
            phase === 'error'
              ? message
              : L({ en: 'Open the link we emailed you. Need a new one? Enter your email below.', ar: 'افتح الرابط الذي أرسلناه إليك. تحتاج رابطًا جديدًا؟ أدخل بريدك أدناه.' })
          }
        >
          {phase === 'error' ? <LuMailWarning className="h-10 w-10 text-warn" aria-hidden="true" /> : null}
          {resent ? (
            <p className="text-up">{L({ en: 'If an account exists for that email, a new link is on its way.', ar: 'إذا كان هناك حساب بهذا البريد، فرابط جديد في طريقه إليك.' })}</p>
          ) : (
            <form onSubmit={resend} className="flex flex-col gap-4" noValidate>
              <TextField label={L({ en: 'Email', ar: 'البريد الإلكتروني' })} type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" autoComplete="email" />
              <Button type="submit" disabled={!isEmail(email)}>
                {L({ en: 'Send a new link', ar: 'أرسل رابطًا جديدًا' })}
              </Button>
            </form>
          )}
        </AuthCard>
      )}
    </AuthLayout>
  );
}
