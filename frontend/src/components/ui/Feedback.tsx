import clsx from 'clsx';
import type { ReactNode } from 'react';
import { LuCircleAlert, LuCircleCheck, LuInfo, LuTriangleAlert } from 'react-icons/lu';

type Tone = 'neutral' | 'bolt' | 'up' | 'down' | 'info' | 'warn';

const toneCls: Record<Tone, string> = {
  neutral: 'bg-white/[0.06] text-fg-muted border-white/10',
  bolt: 'bg-bolt/12 text-bolt border-bolt/30',
  up: 'bg-up/12 text-up border-up/30',
  down: 'bg-down/12 text-down border-down/30',
  info: 'bg-info/12 text-info border-info/30',
  warn: 'bg-warn/12 text-warn border-warn/30',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', toneCls[tone], className)}>
      {children}
    </span>
  );
}

const noticeIcon = {
  info: LuInfo,
  warn: LuTriangleAlert,
  down: LuCircleAlert,
  up: LuCircleCheck,
};

export function Notice({
  tone = 'info',
  title,
  children,
  className,
  action,
}: {
  tone?: keyof typeof noticeIcon;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  const Icon = noticeIcon[tone];
  return (
    <div role={tone === 'down' ? 'alert' : 'status'} className={clsx('flex gap-3 rounded-2xl border p-4 text-sm leading-relaxed', toneCls[tone], className)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? <p className="font-semibold text-fg">{title}</p> : null}
        {children ? <div className="text-fg-muted">{children}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className={clsx('inline-flex items-center gap-2 text-fg-muted', className)}>
      <span className="spinner" aria-hidden="true" />
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
      {icon ? <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.05] text-fg-muted [&>svg]:h-6 [&>svg]:w-6">{icon}</span> : null}
      <p className="font-semibold text-fg">{title}</p>
      {children ? <div className="max-w-md text-sm text-fg-muted">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function StatusDot({ tone = 'up', pulse = false }: { tone?: 'up' | 'down' | 'warn' | 'neutral'; pulse?: boolean }) {
  const c = { up: 'bg-up', down: 'bg-down', warn: 'bg-warn', neutral: 'bg-fg-subtle' }[tone];
  return <span className={clsx('inline-block h-2 w-2 rounded-full', c, pulse && 'animate-pulse-dot')} aria-hidden="true" />;
}
