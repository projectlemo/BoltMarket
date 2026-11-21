#!/usr/bin/env node
/**
 * Static site generation: renders every route in English and Arabic to its own
 * index.html (GitHub Pages friendly, fast first paint, fully indexable), plus 404.html,
 * sitemap.xml and robots.txt. Runs after `vite build` (or the offline build).
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { require, nodePaths, loadEnv, basePath, envDefine, plugins } from './lib/shared.mjs';

const esbuild = require('esbuild');
const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const env = loadEnv(root);
const base = basePath(env);
const baseNoSlash = base.replace(/\/$/, '');

const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
if (!template.includes('<!--app-->')) {
  console.error('dist/index.html has no <!--app--> placeholder. Run the client build first.');
  process.exit(1);
}

const outfile = path.join(root, '.ssr', 'entry-server.mjs');
await esbuild.build({
  entryPoints: [path.join(root, 'src/entry-server.tsx')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  jsx: 'automatic',
  outfile,
  define: envDefine(env, { ssr: true }),
  nodePaths,
  plugins: plugins(),
  logLevel: 'warning',
  banner: { js: "import { createRequire as __bmRequire } from 'node:module'; const require = __bmRequire(import.meta.url);" },
});

const ssr = await import(pathToFileURL(outfile).href);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function fill(r) {
  return template
    .replace(/<html[^>]*>/, () => `<html lang="${r.lang}" dir="${r.dir}">`)
    .replace('<!--head-->', () => `<title>${esc(r.title)}</title>\n    ${r.head}`)
    .replace('<div id="root"><!--app--></div>', () => `<div id="root" data-route="${r.route}">${r.html}</div>`);
}

function write(rel, html) {
  const file = path.join(dist, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

const entries = await ssr.listPaths();
const urls = [];
let count = 0;
for (const { path: p, private: priv } of entries) {
  for (const lang of ssr.LANGS) {
    const href = ssr.toHref(p, lang);
    const r = await ssr.render(href);
    if (r.notFound) throw new Error(`Route resolved to 404 during prerender: ${href}`);
    const rel = href.slice(baseNoSlash.length) + 'index.html';
    write(rel, fill(r));
    count++;
    if (!priv) urls.push({ p });
  }
}

// 404 page (served by GitHub Pages for unknown URLs; the client router then takes over).
const nf = await ssr.render(`${baseNoSlash}/__not-found__/`);
write('404.html', fill(nf));

// Sitemap + robots
const siteUrl = (ssr.site.url || '').replace(/\/$/, '');
const unique = [...new Set(urls.map((u) => u.p))];
if (siteUrl) {
  const abs = (p, lang) => siteUrl + ssr.toHref(p, lang).slice(baseNoSlash.length);
  const body = unique
    .flatMap((p) =>
      ssr.LANGS.map(
        (lang) =>
          `  <url>\n    <loc>${abs(p, lang)}</loc>\n` +
          ssr.LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${abs(p, l)}"/>`).join('\n') +
          `\n  </url>`,
      ),
    )
    .join('\n');
  write(
    'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`,
  );
}
write('robots.txt', `User-agent: *\nAllow: /\n${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ''}`);
// GitHub Pages: serve files and folders starting with "_" and skip Jekyll processing.
write('.nojekyll', '');

fs.rmSync(path.join(root, '.ssr'), { recursive: true, force: true });
console.log(`prerender ✓  ${count} pages (${unique.length} public routes × ${ssr.LANGS.length} languages) + 404.html${siteUrl ? ' + sitemap.xml' : ''}`);
