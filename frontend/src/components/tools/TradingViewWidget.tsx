import { useEffect, useRef, useState } from 'react';
import { site } from '../../config/site';
import { useL } from '../../i18n';
import { useLang } from '../../router';
import { Spinner } from '../ui/Feedback';

type WidgetKind = 'advanced-chart' | 'events';

/**
 * TradingView embed, loaded only when it scrolls into view (third-party script kept off
 * the critical path). Free widgets require the attribution line rendered below.
 */
export function TradingViewWidget({ kind, config, height = 560 }: { kind: WidgetKind; config: Record<string, unknown>; height?: number }) {
  const L = useL();
  const lang = useLang();
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const key = JSON.stringify(config) + lang;

  useEffect(() => {
    const el = host.current;
    if (!el || !site.features.tradingViewWidgets) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!visible || !el) return;
    el.innerHTML = '';
    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    widget.style.height = '100%';
    el.appendChild(widget);
    const script = document.createElement('script');
    script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${kind}.js`;
    script.async = true;
    script.type = 'text/javascript';
    script.innerHTML = JSON.stringify({
      ...config,
      locale: lang === 'ar' ? 'ar_AE' : 'en',
      colorTheme: 'dark',
      theme: 'dark',
      isTransparent: true,
      autosize: true,
      width: '100%',
      height: '100%',
      support_host: 'https://www.tradingview.com',
    });
    script.onload = () => setReady(true);
    el.appendChild(script);
    const timer = window.setTimeout(() => setReady(true), 4000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, key, kind]);

  if (!site.features.tradingViewWidgets) return null;
  return (
    <div className="glass overflow-hidden p-0">
      <div className="relative" style={{ height }}>
        {!ready ? (
          <div className="absolute inset-0 grid place-items-center">
            <Spinner label={L({ en: 'Loading TradingView…', ar: 'جارٍ تحميل TradingView…' })} />
          </div>
        ) : null}
        <div ref={host} className="tradingview-widget-container relative h-full w-full" />
      </div>
      <p className="border-t border-line px-5 py-3 text-xs text-fg-subtle">
        <a href="https://www.tradingview.com/" rel="noopener nofollow noreferrer" target="_blank" className="link">
          {L({ en: 'Charts and data by TradingView', ar: 'الرسوم والبيانات من TradingView' })}
        </a>
        {' · '}
        {L({
          en: 'Third-party content for information only; Bolt Markets is not responsible for its accuracy.',
          ar: 'محتوى طرف ثالث لأغراض المعلومات فقط، ولا تتحمل Bolt Markets مسؤولية دقته.',
        })}
      </p>
    </div>
  );
}
