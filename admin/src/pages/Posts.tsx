import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { LuArrowLeft, LuPlus, LuTrash2 } from 'react-icons/lu';
import { renderMarkdown } from '../../../frontend/src/lib/markdown';
import {
  Button,
  type Column,
  Empty,
  ErrorNote,
  FilterSelect,
  PageHeader,
  Pager,
  SearchBox,
  Select,
  Spinner,
  StatusBadge,
  Table,
  TextArea,
  TextInput,
  useToast,
} from '../components/ui';
import { api } from '../lib/api';
import { dateTime, label } from '../lib/format';
import { qs, useAction, useDebounced, useResource } from '../lib/hooks';
import { Link, navigate, setQuery, useLocation } from '../lib/router';
import type { Page, Post } from '../lib/types';

const cols: Column<Post>[] = [
  {
    key: 'title',
    header: 'Article',
    render: (p) => (
      <span className="block max-w-xl">
        <span className="block truncate font-semibold" dir="auto">
          {p.title}
        </span>
        <span className="block truncate font-mono text-xs text-fg-subtle">/{p.slug}</span>
      </span>
    ),
  },
  { key: 'lang', header: 'Language', render: (p) => (p.language === 'ar' ? 'Arabic' : 'English') },
  { key: 'cat', header: 'Section', render: (p) => label(p.category) },
  { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
  { key: 'pub', header: 'Published', render: (p) => dateTime(p.published_at) },
];

export function Posts() {
  const { query } = useLocation();
  const [q, setQ] = useState(query.get('q') ?? '');
  const term = useDebounced(q);
  const lang = query.get('lang') ?? '';
  const status = query.get('status') ?? '';
  const page = Number(query.get('page') ?? 1);
  const { data, error, loading, reload } = useResource<Page<Post>>(`/admin/posts${qs({ lang, status, q: term, page })}`);
  return (
    <>
      <PageHeader
        title="Blog"
        subtitle="Articles published here appear in News & Learn. English and Arabic versions share the same address (slug)."
        actions={
          <Button variant="primary" onClick={() => navigate('/posts/new')}>
            <LuPlus className="h-4 w-4" /> New article
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setQuery({ page: null }); }} placeholder="Title or slug" />
        <FilterSelect label="Language" value={lang} onChange={(v) => setQuery({ lang: v, page: null })} options={[{ value: '', label: 'Both languages' }, { value: 'en', label: 'English' }, { value: 'ar', label: 'Arabic' }]} />
        <FilterSelect label="Status" value={status} onChange={(v) => setQuery({ status: v, page: null })} options={[{ value: '', label: 'Any status' }, { value: 'published', label: 'Published' }, { value: 'draft', label: 'Drafts' }]} />
      </div>
      <ErrorNote error={error} onRetry={reload} />
      <div className="card mt-4 overflow-hidden">
        {loading && !data ? (
          <Spinner />
        ) : (
          <>
            <Table
              rows={data?.items ?? []}
              columns={cols}
              onRow={(p) => navigate(`/posts/${p.id}`)}
              empty={<Empty title="No articles yet">Run <span className="kbd">python -m app.cli seed-blog</span> on the server to import the 10 starter articles, or write a new one.</Empty>}
            />
            {data && data.total > 0 && <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={(p) => setQuery({ page: p })} />}
          </>
        )}
      </div>
    </>
  );
}

type Draft = Pick<Post, 'slug' | 'language' | 'category' | 'title' | 'excerpt' | 'status'> & { body_md: string };

const EMPTY: Draft = { slug: '', language: 'en', category: 'learn', title: '', excerpt: '', body_md: '', status: 'draft' };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .slice(0, 80);

function Editor({ initial, post }: { initial: Draft; post?: Post }) {
  const toast = useToast();
  const [d, setD] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const { busy, run } = useAction();
  const preview = useMemo(() => (tab === 'preview' ? renderMarkdown(d.body_md).html : ''), [tab, d.body_md]);
  const words = d.body_md.trim() ? d.body_md.trim().split(/\s+/).length : 0;

  const save = async (status: Draft['status']) => {
    setErrors({});
    const body = { ...d, status };
    const res = await run(() => (post ? api<Post>(`/admin/posts/${post.id}`, { method: 'PATCH', body }) : api<Post>('/admin/posts', { body })));
    if (res.ok) {
      toast('ok', status === 'published' ? 'Published. The website rebuild has been requested.' : 'Draft saved.');
      setD({ ...d, status: res.value.status });
      if (!post) navigate(`/posts/${res.value.id}`);
    } else {
      setErrors(res.error.fields);
      toast('error', res.error.message);
    }
  };
  const remove = async () => {
    if (!post || !window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    const res = await run(() => api(`/admin/posts/${post.id}`, { method: 'DELETE' }));
    if (res.ok) {
      toast('ok', 'Article deleted.');
      navigate('/posts');
    } else toast('error', res.error.message);
  };

  return (
    <>
      <Link to="/posts" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
        <LuArrowLeft className="h-4 w-4" /> Blog
      </Link>
      <PageHeader
        title={post ? 'Edit article' : 'New article'}
        subtitle={post ? <span className="flex items-center gap-2">Last saved {dateTime(post.updated_at)} <StatusBadge status={d.status} /></span> : 'Drafts are only visible here.'}
        actions={
          <>
            {post && (
              <Button variant="danger" busy={busy} onClick={() => void remove()}>
                <LuTrash2 className="h-4 w-4" /> Delete
              </Button>
            )}
            {d.status === 'published' ? (
              <Button busy={busy} onClick={() => void save('draft')}>
                Unpublish
              </Button>
            ) : (
              <Button busy={busy} onClick={() => void save('draft')}>
                Save draft
              </Button>
            )}
            <Button variant="primary" busy={busy} onClick={() => void save('published')}>
              {d.status === 'published' ? 'Update' : 'Publish'}
            </Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <TextInput
            label="Title"
            value={d.title}
            dir="auto"
            onChange={(e) => setD({ ...d, title: e.target.value, slug: post || d.slug !== slugify(d.title) ? d.slug : slugify(e.target.value) })}
            error={errors.title}
          />
          <TextArea label="Summary (shown in lists and search results)" value={d.excerpt} dir="auto" rows={2} onChange={(e) => setD({ ...d, excerpt: e.target.value })} error={errors.excerpt} />
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <div role="tablist" className="flex gap-1">
                {(['write', 'preview'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={clsx('rounded-lg px-3 py-1.5 text-sm font-semibold', tab === t ? 'bg-white/10 text-fg' : 'text-fg-subtle hover:text-fg')}
                  >
                    {label(t)}
                  </button>
                ))}
              </div>
              <span className="text-xs text-fg-subtle">
                {words} words · ~{Math.max(1, Math.round(words / 220))} min read
              </span>
            </div>
            {tab === 'write' ? (
              <textarea
                aria-label="Article body (Markdown)"
                value={d.body_md}
                onChange={(e) => setD({ ...d, body_md: e.target.value })}
                dir="auto"
                className="min-h-[28rem] w-full resize-y bg-ink p-4 font-mono text-sm leading-6 text-fg focus:outline-none"
                placeholder={'## A clear heading\n\nShort paragraphs, **bold** for key terms, lists with - and links like [text](/markets/forex).'}
              />
            ) : (
              <div className="prose-admin min-h-[28rem] p-6" dir={d.language === 'ar' ? 'rtl' : 'ltr'} lang={d.language} dangerouslySetInnerHTML={{ __html: preview }} />
            )}
          </div>
          {errors.body_md && <p className="text-xs text-down">{errors.body_md}</p>}
        </div>
        <div className="space-y-4">
          <div className="card space-y-4 p-5">
            <TextInput label="Address (slug)" value={d.slug} onChange={(e) => setD({ ...d, slug: slugify(e.target.value) })} error={errors.slug} hint={`/blog/${d.slug || 'your-article'}`} />
            <Select label="Language" value={d.language} disabled={!!post} onChange={(e) => setD({ ...d, language: e.target.value as Draft['language'] })} options={[{ value: 'en', label: 'English' }, { value: 'ar', label: 'Arabic' }]} />
            <Select label="Section" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as Draft['category'] })} options={[{ value: 'learn', label: 'Learn (education)' }, { value: 'insights', label: 'Insights (markets)' }]} />
          </div>
          <div className="card p-5 text-sm text-fg-muted">
            <p className="font-semibold text-fg">Writing checklist</p>
            <ul className="mt-2 list-disc space-y-1.5 ps-5">
              <li>Educational tone: no promises of profit or trade signals.</li>
              <li>Mention that leveraged trading carries a high risk of loss where relevant.</li>
              <li>Publish the Arabic version with the same address so readers can switch languages.</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

export function PostEditor({ id }: { id?: string }) {
  const { data, error, loading, reload } = useResource<Post>(id ? `/admin/posts/${id}` : null);
  if (!id) return <Editor initial={EMPTY} />;
  if (loading && !data) return <Spinner />;
  if (!data) return <ErrorNote error={error} onRetry={reload} />;
  return <Editor key={data.id} post={data} initial={{ slug: data.slug, language: data.language, category: data.category, title: data.title, excerpt: data.excerpt, body_md: data.body_md ?? '', status: data.status }} />;
}
