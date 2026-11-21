import { useEffect, useState, type FormEvent } from 'react';
import { LuShieldCheck, LuShieldOff, LuUser } from 'react-icons/lu';
import { useL, useT } from '../../i18n';
import type { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { portal } from '../../lib/portal-api';
import { passwordOk } from '../../lib/validate';
import { useNavigate, useRouter } from '../../router';
import { PasswordChecklist } from '../../components/portal/AuthBits';
import { CopyButton, QrCode } from '../../components/portal/Bits';
import { Panel, PortalShell } from '../../components/portal/Shell';
import { Button } from '../../components/ui/Button';
import { Badge, Notice } from '../../components/ui/Feedback';
import { PasswordField, SelectField, TextField } from '../../components/ui/Form';

function Profile() {
  const L = useL();
  const { user, setUser } = useAuth();
  const { state } = useRouter();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: user?.full_name ?? '', phone: user?.phone ?? '', language: user?.language ?? 'en' });
  const [msg, setMsg] = useState<{ tone: 'up' | 'down'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const save = async (ev: FormEvent) => {
    ev.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const u = await portal.updateProfile({ full_name: form.full_name.trim(), phone: form.phone.trim() || null, language: form.language as 'en' | 'ar' });
      setUser(u);
      setMsg({ tone: 'up', text: L({ en: 'Profile saved.', ar: 'تم حفظ الملف.' }) });
      if (u.language !== state.lang) navigate(state.path, { lang: u.language, replace: true });
    } catch (e) {
      setMsg({ tone: 'down', text: (e as ApiError).message });
    } finally {
      setLoading(false);
    }
  };
  return (
    <Panel title={<span className="flex items-center gap-2"><LuUser className="h-4 w-4 text-bolt" aria-hidden="true" />{L({ en: 'Profile', ar: 'الملف الشخصي' })}</span>}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <TextField label={L({ en: 'Full name', ar: 'الاسم الكامل' })} value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} disabled={user?.kyc_status === 'approved'} hint={user?.kyc_status === 'approved' ? L({ en: 'Verified names can be changed through support.', ar: 'يمكن تغيير الاسم الموثّق عبر الدعم.' }) : undefined} />
        <TextField label={L({ en: 'Email', ar: 'البريد الإلكتروني' })} value={user?.email ?? ''} disabled dir="ltr" />
        <TextField label={L({ en: 'Phone', ar: 'الهاتف' })} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} type="tel" autoComplete="tel" dir="ltr" optional={L({ en: 'optional', ar: 'اختياري' })} />
        <SelectField label={L({ en: 'Language for emails and the portal', ar: 'لغة الرسائل والبوابة' })} value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value as 'en' | 'ar' }))}>
          <option value="en">English</option>
          <option value="ar">العربية</option>
        </SelectField>
        {msg ? <Notice tone={msg.tone} className="sm:col-span-2">{msg.text}</Notice> : null}
        <div className="sm:col-span-2">
          <Button type="submit" loading={loading}>{L({ en: 'Save profile', ar: 'حفظ الملف' })}</Button>
        </div>
      </form>
    </Panel>
  );
}

function PasswordPanel() {
  const L = useL();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ tone: 'up' | 'down'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const show = L({ en: 'Show password', ar: 'إظهار كلمة المرور' });
  const hide = L({ en: 'Hide password', ar: 'إخفاء كلمة المرور' });
  const save = async (ev: FormEvent) => {
    ev.preventDefault();
    setMsg(null);
    if (!passwordOk(next)) return setMsg({ tone: 'down', text: L({ en: 'Choose a stronger password.', ar: 'اختر كلمة مرور أقوى.' }) });
    setLoading(true);
    try {
      await portal.changePassword({ current_password: current, new_password: next });
      setCurrent('');
      setNext('');
      setMsg({ tone: 'up', text: L({ en: 'Password changed. Other sessions were signed out.', ar: 'تم تغيير كلمة المرور، وسُجّل الخروج من الجلسات الأخرى.' }) });
    } catch (e) {
      const ae = e as ApiError;
      setMsg({ tone: 'down', text: ae.code === 'INVALID_CREDENTIALS' ? L({ en: 'Your current password is incorrect.', ar: 'كلمة المرور الحالية غير صحيحة.' }) : ae.message });
    } finally {
      setLoading(false);
    }
  };
  return (
    <Panel title={L({ en: 'Password', ar: 'كلمة المرور' })}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <PasswordField label={L({ en: 'Current password', ar: 'كلمة المرور الحالية' })} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} showLabel={show} hideLabel={hide} />
        <PasswordField label={L({ en: 'New password', ar: 'كلمة المرور الجديدة' })} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} showLabel={show} hideLabel={hide} />
        <PasswordChecklist value={next} />
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
        <Button type="submit" loading={loading} className="self-start">{L({ en: 'Change password', ar: 'تغيير كلمة المرور' })}</Button>
      </form>
    </Panel>
  );
}

function TwoFactor() {
  const L = useL();
  const t = useT();
  const { user, reload } = useAuth();
  const [setup, setSetup] = useState<{ secret: string; otpauth_url: string } | null>(null);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [disable, setDisable] = useState({ password: '', code: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => setError(null), [setup]);

  const begin = async () => {
    setLoading(true);
    try {
      setSetup(await portal.setup2fa());
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  };
  const confirm = async (ev: FormEvent) => {
    ev.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await portal.enable2fa(code.replace(/\s/g, ''));
      setRecovery(r.recovery_codes);
      setSetup(null);
      setCode('');
      await reload();
    } catch (e) {
      setError((e as ApiError).code === 'INVALID_CODE' ? L({ en: 'That code is not valid. Check the time on your phone and try again.', ar: 'الرمز غير صحيح. تحقق من توقيت هاتفك وحاول مجددًا.' }) : (e as ApiError).message);
    } finally {
      setLoading(false);
    }
  };
  const turnOff = async (ev: FormEvent) => {
    ev.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await portal.disable2fa(disable);
      setDisable({ password: '', code: '' });
      await reload();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel
      title={L({ en: 'Two-factor authentication', ar: 'المصادقة الثنائية' })}
      action={user?.totp_enabled ? <Badge tone="up">{L({ en: 'On', ar: 'مفعّلة' })}</Badge> : <Badge tone="warn">{L({ en: 'Off', ar: 'غير مفعّلة' })}</Badge>}
    >
      <div className="flex flex-col gap-4">
        {recovery ? (
          <Notice tone="up" title={L({ en: 'Two-factor authentication is on', ar: 'تم تفعيل المصادقة الثنائية' })}>
            <p className="mb-3">{L({ en: 'Save these recovery codes somewhere safe. Each one can be used once if you lose your phone.', ar: 'احفظ رموز الاسترداد هذه في مكان آمن، فكل منها يُستخدم مرة واحدة إذا فقدت هاتفك.' })}</p>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface-2 p-3 font-mono text-sm sm:grid-cols-4" dir="ltr">
              {recovery.map((c) => <span key={c}>{c}</span>)}
            </div>
            <div className="mt-2"><CopyButton value={recovery.join('\n')} label={L({ en: 'recovery codes', ar: 'رموز الاسترداد' })} /></div>
          </Notice>
        ) : null}
        {user?.totp_enabled ? (
          <form onSubmit={turnOff} className="flex flex-col gap-4">
            <p className="text-sm text-fg-muted">{L({ en: 'To turn off two-factor authentication, confirm your password and a current code.', ar: 'لإيقاف المصادقة الثنائية، أكّد كلمة المرور ورمزًا حاليًا.' })}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <PasswordField label={L({ en: 'Password', ar: 'كلمة المرور' })} value={disable.password} onChange={(e) => setDisable((d) => ({ ...d, password: e.target.value }))} showLabel={L({ en: 'Show password', ar: 'إظهار' })} hideLabel={L({ en: 'Hide password', ar: 'إخفاء' })} />
              <TextField label={L({ en: 'Authentication code', ar: 'رمز المصادقة' })} value={disable.code} onChange={(e) => setDisable((d) => ({ ...d, code: e.target.value }))} inputMode="numeric" autoComplete="one-time-code" dir="ltr" />
            </div>
            {error ? <Notice tone="down">{error}</Notice> : null}
            <Button type="submit" variant="danger" loading={loading} className="self-start">
              <LuShieldOff className="h-4 w-4" aria-hidden="true" />
              {L({ en: 'Turn off', ar: 'إيقاف' })}
            </Button>
          </form>
        ) : setup ? (
          <form onSubmit={confirm} className="grid items-start gap-6 sm:grid-cols-[auto_1fr]">
            <QrCode value={setup.otpauth_url} label={L({ en: 'QR code for your authenticator app', ar: 'رمز QR لتطبيق المصادقة' })} />
            <div className="flex flex-col gap-4">
              <ol className="list-decimal ps-5 text-sm text-fg-muted marker:text-bolt">
                <li>{L({ en: 'Open your authenticator app and scan the QR code.', ar: 'افتح تطبيق المصادقة وامسح رمز QR.' })}</li>
                <li>{L({ en: 'Or enter this key manually:', ar: 'أو أدخل هذا المفتاح يدويًا:' })} <span className="num font-mono text-fg" dir="ltr">{setup.secret}</span> <CopyButton value={setup.secret} /></li>
                <li>{L({ en: 'Enter the 6-digit code the app shows.', ar: 'أدخل الرمز المكوّن من 6 أرقام الظاهر في التطبيق.' })}</li>
              </ol>
              <TextField label={L({ en: 'Code', ar: 'الرمز' })} value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} className="num tracking-[0.3em]" dir="ltr" />
              {error ? <Notice tone="down">{error}</Notice> : null}
              <div className="flex gap-2">
                <Button type="submit" loading={loading} disabled={code.replace(/\s/g, '').length !== 6}>{L({ en: 'Turn on', ar: 'تفعيل' })}</Button>
                <Button variant="ghost" onClick={() => setSetup(null)}>{t.common.back}</Button>
              </div>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-fg-muted">{L({ en: 'Protect your account with a 6-digit code from an authenticator app every time you log in.', ar: 'احمِ حسابك برمز من 6 أرقام من تطبيق مصادقة في كل مرة تسجّل فيها الدخول.' })}</p>
            {error ? <Notice tone="down">{error}</Notice> : null}
            <Button onClick={() => void begin()} loading={loading} className="self-start">
              <LuShieldCheck className="h-4 w-4" aria-hidden="true" />
              {L({ en: 'Set up two-factor authentication', ar: 'إعداد المصادقة الثنائية' })}
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}

export default function Settings() {
  const L = useL();
  return (
    <PortalShell title={L({ en: 'Settings', ar: 'الإعدادات' })}>
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2"><Profile /></div>
        <TwoFactor />
        <PasswordPanel />
      </div>
    </PortalShell>
  );
}
