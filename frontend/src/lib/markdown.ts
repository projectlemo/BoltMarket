/**
 * Small, safe Markdown renderer for articles, legal documents and CMS posts.
 * Supports headings, paragraphs, emphasis, inline code, links, lists, blockquotes,
 * tables and rules. All text is HTML-escaped; raw HTML in the source is never emitted.
 * Unit-tested in tests/unit/markdown.test.ts.
 */
export interface Heading {
  id: string;
  text: string;
  level: number;
}

export interface Rendered {
  html: string;
  headings: Heading[];
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[ً-ٰٟ]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'section'
  );
}

function safeUrl(url: string): string | null {
  const u = url.trim();
  if (/^(https?:|mailto:)/i.test(u) || u.startsWith('/') || u.startsWith('#')) return u;
  return null;
}

function inline(src: string, resolveLink: (href: string) => string): string {
  // Protect code spans first.
  const codes: string[] = [];
  let s = src.replace(/`([^`]+)`/g, (_, c: string) => {
    codes.push(`<code>${escapeHtml(c)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = escapeHtml(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, href: string) => {
    const raw = href.replace(/&amp;/g, '&');
    const ok = safeUrl(raw);
    if (!ok) return text;
    const external = /^https?:/i.test(ok);
    const final = escapeHtml(external || ok.startsWith('#') || ok.startsWith('mailto:') ? ok : resolveLink(ok));
    return `<a href="${final}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codes[Number(i)]);
  return s;
}

export function renderMarkdown(md: string, resolveLink: (href: string) => string = (h) => h): Rendered {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  const headings: Heading[] = [];
  const used = new Map<string, number>();
  let i = 0;

  const isBlockStart = (l: string) => /^(#{1,4}\s|[-*]\s|\d+\.\s|>\s?|\|)/.test(l) || /^-{3,}\s*$/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = Math.min(4, Math.max(2, h[1].length));
      const text = h[2].trim();
      let id = slugify(text);
      const n = used.get(id) ?? 0;
      used.set(id, n + 1);
      if (n) id = `${id}-${n + 1}`;
      headings.push({ id, text, level });
      out.push(`<h${level} id="${escapeHtml(id)}">${inline(text, resolveLink)}</h${level}>`);
      i++;
      continue;
    }
    if (/^-{3,}\s*$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote><p>${inline(buf.join(' '), resolveLink)}</p></blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const re = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) {
        let item = lines[i++].replace(re, '');
        while (i < lines.length && /^\s{2,}\S/.test(lines[i])) item += ' ' + lines[i++].trim();
        items.push(`<li>${inline(item, resolveLink)}</li>`);
      }
      out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\|/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const cells = (l: string) =>
        l
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c, resolveLink)}</th>`).join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c, resolveLink)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) para.push(lines[i++].trim());
    if (para.length) out.push(`<p>${inline(para.join(' '), resolveLink)}</p>`);
    else i++;
  }
  return { html: out.join('\n'), headings };
}
