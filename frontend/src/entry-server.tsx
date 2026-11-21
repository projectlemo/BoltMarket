/** Server entry used by scripts/prerender.mjs to generate static HTML for every route. */
import { renderToString } from 'react-dom/server';
import { App } from './App';
import { fullTitle, headTags, type HeadCollector } from './lib/head';
import { LANGS, resolveState, toHref } from './router';
import { routes } from './routes';
import { site } from './config/site';

export async function render(url: string) {
  const state = await resolveState(url);
  const head: HeadCollector = { data: null };
  const html = renderToString(<App initial={state} head={head} />);
  const d = head.data;
  return {
    html,
    lang: state.lang,
    dir: state.lang === 'ar' ? 'rtl' : 'ltr',
    route: `${state.lang}:${state.path}`,
    title: d ? fullTitle(d.title) : site.brand,
    head: d ? headTags(d) : '',
    private: Boolean(state.match.route.private),
    notFound: state.match.route.path === '*',
  };
}

/** Every concrete path (without language prefix) that should be prerendered. */
export async function listPaths(): Promise<{ path: string; private: boolean }[]> {
  const out: { path: string; private: boolean }[] = [];
  for (const r of routes) {
    if (r.path.includes(':')) {
      if (r.staticPaths) for (const p of await r.staticPaths()) out.push({ path: p, private: Boolean(r.private) });
    } else out.push({ path: r.path, private: Boolean(r.private) });
  }
  return out;
}

export { LANGS, toHref, site };
