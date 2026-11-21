#!/usr/bin/env node
/**
 * Regenerates the PNG brand assets in public/ (touch icon, PWA icons, Open Graph image).
 * Requires `sharp` and `playwright` (with Chromium) to be resolvable, e.g.:
 *   npm i -D sharp playwright && npx playwright install chromium && node scripts/generate-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { require } from './lib/shared.mjs';

const sharp = require('sharp');
const { chromium } = require('playwright');
const pub = path.resolve(import.meta.dirname, '../public');
const BOLT = 'M19.2 2.5 7.4 18.1h7.3L12 29.5l12.6-16.6h-7.4z';

const icon = (size, pad) => {
  const inner = size - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#0A0A0A"/>
    <g transform="translate(${pad} ${pad}) scale(${inner / 32})"><rect width="32" height="32" rx="9" fill="#FFD400"/><path d="${BOLT}" fill="#0A0A0A"/></g></svg>`;
};

for (const [name, size, pad] of [['apple-touch-icon.png', 180, 22], ['icon-192.png', 192, 24], ['icon-512.png', 512, 64]]) {
  await sharp(Buffer.from(icon(size, pad))).png().toFile(path.join(pub, name));
}

const og = `<!doctype html><html><head><style>
  *{margin:0;box-sizing:border-box} body{width:1200px;height:630px;background:#0A0A0A;color:#fff;font-family:Manrope,Inter,system-ui,sans-serif;overflow:hidden;position:relative}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:56px 56px;-webkit-mask-image:radial-gradient(ellipse at 30% 20%,#000,transparent 75%)}
  .glow{position:absolute;inset:0;background:radial-gradient(700px 400px at 80% 10%,rgba(255,212,0,.22),transparent 65%)}
  .wrap{position:relative;padding:84px 88px;display:flex;flex-direction:column;height:100%}
  .brand{display:flex;align-items:center;gap:18px;font-weight:800;font-size:40px;letter-spacing:-.02em}
  .brand span{color:#B8B8B8;font-weight:600}
  h1{margin-top:auto;font-size:92px;line-height:1.02;font-weight:800;letter-spacing:-.035em}
  h1 em{font-style:normal;background:linear-gradient(100deg,#fff 0%,#FFD400 70%,#FFE14D);-webkit-background-clip:text;color:transparent}
  .chips{display:flex;gap:14px;margin-top:40px} .chip{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);border-radius:16px;padding:14px 20px;font-size:24px;color:#B8B8B8}
  .chip b{color:#fff}
  svg.line{position:absolute;right:0;bottom:120px;width:640px;height:220px}
</style></head><body><div class="grid"></div><div class="glow"></div>
<svg class="line" viewBox="0 0 640 220" fill="none"><path d="M0 150 L180 150 L230 70 L300 190 L380 40 L440 120 L640 120" stroke="#FFD400" stroke-width="4" stroke-linejoin="round" opacity=".9"/></svg>
<div class="wrap"><div class="brand"><svg width="64" height="64" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#FFD400"/><path d="${BOLT}" fill="#0A0A0A"/></svg><div>Bolt <span>Markets</span></div></div>
<h1>Fast markets.<br><em>Sharp pricing.</em></h1>
<div class="chips"><div class="chip"><b>MetaTrader 5</b></div><div class="chip">Forex · Indices · Crypto · Metals</div><div class="chip">EN · العربية</div></div></div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(og);
await page.screenshot({ path: path.join(pub, 'og-image.png') });
await browser.close();
console.log('assets ✓', fs.readdirSync(pub).join(', '));
