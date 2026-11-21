import clsx from 'clsx';
import { useMemo, type MouseEvent } from 'react';
import { renderMarkdown } from '../../lib/markdown';
import { toHref, useRouter } from '../../router';

/** Renders Markdown (always HTML-escaped) and routes internal links client-side. */
export function Prose({ markdown, className }: { markdown: string; className?: string }) {
  const { state, goHref } = useRouter();
  const { html } = useMemo(() => renderMarkdown(markdown, (h) => toHref(h, state.lang)), [markdown, state.lang]);
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const href = a.getAttribute('href') ?? '';
    if (href.startsWith('/')) {
      e.preventDefault();
      goHref(href);
    }
  };
  return <div className={clsx('prose-bolt', className)} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function useHeadings(markdown: string) {
  return useMemo(() => renderMarkdown(markdown).headings, [markdown]);
}
