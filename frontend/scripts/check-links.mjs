#!/usr/bin/env node
/**
 * Verifies every internal link and anchor in the built site resolves to a real file
 * or element id. Exits with code 1 on any broken link. External URLs are listed.
 *   node scripts/check-links.mjs [distDir]
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv, basePath, walk } from './lib/shared.mjs';

const root = path.resolve(import.meta.dirname, '..');
const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dist = path.resolve(positional[0] || path.join(root, 'dist'));
if (!fs.existsSync(dist)) {
  console.error(`No build found at ${dist}`);
  process.exit(1);
}
const base = basePath(loadEnv(root)).replace(/\/$/, '');

const pages = walk(dist, ['.html']);
const idsCache = new Map();
const ids = (file) => {
  if (!idsCache.has(file)) {
    const html = fs.readFileSync(file, 'utf8');
    idsCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idsCache.get(file);
};

function resolveTarget(url) {
  let p = url.split('#')[0].split('?')[0];
  if (base && p.startsWith(base)) p = p.slice(base.length);
  if (!p.startsWith('/')) return null;
  const file = path.join(dist, decodeURI(p));
  if (p.endsWith('/')) return path.join(file, 'index.html');
  return file;
}

const broken = [];
const external = new Set();
let checked = 0;
for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  for (const m of html.matchAll(/\s(href|src)="([^"]+)"/g)) {
    const url = m[2].replace(/&amp;/g, '&');
    if (/^(mailto:|tel:|data:|javascript:)/.test(url)) continue;
    if (/^(https?:)?\/\//.test(url)) {
      external.add(url);
      continue;
    }
    checked++;
    if (url.startsWith('#')) {
      const id = decodeURIComponent(url.slice(1));
      if (id && !ids(page).has(id)) broken.push(`${path.relative(dist, page)} → ${url} (missing id)`);
      continue;
    }
    const target = resolveTarget(url);
    if (!target) continue;
    if (!fs.existsSync(target)) {
      broken.push(`${path.relative(dist, page)} → ${url}`);
      continue;
    }
    const hash = url.includes('#') ? decodeURIComponent(url.split('#')[1]) : '';
    if (hash && target.endsWith('.html') && !ids(target).has(hash)) broken.push(`${path.relative(dist, page)} → ${url} (missing anchor)`);
  }
}

console.log(`links: ${checked} internal checked across ${pages.length} pages, ${external.size} unique external`);
if (process.argv.includes('--external')) [...external].sort().forEach((u) => console.log('  ext', u));
if (broken.length) {
  console.error(`\n✗ ${broken.length} broken link(s):`);
  [...new Set(broken)].slice(0, 200).forEach((b) => console.error('  ' + b));
  process.exit(1);
}
console.log('✓ no broken internal links');
