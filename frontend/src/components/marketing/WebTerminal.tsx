import { useState } from 'react';
import { LuExternalLink, LuPlay } from 'react-icons/lu';
import { site, webTerminalEmbedUrl } from '../../config/site';
import { useL } from '../../i18n';
import { useLang } from '../../router';
import { Button, ButtonLink } from '../ui/Button';
import { TerminalMock } from './Illustrations';

/**
 * Click-to-load MT5 WebTerminal: the third-party iframe only loads when the visitor asks for it,
 * keeping page speed high. Without a configured server it offers the official web platform link.
 */
export function WebTerminal() {
  const L = useL();
  const lang = useLang();
  const embed = webTerminalEmbedUrl(lang);
  const [loaded, setLoaded] = useState(false);

  if (embed && loaded) {
    return (
      <div className="glass overflow-hidden p-0">
        <iframe
          src={embed}
          title={L({ en: 'MetaTrader 5 WebTerminal', ar: 'منصة ميتاتريدر 5 على الويب' })}
          className="h-[min(78vh,46rem)] w-full border-0"
          allow="clipboard-write; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <TerminalMock className="opacity-60 blur-[1px]" />
      <div className="absolute inset-0 grid place-items-center p-6">
        <div className="glass glass-blur flex max-w-md flex-col items-center gap-4 p-6 text-center">
          <p className="font-display text-xl font-bold">{L({ en: 'Trade in this window', ar: 'تداول من هذه النافذة' })}</p>
          <p className="text-sm text-fg-muted">
            {embed
              ? L({
                  en: 'Load the MetaTrader 5 WebTerminal right here and log in with the details from your client portal.',
                  ar: 'شغّل منصة ميتاتريدر 5 على الويب هنا وسجّل الدخول بالبيانات الظاهرة في بوابة العملاء.',
                })
              : L({
                  en: `Open the MetaTrader 5 web platform and search for the ${site.brand} server name shown next to your account in the client portal.`,
                  ar: `افتح منصة ميتاتريدر 5 على الويب وابحث عن اسم خادم ${site.brand} الظاهر بجانب حسابك في بوابة العملاء.`,
                })}
          </p>
          {embed ? (
            <Button onClick={() => setLoaded(true)}>
              <LuPlay className="h-4 w-4" aria-hidden="true" />
              {L({ en: 'Load WebTerminal', ar: 'تشغيل المنصة' })}
            </Button>
          ) : (
            <ButtonLink to={site.mt5.downloads.web}>
              {L({ en: 'Open web platform', ar: 'افتح منصة الويب' })}
              <LuExternalLink className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
          )}
        </div>
      </div>
    </div>
  );
}
