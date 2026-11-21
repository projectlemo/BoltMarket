import clsx from 'clsx';
import { useId } from 'react';

/** Deterministic pseudo-random candles (identical on server and client). */
function candles(n: number, seed: number, h = 120) {
  let v = h / 2;
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: n }, () => {
    const o = v;
    v = Math.max(h * 0.15, Math.min(h * 0.85, v + (rnd() - 0.48) * 18));
    const c = v;
    const hi = Math.min(o, c) - rnd() * 8;
    const lo = Math.max(o, c) + rnd() * 8;
    return { o, c, hi, lo };
  });
}

function CandleChart({ width, height, count, seed, className }: { width: number; height: number; count: number; seed: number; className?: string }) {
  const data = candles(count, seed, height);
  const step = width / count;
  const gid = `cg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${(i + 0.5) * step},${d.c}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#FFD400" stopOpacity="0.22" />
          <stop offset="1" stopColor="#FFD400" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={width} y1={height * f} y2={height * f} stroke="rgb(255 255 255 / 0.05)" />
      ))}
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${gid})`} />
      {data.map((d, i) => {
        const up = d.c <= d.o;
        const x = (i + 0.5) * step;
        return (
          <g key={i} stroke={up ? '#2BD47D' : '#FF6B6B'} fill={up ? '#2BD47D' : '#FF6B6B'}>
            <line x1={x} x2={x} y1={d.hi} y2={d.lo} strokeWidth="1" />
            <rect x={x - step * 0.3} y={Math.min(d.o, d.c)} width={step * 0.6} height={Math.max(1.5, Math.abs(d.c - d.o))} rx="0.8" />
          </g>
        );
      })}
      <path d={line} fill="none" stroke="#FFD400" strokeWidth="1.5" opacity="0.8" />
    </svg>
  );
}

/** Original illustration of a desktop trading terminal. */
export function TerminalMock({ className, title = 'MetaTrader 5' }: { className?: string; title?: string }) {
  return (
    <div className={clsx('glass glass-blur overflow-hidden p-0', className)} aria-hidden="true">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-down/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-warn/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-up/70" />
        <span className="ms-3 text-xs font-semibold text-fg-subtle" dir="ltr">
          {title} · EURUSD, H1
        </span>
      </div>
      <div className="grid grid-cols-[1fr_7.5rem]">
        <div className="p-3">
          <CandleChart width={420} height={220} count={42} seed={7} className="h-56 w-full" />
        </div>
        <div className="flex flex-col gap-1.5 border-s border-line p-3 text-[0.68rem]" dir="ltr">
          {['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'US500', 'BTCUSD', 'USOIL'].map((s, i) => (
            <div key={s} className="flex items-center justify-between rounded-md bg-white/[0.03] px-2 py-1.5">
              <span className="font-semibold text-fg-muted">{s}</span>
              <span className={i % 3 === 0 ? 'text-down' : 'text-up'}>●</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2 border-t border-line p-3">
        <span className="flex-1 rounded-lg bg-down/80 py-2 text-center text-xs font-bold text-white">SELL</span>
        <span className="flex-1 rounded-lg bg-up/80 py-2 text-center text-xs font-bold text-ink">BUY</span>
      </div>
    </div>
  );
}

/** Original illustration of the mobile app. */
export function PhoneMock({ className }: { className?: string }) {
  return (
    <div className={clsx('relative mx-auto w-64 rounded-[2.6rem] border-[6px] border-[#262626] bg-[#0e0e0e] p-3 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.9)]', className)} aria-hidden="true">
      <div className="mx-auto mb-3 h-5 w-24 rounded-full bg-[#1c1c1c]" />
      <div className="flex items-center justify-between px-1 text-[0.7rem]" dir="ltr">
        <span className="font-bold">XAUUSD</span>
        <span className="text-up">● Live</span>
      </div>
      <CandleChart width={220} height={170} count={26} seed={19} className="mt-2 h-44 w-full" />
      <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[0.7rem] font-bold" dir="ltr">
        <span className="rounded-xl bg-down/80 py-2.5 text-white">SELL</span>
        <span className="rounded-xl bg-up/80 py-2.5 text-ink">BUY</span>
      </div>
      <div className="mt-3 flex flex-col gap-1.5" dir="ltr">
        {['EURUSD', 'GBPUSD', 'US500'].map((s) => (
          <div key={s} className="flex justify-between rounded-lg bg-white/[0.04] px-2.5 py-2 text-[0.68rem]">
            <span className="font-semibold">{s}</span>
            <span className="text-fg-subtle">MT5</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Original illustration of an analysis chart with drawing tools. */
export function ChartMock({ className }: { className?: string }) {
  return (
    <div className={clsx('glass glass-blur overflow-hidden p-0', className)} aria-hidden="true">
      <div className="flex items-center justify-between border-b border-line px-4 py-3 text-xs" dir="ltr">
        <span className="font-semibold text-fg-muted">BTCUSD · 4H</span>
        <span className="flex gap-1.5">
          {['1H', '4H', '1D', '1W'].map((tf) => (
            <span key={tf} className={tf === '4H' ? 'rounded bg-bolt px-1.5 text-ink' : 'px-1.5 text-fg-subtle'}>
              {tf}
            </span>
          ))}
        </span>
      </div>
      <div className="relative p-3">
        <CandleChart width={440} height={230} count={48} seed={3} className="h-60 w-full" />
        <svg viewBox="0 0 440 230" className="absolute inset-3 h-60 w-[calc(100%-1.5rem)]" preserveAspectRatio="none">
          <line x1="30" y1="170" x2="420" y2="60" stroke="#6CB4FF" strokeWidth="1.5" strokeDasharray="5 4" />
          <rect x="250" y="70" width="150" height="40" fill="rgb(255 212 0 / 0.08)" stroke="rgb(255 212 0 / 0.5)" />
        </svg>
      </div>
    </div>
  );
}
