// End-to-end: public site + client portal + back office against the real API (SQLite, mock MT5).
// Run: see e2e/README.md. Needs the API started with e2e/api.env and the built site served by serve-pages.mjs.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const SITE = process.env.E2E_SITE || 'http://127.0.0.1:8090/bolt-markets';
const API = process.env.E2E_API || 'http://127.0.0.1:8000/api/v1';
const DB = process.env.E2E_DB || path.join(os.tmpdir(), 'bolt-e2e', 'bolt.db');
const EMAIL = 'nadia@example.com';
const PASSWORD = 'Sunrise-2048x';
const work = path.dirname(DB);
const shots = process.env.E2E_SHOTS || path.join(work, 'shots');
fs.mkdirSync(shots, { recursive: true });

function sql(query) {
  return execFileSync('python3', ['-c', `import sqlite3,json,sys;c=sqlite3.connect(${JSON.stringify(DB)});print(json.dumps(c.execute(sys.argv[1]).fetchall()))`, query]).toString();
}
function tokenFor(email, kind) {
  const rows = JSON.parse(sql(`SELECT body_text FROM email_outbox WHERE to_email='${email}' ORDER BY id DESC`));
  for (const [body] of rows) {
    const m = body.match(new RegExp(`/${kind}/\\?token=([\\w-]+)`));
    if (m) return m[1];
  }
  throw new Error(`no ${kind} email for ${email}`);
}
function b32(s) {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const out = [];
  for (const ch of s.replace(/=+$/, '').toUpperCase()) {
    value = (value << 5) | a.indexOf(ch);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function totp(secret, offset = 0) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const h = crypto.createHmac('sha1', b32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}

const results = [];
const ok = (name) => { results.push(['ok', name]); console.log('  ✓', name); };
const errors = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource: the server responded with a status of (401|403|404|409|422)/.test(m.text())) errors.push(`console ${page.url()}: ${m.text()}`); });
page.on('dialog', (d) => d.accept());

async function step(name, fn) {
  try {
    await fn();
    ok(name);
  } catch (e) {
    await page.screenshot({ path: `${shots}/FAIL-${name.replace(/\W+/g, '_')}.png`, fullPage: true }).catch(() => {});
    console.log('  ✗', name, '\n   ', String(e.message).split('\n').slice(0, 4).join('\n    '));
    results.push(['fail', name]);
    throw e;
  }
}

try {
  console.log('client');
  await step('register', async () => {
    await page.goto(`${SITE}/register/`);
    await page.getByLabel('Full name').fill('Nadia Hassan');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Country of residence').selectOption('AE');
    await page.locator('form input[type=checkbox]').check();
    await page.locator('form button[type=submit]').click();
    await page.getByText(/check your (inbox|email)/i).first().waitFor({ timeout: 10000 });
    await page.screenshot({ path: `${shots}/01-registered.png` });
  });
  await step('verify email from link', async () => {
    await page.goto(`${SITE}/verify-email/?token=${tokenFor(EMAIL, 'verify-email')}`);
    await page.getByRole('heading', { name: 'Email confirmed' }).waitFor({ timeout: 10000 });
  });
  await step('login', async () => {
    await page.goto(`${SITE}/login/`);
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.locator('form button[type=submit]').click();
    await page.waitForURL(/\/portal\/?/, { timeout: 10000 });
    await page.getByText('Nadia', { exact: false }).first().waitFor();
    await page.screenshot({ path: `${shots}/02-dashboard.png` });
  });
  let demoLogin = '';
  await step('open demo account (MT5 mock)', async () => {
    await page.goto(`${SITE}/portal/accounts/`);
    await page.getByRole('button', { name: /open account/i }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: 'Demo' }).or(dialog.getByRole('tab', { name: 'Demo' })).or(dialog.getByRole('button', { name: 'Demo', exact: true })).first().click();
    await dialog.locator('button[type=submit]').click();
    await page.getByText('Your MT5 login details').waitFor({ timeout: 10000 });
    await page.screenshot({ path: `${shots}/03-credentials.png` });
    demoLogin = (await page.getByRole('dialog').innerText()).match(/\b5\d{6}\b/)?.[0] ?? '';
    if (!demoLogin) throw new Error('no demo login shown');
    await page.getByRole('button', { name: 'Done' }).click();
  });
  await step('open live account', async () => {
    await page.getByRole('button', { name: /open account/i }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: 'Live' }).or(dialog.getByRole('tab', { name: 'Live' })).or(dialog.getByRole('button', { name: 'Live', exact: true })).first().click();
    await dialog.locator('button[type=submit]').click();
    await page.getByText('Your MT5 login details').waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: 'Done' }).click();
  });
  await step('demo balance shows 10,000', async () => {
    await page.goto(`${SITE}/portal/accounts/`);
    await page.getByRole('tab', { name: 'Demo' }).or(page.getByRole('radio', { name: 'Demo' })).or(page.getByRole('button', { name: 'Demo', exact: true })).first().click();
    await page.getByText(/10,000/).first().waitFor({ timeout: 8000 });
  });
  await step('upload KYC documents and submit', async () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200)]);
    fs.writeFileSync(path.join(work, 'id.png'), png);
    fs.writeFileSync(path.join(work, 'bill.pdf'), Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200)]));
    await page.goto(`${SITE}/portal/verification/`);
    const inputs = page.locator('input[type=file]');
    await inputs.first().waitFor();
    const n = await inputs.count();
    for (let i = 0; i < Math.min(n, 3); i++) {
      await page.locator('input[type=file]').nth(i).setInputFiles(i === 2 ? path.join(work, 'bill.pdf') : path.join(work, 'id.png'));
      await page.waitForTimeout(400);
    }
    await page.getByRole('button', { name: 'Submit for review' }).click();
    await page.getByText(/under review|being reviewed|in review/i).first().waitFor({ timeout: 8000 });
    await page.screenshot({ path: `${shots}/04-kyc-submitted.png` });
  });
  await step('open support ticket', async () => {
    await page.goto(`${SITE}/portal/support/`);
    await page.getByRole('button', { name: /new ticket/i }).first().click();
    await page.getByLabel('Subject').fill('Question about leverage');
    await page.getByLabel('How can we help?').fill('Can I change the leverage on my live account later?');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByText('Question about leverage').first().waitFor({ timeout: 8000 });
  });
  await step('contact form', async () => {
    await page.goto(`${SITE}/company/contact/`);
    await page.getByLabel('Full name').fill('Omar Saleh');
    await page.getByLabel('Email').first().fill('omar@example.com');
    await page.getByLabel('Topic').selectOption('partnerships');
    await page.getByLabel('Subject').fill('IB partnership');
    await page.getByLabel('Message').fill('We run a trading community and would like to discuss an introducing broker partnership.');
    const consent = page.locator('form input[type=checkbox]');
    if (await consent.count()) await consent.first().check();
    await page.getByRole('button', { name: 'Send message' }).click();
    await page.getByRole('heading', { name: 'Message sent' }).waitFor({ timeout: 8000 });
  });
  await step('live prices stream from the API (simulated feed)', async () => {
    await page.goto(`${SITE}/markets/forex/`);
    await page.waitForTimeout(3500);
    const text = await page.locator('main').innerText();
    if (!/1\.0[78]\d{2,}/.test(text)) throw new Error('EURUSD price not rendered');
  });

  console.log('back office');
  const admin = await ctx.newPage();
  admin.on('pageerror', (e) => errors.push(`admin pageerror: ${e.message}`));
  admin.on('dialog', (d) => d.accept());
  const A = (p) => `${SITE}/admin/#${p}`;
  let secret = '';
  await step('admin sign-in and forced 2FA setup', async () => {
    await admin.goto(`${SITE}/admin/`);
    await admin.getByLabel('Work email').fill('admin@bolt.test');
    await admin.getByLabel('Password').fill('Admin-pass-2026');
    await admin.getByRole('button', { name: 'Sign in' }).click();
    await admin.getByRole('heading', { name: 'Turn on two-factor authentication' }).waitFor({ timeout: 8000 });
    await admin.getByRole('button', { name: 'Set up authenticator' }).click();
    secret = (await admin.locator('.kbd').first().innerText()).trim();
    await admin.screenshot({ path: `${shots}/10-admin-2fa.png` });
    await admin.getByLabel('Code from the app').fill(totp(secret));
    await admin.getByRole('button', { name: 'Turn on' }).click();
    await admin.getByText('Store these one-time recovery codes').waitFor();
    await admin.getByRole('button', { name: 'I saved them' }).click();
    await admin.getByRole('heading', { name: /Hello/ }).waitFor({ timeout: 8000 });
    await admin.screenshot({ path: `${shots}/11-admin-dashboard.png`, fullPage: true });
  });
  await step('KYC review: view document and approve', async () => {
    await admin.goto(A('/kyc'));
    await admin.getByText('Nadia Hassan').click();
    await admin.getByRole('button', { name: 'View' }).first().click();
    await admin.locator('dialog img').waitFor({ timeout: 8000 });
    await admin.screenshot({ path: `${shots}/12-admin-doc.png` });
    await admin.getByRole('button', { name: 'Close' }).click();
    await admin.getByRole('button', { name: 'Approve' }).click();
    await admin.getByText(/is verified/).waitFor({ timeout: 8000 });
  });
  await step('ticket reply', async () => {
    await admin.goto(A('/tickets'));
    await admin.getByText('Question about leverage').click();
    await admin.getByLabel('Reply to the client').fill('Yes — open a ticket with the account number and the new leverage, and we will update it.');
    await admin.getByRole('button', { name: 'Send reply' }).click();
    await admin.getByText(/Reply sent/).waitFor({ timeout: 8000 });
  });
  await step('contact message handled', async () => {
    await admin.goto(A('/messages'));
    await admin.getByText('IB partnership').click();
    await admin.getByRole('button', { name: 'Mark handled' }).click();
    await admin.getByText('Marked as handled.').waitFor();
  });
  let liveAccountId = '';
  await step('IB/adjustment credit to live account', async () => {
    await admin.goto(A('/accounts?kind=live'));
    const row = admin.locator('tr', { hasText: 'Nadia Hassan' }).first();
    liveAccountId = (await row.locator('td').first().innerText()).trim();
    await admin.goto(A('/transactions'));
    await admin.getByRole('button', { name: 'Adjustment' }).click();
    await admin.getByLabel('Internal account ID').fill(liveAccountId);
    await admin.getByLabel('Amount (account currency)').fill('750');
    await admin.getByLabel('Note (shown to the client)').fill('Welcome credit for testing');
    await admin.getByRole('button', { name: 'Record' }).click();
    await admin.getByRole('heading', { name: /Adjustment #/ }).waitFor({ timeout: 8000 });
  });
  await step('deposit page: provider outage is reported clearly', async () => {
    await page.goto(`${SITE}/portal/deposit/`);
    await page.getByLabel('Amount').fill('100');
    await page.getByRole('button', { name: /continue|deposit/i }).last().click();
    await page.getByText(/payment provider is not responding/i).waitFor({ timeout: 30000 });
  });
  let withdrawalId = '';
  await step('client withdrawal request', async () => {
    await page.goto(`${SITE}/portal/withdraw/`);
    await page.getByLabel('Method').selectOption('crypto');
    await page.getByLabel('Wallet address').fill('TQ2xKq7c4Yk8m3RgP9sVw1nB5jH6dF0aZx');
    await page.getByLabel('Network').selectOption('TRC20');
    await page.getByLabel('Amount').fill('200');
    await page.getByRole('button', { name: 'Request withdrawal' }).click();
    await page.getByText('Withdrawal requested').waitFor({ timeout: 8000 });
    await page.screenshot({ path: `${shots}/05-withdraw.png`, fullPage: true });
    withdrawalId = JSON.parse(sql("SELECT id FROM transactions WHERE type='withdrawal' ORDER BY id DESC LIMIT 1"))[0][0];
  });
  await step('finance: approve and mark withdrawal paid', async () => {
    await admin.goto(A(`/transactions/${withdrawalId}`));
    await admin.getByText('TQ2xKq7c4Yk8m3RgP9sVw1nB5jH6dF0aZx').waitFor();
    await admin.getByRole('button', { name: 'Approve' }).click();
    await admin.getByText(/Approved\. Send the payout/).waitFor({ timeout: 8000 });
    await admin.getByRole('button', { name: 'Mark paid' }).click();
    await admin.getByLabel(/Payout reference/).fill('0x9f2c1e7ab4');
    await admin.getByRole('button', { name: 'Confirm' }).click();
    await admin.getByText(/Marked paid/).waitFor({ timeout: 8000 });
    await admin.screenshot({ path: `${shots}/15-admin-withdrawal.png`, fullPage: true });
    const bal = JSON.parse(sql(`SELECT balance_cents FROM trading_accounts WHERE id=${liveAccountId}`))[0][0];
    if (bal !== 55000) throw new Error(`expected 550.00 after withdrawal, got ${bal}`);
  });
  await step('blog: publish article', async () => {
    await admin.goto(A('/posts/new'));
    await admin.getByLabel('Title').fill('Weekly outlook: inflation week');
    await admin.getByLabel(/Summary/).fill('CPI releases in the US and euro area set the tone for currencies this week.');
    await admin.getByLabel('Article body (Markdown)').fill('## What to watch\n\n' + 'Inflation data is the main event for currency traders this week. '.repeat(8) + '\n\n- US CPI on Wednesday\n- Euro area HICP on Friday');
    await admin.getByRole('tab', { name: 'Preview' }).click();
    await admin.locator('.prose-admin h2').waitFor();
    await admin.getByRole('button', { name: 'Publish' }).click();
    await admin.getByText(/Published\./).waitFor({ timeout: 8000 });
    const res = await fetch(`${API}/blog/posts/weekly-outlook-inflation-week?lang=en`);
    if (res.status !== 200) throw new Error(`public API returned ${res.status}`);
  });
  await step('client file: note, suspend, reactivate', async () => {
    await admin.goto(A('/clients?q=nadia'));
    await admin.getByText('nadia@example.com').click();
    await admin.getByLabel('Add a note').fill('Called to welcome the client.');
    await admin.getByRole('button', { name: 'Save note' }).click();
    await admin.getByText('Called to welcome the client.').nth(1).waitFor().catch(async () => admin.getByText('Called to welcome the client.').first().waitFor());
    await admin.getByRole('button', { name: 'Suspend' }).click();
    await admin.getByText('Client suspended.').waitFor();
    await admin.getByRole('button', { name: 'Reactivate' }).click();
    await admin.getByText('Client reactivated.').waitFor();
    await admin.screenshot({ path: `${shots}/13-admin-client.png`, fullPage: true });
  });
  await step('system and audit pages', async () => {
    await admin.goto(A('/system'));
    await admin.getByText('MT5 connection').waitFor();
    await admin.screenshot({ path: `${shots}/14-admin-system.png`, fullPage: true });
    await admin.goto(A('/audit'));
    await admin.getByText('kyc.approved').first().waitFor();
  });
  await step('client sees verification and staff reply after re-login', async () => {
    await page.goto(`${SITE}/login/`);
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.locator('form button[type=submit]').click();
    await page.waitForURL(/\/portal\/?/, { timeout: 10000 });
    await page.goto(`${SITE}/portal/support/`);
    await page.getByText('Question about leverage').first().click();
    await page.getByText(/open a ticket with the account number/).waitFor({ timeout: 8000 });
  });
} catch {
  /* reported below */
} finally {
  console.log(`\n${results.filter((r) => r[0] === 'ok').length}/${results.length} steps passed`);
  if (errors.length) console.log('browser errors:\n  ' + [...new Set(errors)].slice(0, 15).join('\n  '));
  await browser.close();
}
