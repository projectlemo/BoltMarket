/**
 * Minimal, dependency-free router built for static prerendering.
 *  - Base path aware (GitHub Pages project sites live under /<repo>/).
 *  - Language prefix: English at "/", Arabic at "/ar/".
 *  - Every route module is resolved *before* render, on the server and the client,
 *    so prerendered HTML hydrates without Suspense fallbacks.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ComponentType,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { routes, notFoundRoute, type RouteDef, type PageProps } from '../routes';

export type Lang = 'en' | 'ar';
export const LANGS: Lang[] = ['en', 'ar'];

const RAW_BASE = import.meta.env.BASE_URL || '/';
export const BASE = RAW_BASE === '/' || RAW_BASE === './' ? '' : '/' + RAW_BASE.replace(/^\/+|\/+$/g, '');

export interface ParsedPath {
  lang: Lang;
  path: string;
}

/** Strip base + language prefix. Result always starts with "/" and has no trailing slash (except root). */
export function parsePath(pathname: string): ParsedPath {
  let p = pathname || '/';
  try {
    p = decodeURI(p);
  } catch {
    /* keep raw */
  }
  if (BASE && (p === BASE || p.startsWith(BASE + '/'))) p = p.slice(BASE.length) || '/';
  p = p.replace(/\/index\.html$/, '/');
  let lang: Lang = 'en';
  if (p === '/ar' || p.startsWith('/ar/')) {
    lang = 'ar';
    p = p.slice(3) || '/';
  }
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return { lang, path: p || '/' };
}

/** Build an href for an internal path. Paths get a trailing slash (static hosting friendly). */
export function toHref(to: string, lang: Lang): string {
  const m = /^([^?#]*)(.*)$/.exec(to) ?? ['', to, ''];
  let p = m[1] || '/';
  const rest = m[2] ?? '';
  if (!p.startsWith('/')) p = '/' + p;
  const prefix = BASE + (lang === 'ar' ? '/ar' : '');
  const clean = p.replace(/\/+$/, '');
  return (clean ? prefix + clean + '/' : prefix + '/') + rest;
}

export interface Match {
  route: RouteDef;
  params: Record<string, string>;
}

function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    const seg = a[i];
    if (seg.startsWith(':')) params[seg.slice(1)] = b[i];
    else if (seg !== b[i]) return null;
  }
  return params;
}

export function matchPath(path: string): Match {
  for (const route of routes) {
    const params = matchPattern(route.path, path);
    if (params) return { route, params };
  }
  return { route: notFoundRoute, params: {} };
}

export interface RouterState {
  pathname: string;
  search: string;
  hash: string;
  lang: Lang;
  path: string;
  match: Match;
  Component: ComponentType<PageProps>;
  data: unknown;
}

async function loadRoute(match: Match, lang: Lang) {
  const params = { ...match.route.props, ...match.params };
  const [mod, data] = await Promise.all([match.route.load(), match.route.loader ? match.route.loader({ params, lang }) : Promise.resolve(undefined)]);
  return { Component: mod.default, data };
}

/** Resolve a URL to a fully-loaded router state (used by prerender and client boot). */
export async function resolveState(url: string): Promise<RouterState> {
  const u = new URL(url, 'http://local.invalid');
  const parsed = parsePath(u.pathname);
  const match = matchPath(parsed.path);
  const { Component, data } = await loadRoute(match, parsed.lang);
  return { pathname: u.pathname, search: u.search, hash: u.hash, ...parsed, match, Component, data };
}

export function prefetchPath(to: string) {
  const { path } = parsePath(to.split(/[?#]/)[0]);
  const { route } = matchPath(path);
  route.load().catch(() => undefined);
}

interface RouterCtx {
  state: RouterState;
  pending: boolean;
  /** Navigate to an app path such as "/portal/accounts" (base + language are added). */
  navigate: (to: string, opts?: { replace?: boolean; lang?: Lang }) => void;
  /** Navigate to an already-built href (used by <Link>). */
  goHref: (href: string) => void;
}

const Ctx = createContext<RouterCtx | null>(null);

export function RouterProvider({ initial, children }: { initial: RouterState; children: ReactNode }) {
  const [state, setState] = useState(initial);
  const [pending, setPending] = useState(false);
  const seq = useRef(0);
  const navKind = useRef<'push' | 'pop' | 'replace' | 'init'>('init');

  const go = useCallback(async (href: string, kind: 'push' | 'pop' | 'replace') => {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) {
      window.location.assign(url.href);
      return;
    }
    const parsed = parsePath(url.pathname);
    const match = matchPath(parsed.path);
    const id = ++seq.current;
    setPending(true);
    let loaded: { Component: ComponentType<PageProps>; data: unknown };
    try {
      loaded = await loadRoute(match, parsed.lang);
    } catch {
      // A deploy replaced chunk files: fall back to a full page load.
      window.location.assign(url.href);
      return;
    }
    if (id !== seq.current) return;
    if (kind === 'push') window.history.pushState(null, '', url.href);
    if (kind === 'replace') window.history.replaceState(null, '', url.href);
    navKind.current = kind;
    setState({ pathname: url.pathname, search: url.search, hash: url.hash, ...parsed, match, ...loaded });
    setPending(false);
  }, []);

  useEffect(() => {
    const onPop = () => void go(window.location.href, 'pop');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [go]);

  // Scroll + document language after each navigation.
  useEffect(() => {
    const el = document.documentElement;
    el.lang = state.lang;
    el.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
    if (navKind.current === 'init' || navKind.current === 'pop') return;
    if (state.hash) {
      const target = document.getElementById(decodeURIComponent(state.hash.slice(1)));
      if (target) {
        target.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [state]);

  const navigate = useCallback(
    (to: string, opts?: { replace?: boolean; lang?: Lang }) => {
      void go(toHref(to, opts?.lang ?? state.lang), opts?.replace ? 'replace' : 'push');
    },
    [go, state.lang],
  );
  const goHref = useCallback((href: string) => void go(href, 'push'), [go]);

  const value = useMemo(() => ({ state, pending, navigate, goHref }), [state, pending, navigate, goHref]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRouter(): RouterCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRouter must be used inside <RouterProvider>');
  return ctx;
}

export const useLang = () => useRouter().state.lang;
export const usePath = () => useRouter().state.path;
export const useSearchParams = () => new URLSearchParams(useRouter().state.search);

export function useNavigate() {
  return useRouter().navigate;
}

export function isActivePath(current: string, to: string, exact = false) {
  const target = to.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (exact || target === '/') return current === target;
  return current === target || current.startsWith(target + '/');
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  to: string;
  lang?: Lang;
  prefetch?: boolean;
  children?: ReactNode;
};

const EXTERNAL = /^(https?:|mailto:|tel:|\/\/)/;

export function Link({ to, lang, prefetch = true, onClick, onMouseEnter, onFocus, target, rel, children, ...rest }: LinkProps) {
  const { state, goHref } = useRouter();
  const external = EXTERNAL.test(to);
  const hashOnly = to.startsWith('#');
  const targetLang = lang ?? state.lang;
  const href = external || hashOnly ? to : toHref(to, targetLang);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || external || hashOnly || target === '_blank') return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    goHref(href);
  };
  const intent = () => {
    if (!external && !hashOnly && prefetch) prefetchPath(href);
  };

  return (
    <a
      {...rest}
      href={href}
      target={external && !to.startsWith('mailto:') && !to.startsWith('tel:') ? (target ?? '_blank') : target}
      rel={external ? (rel ?? 'noopener noreferrer') : rel}
      onClick={handleClick}
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        intent();
      }}
      onFocus={(e) => {
        onFocus?.(e);
        intent();
      }}
    >
      {children}
    </a>
  );
}
