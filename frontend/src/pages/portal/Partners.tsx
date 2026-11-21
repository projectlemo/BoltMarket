import { FaTelegram, FaWhatsapp, FaXTwitter } from 'react-icons/fa6';
import { LuHandshake, LuUserCheck, LuUserPlus, LuWallet } from 'react-icons/lu';
import { useL, useT } from '../../i18n';
import { absoluteUrl } from '../../lib/head';
import { formatDateTime } from '../../lib/format';
import { portal } from '../../lib/portal-api';
import { toHref, useLang } from '../../router';
import { CopyButton, ErrorNote, useMoney } from '../../components/portal/Bits';
import { Panel, PortalShell, Stat, useLoad } from '../../components/portal/Shell';
import { Badge, EmptyState, Spinner } from '../../components/ui/Feedback';

export default function Partners() {
  const L = useL();
  const t = useT();
  const lang = useLang();
  const money = useMoney();
  const ib = useLoad(() => portal.ib(), []);
  const base = absoluteUrl('/register', lang) || (typeof window !== 'undefined' ? window.location.origin + toHref('/register', lang) : '');
  const link = ib.data ? `${base}?ref=${ib.data.referral_code}` : '';
  const shareText = L({ en: 'Open a trading account with Bolt Markets:', ar: 'افتح حساب تداول مع Bolt Markets:' });

  return (
    <PortalShell title={L({ en: 'Partners', ar: 'الشركاء' })}>
      {ib.loading ? (
        <Spinner label={t.common.loading} />
      ) : ib.error ? (
        <ErrorNote message={ib.error} onRetry={ib.reload} />
      ) : ib.data ? (
        <div className="flex flex-col gap-6">
          <div className="glass flex flex-col gap-4 p-6">
            <p className="font-display text-lg font-bold">{L({ en: 'Your referral link', ar: 'رابط الإحالة الخاص بك' })}</p>
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="num truncate text-sm font-semibold" dir="ltr">
                {link}
              </span>
              <CopyButton value={link} label={L({ en: 'referral link', ar: 'رابط الإحالة' })} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-fg-subtle">{L({ en: 'Code', ar: 'الرمز' })}:</span>
              <span className="num font-semibold" dir="ltr">
                {ib.data.referral_code}
              </span>
              <CopyButton value={ib.data.referral_code} />
              <span className="ms-auto flex gap-2">
                <a className="grid h-9 w-9 place-items-center rounded-lg border border-line hover:border-bolt/40 hover:text-bolt" href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${link}`)}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                  <FaWhatsapp className="h-4 w-4" />
                </a>
                <a className="grid h-9 w-9 place-items-center rounded-lg border border-line hover:border-bolt/40 hover:text-bolt" href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" aria-label="Telegram">
                  <FaTelegram className="h-4 w-4" />
                </a>
                <a className="grid h-9 w-9 place-items-center rounded-lg border border-line hover:border-bolt/40 hover:text-bolt" href={`https://x.com/intent/post?text=${encodeURIComponent(`${shareText} ${link}`)}`} target="_blank" rel="noopener noreferrer" aria-label="X">
                  <FaXTwitter className="h-4 w-4" />
                </a>
              </span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label={L({ en: 'Registered', ar: 'مسجّلون' })} value={String(ib.data.stats.registered)} icon={<LuUserPlus />} />
            <Stat label={L({ en: 'Verified', ar: 'موثّقون' })} value={String(ib.data.stats.verified)} icon={<LuUserCheck />} />
            <Stat label={L({ en: 'Funded', ar: 'ممولون' })} value={String(ib.data.stats.funded)} icon={<LuWallet />} />
            <Stat label={L({ en: 'Commissions credited', ar: 'العمولات المضافة' })} value={money(ib.data.commissions_total)} icon={<LuHandshake />} />
          </div>
          <Panel title={L({ en: 'Your referrals', ar: 'إحالاتك' })}>
            {!ib.data.referrals.length ? (
              <EmptyState icon={<LuUserPlus />} title={L({ en: 'No referrals yet', ar: 'لا توجد إحالات بعد' })}>
                {L({ en: 'Share your link. People who register with it will appear here.', ar: 'شارك رابطك، وسيظهر هنا من يسجّل عبره.' })}
              </EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead>
                    <tr className="text-xs text-fg-subtle">
                      <th className="pb-2 text-start font-medium">{L({ en: 'Client', ar: 'العميل' })}</th>
                      <th className="pb-2 text-start font-medium">{L({ en: 'Country', ar: 'الدولة' })}</th>
                      <th className="pb-2 text-start font-medium">{L({ en: 'Joined', ar: 'تاريخ الانضمام' })}</th>
                      <th className="pb-2 text-end font-medium">{L({ en: 'Status', ar: 'الحالة' })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ib.data.referrals.map((r) => (
                      <tr key={r.id} className="border-t border-line/60">
                        <td className="py-3">{r.name}</td>
                        <td className="py-3">{r.country}</td>
                        <td className="py-3">{formatDateTime(r.joined_at, lang)}</td>
                        <td className="py-3 text-end">
                          <Badge tone={r.status === 'funded' ? 'up' : r.status === 'verified' ? 'info' : 'neutral'}>
                            {r.status === 'funded' ? L({ en: 'Funded', ar: 'ممول' }) : r.status === 'verified' ? L({ en: 'Verified', ar: 'موثّق' }) : L({ en: 'Registered', ar: 'مسجّل' })}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          <p className="text-xs leading-relaxed text-fg-subtle">
            {L({
              en: 'Introducing-broker commission terms are agreed individually with our partnerships team and credited to your account once confirmed. Contact support to discuss a partnership.',
              ar: 'تُتفق شروط عمولات الوسطاء المعرّفين بشكل فردي مع فريق الشراكات، وتُضاف إلى حسابك بعد تأكيدها. تواصل مع الدعم لمناقشة الشراكة.',
            })}
          </p>
        </div>
      ) : null}
    </PortalShell>
  );
}
