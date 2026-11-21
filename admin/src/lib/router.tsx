/** Hash router: /#/clients/12?tab=money — works on static hosting without server rewrites. */
import { createContext, useContext, useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';

export interface Location {
  path: string;
  query: URLSearchParams;
}

function read(): Location {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, search = ''] = raw.split('?');
  return { path: path.startsWith('/') ? path : `/${path}`, query: new URLSearchParams(search) };
}

const Ctx = createContext<Location>({ path: '/', query: new URLSearchParams() });

export function RouterProvider({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState<Location>(read);
  useEffect(() => {
    const on = () => {
      setLoc(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return <Ctx.Provider value={loc}>{children}</Ctx.Provider>;
}

export const useLocation = () => useContext(Ctx);

export function navigate(to: string) {
  window.location.hash = to;
}

/** Updates query parameters on the current route without adding history entries per keystroke. */
export function setQuery(patch: Record<string, string | number | null | undefined>) {
  const { path, query } = read();
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === '') query.delete(k);
    else query.set(k, String(v));
  }
  const qs = query.toString();
  window.history.replaceState(null, '', `#${path}${qs ? `?${qs}` : ''}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function Link({ to, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={`#${to}`} {...rest} />;
}

export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}
