import clsx from 'clsx';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { LuPlus, LuX } from 'react-icons/lu';

export interface QA {
  q: string;
  a: ReactNode;
}

/** FAQ / accordion built on <details> so it works before hydration and without JS. */
export function Accordion({ items, className }: { items: QA[]; className?: string }) {
  return (
    <div className={clsx('flex flex-col gap-3', className)}>
      {items.map((it) => (
        <details key={it.q} className="group glass overflow-hidden open:border-bolt/30">
          <summary className="flex items-center justify-between gap-4 px-5 py-4 text-start text-base font-semibold text-fg transition hover:text-bolt sm:px-6 sm:py-5">
            <span>{it.q}</span>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 text-fg-muted transition group-open:rotate-45 group-open:border-bolt/40 group-open:text-bolt">
              <LuPlus className="h-4 w-4" aria-hidden="true" />
            </span>
          </summary>
          <div className="px-5 pb-5 text-[0.97rem] leading-relaxed text-fg-muted sm:px-6">{it.a}</div>
        </details>
      ))}
    </div>
  );
}

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
  };
}

/** Accessible tabs with arrow-key navigation (WAI-ARIA pattern). */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
  size = 'md',
}: {
  tabs: { id: T; label: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = tabs.findIndex((t) => t.id === value);
    const rtl = document.documentElement.dir === 'rtl';
    let next = idx;
    if (e.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) next = (idx + 1) % tabs.length;
    else if (e.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKey}
      className={clsx('scrollbar-none inline-flex max-w-full overflow-x-auto rounded-2xl border border-line bg-surface/80 p-1', className)}
    >
      {tabs.map((t, i) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${base}-tab-${t.id}`}
            aria-selected={active}
            aria-controls={`${base}-panel`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={clsx(
              'shrink-0 rounded-xl font-semibold whitespace-nowrap transition',
              size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm sm:text-[0.95rem]',
              active ? 'bg-bolt text-bolt-ink shadow-[0_6px_20px_-8px_rgb(255_212_0/0.6)]' : 'text-fg-muted hover:bg-white/5 hover:text-fg',
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Modal dialog on the native <dialog> element (focus trap and Esc handled by the browser). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  closeLabel,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  closeLabel: string;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open, mounted]);
  if (!mounted) return null;
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={clsx(
        'm-auto w-[calc(100%-2rem)] rounded-3xl border border-white/10 bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm',
        wide ? 'max-w-2xl' : 'max-w-lg',
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
        <h2 id={titleId} className="text-lg font-bold">
          {title}
        </h2>
        <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-fg-muted hover:bg-white/5 hover:text-fg" aria-label={closeLabel}>
          <LuX className="h-5 w-5" />
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto px-6 py-5">{children}</div>
    </dialog>
  );
}
