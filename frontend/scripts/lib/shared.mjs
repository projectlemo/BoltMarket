// Helpers shared by build-offline.mjs and prerender.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// CommonJS require honours NODE_PATH, which lets these scripts run in sandboxes
// where packages live outside the project (see README "Offline build").
export const require = createRequire(import.meta.url);

export const nodePaths = (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean);

/** Same precedence as Vite's loadEnv for mode "production": files first, process.env wins. */
export function loadEnv(root, mode = 'production') {
  const files = ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`];
  const out = {};
  for (const f of files) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!m || line.trim().startsWith('#')) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      out[m[1]] = v;
    }
  }
  for (const [k, v] of Object.entries(process.env)) if (k.startsWith('VITE_') && v !== undefined) out[k] = v;
  return Object.fromEntries(Object.entries(out).filter(([k]) => k.startsWith('VITE_')));
}

/** Mirrors vite.config.ts: VITE_BASE_PATH=bolt-markets → "/bolt-markets/". */
export function basePath(env) {
  const b = (env.VITE_BASE_PATH || '').replace(/^\/+|\/+$/g, '');
  return b ? `/${b}/` : '/';
}

export function envDefine(env, { ssr = false } = {}) {
  const obj = { ...env, BASE_URL: basePath(env), MODE: 'production', DEV: false, PROD: true, SSR: ssr };
  return { 'import.meta.env': JSON.stringify(obj) };
}

/** esbuild plugins: Vite-style `?raw` imports, and CSS handled outside esbuild. */
export function plugins({ stubCss = true } = {}) {
  return [
    {
      name: 'raw',
      setup(build) {
        build.onResolve({ filter: /\?raw$/ }, (args) => ({
          path: path.resolve(args.resolveDir, args.path.replace(/\?raw$/, '')),
          namespace: 'raw',
        }));
        build.onLoad({ filter: /.*/, namespace: 'raw' }, (args) => ({
          contents: fs.readFileSync(args.path, 'utf8'),
          loader: 'text',
        }));
      },
    },
    {
      name: 'css-and-fonts',
      setup(build) {
        if (!stubCss) return;
        // Tailwind CSS and @fontsource stylesheets are produced separately.
        build.onResolve({ filter: /(\.css$|^@fontsource)/ }, (args) => ({ path: args.path, namespace: 'stub' }));
        build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: '', loader: 'js' }));
      },
    },
  ];
}

export function walk(dir, exts, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
      walk(p, exts, acc);
    } else if (exts.some((x) => e.name.endsWith(x))) acc.push(p);
  }
  return acc;
}

export function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
