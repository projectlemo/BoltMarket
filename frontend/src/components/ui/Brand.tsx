import clsx from 'clsx';
import { useId } from 'react';

/** The Bolt glyph. Geometry is shared with the favicon and the Figma logo component. */
export const BOLT_PATH = 'M19.2 2.5 7.4 18.1h7.3L12 29.5l12.6-16.6h-7.4z';

export function BoltIcon({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title ? <title>{title}</title> : null}
      <path d={BOLT_PATH} />
    </svg>
  );
}

export function BoltMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#FFD400" />
      <path d={BOLT_PATH} fill="#0A0A0A" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)} dir="ltr">
      <BoltMark className="h-8 w-8 shrink-0" />
      {!compact && (
        <span className="font-display text-[1.15rem] leading-none font-extrabold tracking-tight text-fg">
          Bolt<span className="ms-1 font-semibold text-fg-muted">Markets</span>
        </span>
      )}
    </span>
  );
}

/** Decorative animated lightning line used behind heroes and CTA bands. */
export function BoltLines({ className }: { className?: string }) {
  const id = `bf${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg className={clsx('pointer-events-none', className)} viewBox="0 0 1200 400" fill="none" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#FFD400" stopOpacity="0" />
          <stop offset="0.5" stopColor="#FFD400" stopOpacity="1" />
          <stop offset="1" stopColor="#FFD400" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 260 L260 260 L330 150 L420 300 L520 120 L600 220 L1200 220" stroke="rgb(255 255 255 / 0.06)" strokeWidth="1.5" />
      <path d="M0 260 L260 260 L330 150 L420 300 L520 120 L600 220 L1200 220" stroke={`url(#${id})`} strokeWidth="2" className="bolt-line" />
      <path d="M0 330 L700 330 L760 250 L840 360 L920 200 L990 290 L1200 290" stroke="rgb(255 255 255 / 0.05)" strokeWidth="1.5" />
      <path
        d="M0 330 L700 330 L760 250 L840 360 L920 200 L990 290 L1200 290"
        stroke={`url(#${id})`}
        strokeWidth="1.5"
        className="bolt-line"
        style={{ animationDelay: '-3s' }}
      />
    </svg>
  );
}
