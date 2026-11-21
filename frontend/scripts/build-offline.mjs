#!/usr/bin/env node
/**
 * Offline build: produces the same dist/ layout as `vite build` using only esbuild and
 * Tailwind's JavaScript compiler. Used in restricted environments where Vite and the
 * Tailwind native engine are unavailable. `npm run build` (Vite) remains the canonical build.
 *
 *   NODE_PATH=/path/to/node_modules node scripts/build-offline.mjs [--root ../admin]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { require, nodePaths, loadEnv, basePath, envDefine, plugins, walk, copyDir } from './lib/shared.mjs';

const esbuild = require('esbuild');
const tailwind = require('tailwindcss');

const args = process.argv.slice(2);
const rootArg = args.indexOf('--root');
const root = rootArg >= 0 ? path.resolve(args[rootArg + 1]) : path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const env = loadEnv(root);
const base = basePath(env);

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
copyDir(path.join(root, 'public'), dist);

// 1) JavaScript
const js = await esbuild.build({
  entryPoints: { main: path.join(root, 'src/main.tsx') },
  bundle: true,
  splitting: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  jsx: 'automatic',
  outdir: path.join(dist, 'assets'),
  entryNames: '[name]-[hash]',
  chunkNames: 'chunks/[name]-[hash]',
  assetNames: '[name]-[hash]',
  publicPath: base + 'assets/',
  loader: { '.svg': 'file', '.png': 'file', '.webp': 'file', '.woff2': 'file' },
  define: envDefine(env),
  nodePaths,
  plugins: plugins(),
  metafile: true,
  legalComments: 'none',
  logLevel: 'warning',
});
const entryFile = Object.keys(js.metafile.outputs).find((f) => /assets\/main-[^/]+\.js$/.test(f));

// 2) CSS: compile the entry stylesheet with Tailwind's JS compiler and scan sources for candidates.
const cssEntry = path.join(root, 'src/index.css');
const twDir = path.dirname(require.resolve('tailwindcss/package.json'));
const sourceDirs = [path.join(root, 'src'), path.join(root, 'index.html')];
const cssText = fs.readFileSync(cssEntry, 'utf8');
for (const m of cssText.matchAll(/@source\s+"([^"]+)"/g)) sourceDirs.push(path.resolve(path.dirname(cssEntry), m[1]));
// Imported stylesheets may also declare @source; follow one level of relative imports.
for (const m of cssText.matchAll(/@import\s+"(\.[^"]+)"/g)) {
  const imported = path.resolve(path.dirname(cssEntry), m[1]);
  if (fs.existsSync(imported)) sourceDirs.push(path.join(path.dirname(imported)));
}

const compiler = await tailwind.compile(cssText, {
  base: path.dirname(cssEntry),
  loadStylesheet: async (id, fromBase) => {
    let file;
    if (id === 'tailwindcss') file = path.join(twDir, 'index.css');
    else if (id.startsWith('tailwindcss/')) file = path.join(twDir, id.slice('tailwindcss/'.length));
    else file = path.resolve(fromBase, id);
    return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
  },
  loadModule: async (id) => {
    throw new Error(`Tailwind plugin modules are not supported by the offline build: ${id}`);
  },
});

const candidates = new Set();
for (const src of sourceDirs) {
  const files = fs.existsSync(src) && fs.statSync(src).isFile() ? [src] : walk(src, ['.ts', '.tsx', '.md', '.html', '.mjs']);
  for (const f of files) {
    for (const token of fs.readFileSync(f, 'utf8').split(/[\s'"`\\]+/)) {
      const tk = token.replace(/^[({,;]+|[),;]+$/g, '');
      if (tk && tk.length < 220) candidates.add(tk);
    }
  }
}
const rawCss = compiler.build([...candidates]);
const { code: css } = await esbuild.transform(rawCss, { loader: 'css', minify: true, target: ['chrome111', 'safari16.4', 'firefox128'] });
const cssName = `index-${crypto.createHash('sha256').update(css).digest('hex').slice(0, 8)}.css`;
fs.writeFileSync(path.join(dist, 'assets', cssName), css);

// 3) HTML shell
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/(href|src)="\/(?!\/)([^"]*)"/g, (all, attr, rest) => (rest.startsWith('src/') ? all : `${attr}="${base}${rest}"`));
html = html.replace(
  /<script type="module" src="\/src\/main\.tsx"><\/script>/,
  () => `<script type="module" crossorigin src="${base}${path.relative(dist, path.resolve(entryFile)).split(path.sep).join('/')}"></script>`,
);
html = html.replace('</head>', () => `  <link rel="stylesheet" crossorigin href="${base}assets/${cssName}">\n  </head>`);
fs.writeFileSync(path.join(dist, 'index.html'), html);

const jsBytes = Object.entries(js.metafile.outputs)
  .filter(([f]) => f.endsWith('.js'))
  .reduce((n, [, o]) => n + o.bytes, 0);
console.log(`offline build ✓  base=${base}  js=${(jsBytes / 1024).toFixed(0)}KB  css=${(css.length / 1024).toFixed(1)}KB  candidates=${candidates.size}`);
