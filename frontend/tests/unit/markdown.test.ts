import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderMarkdown, slugify } from '../../src/lib/markdown';

test('headings get stable ids and are collected', () => {
  const r = renderMarkdown('## What is a pip?\n\nText\n\n## What is a pip?');
  assert.deepEqual(r.headings.map((h) => h.id), ['what-is-a-pip', 'what-is-a-pip-2']);
  assert.match(r.html, /<h2 id="what-is-a-pip">What is a pip\?<\/h2>/);
});

test('raw HTML is escaped, never emitted', () => {
  const r = renderMarkdown('Hello <script>alert(1)</script> & <b>bold</b>');
  assert.ok(!r.html.includes('<script>'));
  assert.match(r.html, /&lt;script&gt;/);
  assert.match(r.html, /&amp;/);
});

test('emphasis, code, links and lists', () => {
  const r = renderMarkdown('**Bold** and *italic* with `code` and [docs](/help).\n\n- one\n- two\n\n1. first\n2. second', (h) => `/base${h}`);
  assert.match(r.html, /<strong>Bold<\/strong>/);
  assert.match(r.html, /<em>italic<\/em>/);
  assert.match(r.html, /<code>code<\/code>/);
  assert.match(r.html, /href="\/base\/help"/);
  assert.match(r.html, /<ul>[\s\S]*<li>one<\/li>[\s\S]*<\/ul>/);
  assert.match(r.html, /<ol>[\s\S]*<li>second<\/li>[\s\S]*<\/ol>/);
});

test('javascript: links are not rendered as links', () => {
  const r = renderMarkdown('[click](javascript:alert(1))');
  assert.ok(!/href="javascript:/i.test(r.html));
});

test('tables render with header cells', () => {
  const r = renderMarkdown('| Account | Spread |\n|---|---|\n| Pro | 1.0 |');
  assert.match(r.html, /<th[^>]*>Account<\/th>/);
  assert.match(r.html, /<td[^>]*>Pro<\/td>/);
});

test('slugify keeps Arabic letters', () => {
  assert.equal(slugify('Risk & Reward: 101'), 'risk-reward-101');
  assert.ok(slugify('إدارة المخاطر').length > 0);
});
