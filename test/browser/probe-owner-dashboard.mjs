/**
 * TASK-DASHBOARDBUILD — the browser proof for §7.
 *
 * Unlike its two neighbours in this directory, this probe does NOT use the
 * PGlite harness: the questions §7 asks are about a real account's stored
 * setting, a real tenant's zone contents, and two surfaces agreeing on a real
 * revenue figure. So it runs the actual app (`npx vite --port 5177`) against
 * PRODUCTION Supabase and signs in as the real owner account.
 *
 *   # 1 · serve the app (leave running)
 *   npx vite --port 5177 --strictPort
 *
 *   # 2 · in another shell (playwright is dev-time only: npm i -D playwright --no-save)
 *   node test/browser/probe-owner-dashboard.mjs
 *
 * Credentials come from `.env.test` (gitignored). It changes ONE piece of real
 * state — Claire's stored default view, via the Team page — and the run's own
 * output records what it set; put it back afterwards.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.test', 'utf8').split('\n').filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const BASE = process.env.BASE || 'http://localhost:5177';
const SHOTS = 'docs/reports/dashboardbuild-shots';
const log = [];
const say = (s) => { console.log(s); log.push(s); };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => say(`PAGEERROR ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') say(`CONSOLE ${m.text().slice(0, 160)}`); });
page.on('response', (r) => {
  if (r.status() >= 400 && r.url().includes('supabase.co')) {
    say(`HTTP ${r.status()} ${r.url().replace(/^https:\/\/[^/]+/, '')}`);
  }
});

async function shot(name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  say(`  shot -> ${name}.png`);
}

/* ── 1 · sign in as the owner and see where we land ─────────────────────── */
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
// Google-first login: the email/password pair is one tap away.
await page.click('button:has-text("Sign in with email and password")');
await page.waitForSelector('#email');
await page.fill('input[type="email"]', env.FHE_ADMIN_EMAIL);
await page.fill('input[type="password"]', env.FHE_ADMIN_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(/\/app(\/|$)/, { timeout: 45000 });
await page.waitForTimeout(4000);
say(`1 · landed at ${new URL(page.url()).pathname}`);
say(`   §2.2 landing rule: ${new URL(page.url()).pathname === '/app/dashboard' ? 'PASS — fresh login lands on the dashboard' : 'landed elsewhere'}`);

const pill = async () => (await page.locator('header span:has-text("Owner ·")').first().textContent())?.trim();
say(`2 · default view pill: ${await pill()}`);
const caption = async () =>
  (await page.locator('text=/This is your default view|Switched for this session/').first().textContent())?.trim();
say(`   toggle caption: ${await caption()}`);
await shot('01-cj-lands-on-business-operations');

/* zones present in the business view */
const zoneKeys = async () => (await page.locator('[data-testid^="zone-"]').all())
  .reduce(async (accP, el) => { const acc = await accP; acc.push(await el.getAttribute('data-testid')); return acc; }, Promise.resolve([]));
say(`3 · business zones rendered: ${(await zoneKeys()).join(', ')}`);
const quiet = await page.locator('p:has-text("All quiet:")').last().innerText().catch(() => null);
say(`   all-quiet footer: ${quiet ? quiet.trim() : '(none — every zone had content)'}`);

/* revenue figure on the dashboard */
const revMonthTile = page.locator('a:has-text("Revenue · this month")').first();
const revMonth = (await revMonthTile.textContent())?.match(/\$[\d,]+/)?.[0] ?? null;
say(`4 · dashboard revenue tile · this month = ${revMonth}`);

/* ── 2 · toggle to the trainer view ─────────────────────────────────────── */
await page.click('[data-testid="dash-view-trainer"]');
await page.waitForTimeout(3500);
say(`5 · after toggle, pill: ${await pill()}`);
say(`   caption now: ${await caption()}`);
say(`   trainer zones rendered: ${(await zoneKeys()).join(', ')}`);
const quiet2 = await page.locator('p:has-text("All quiet:")').last().innerText().catch(() => null);
say(`   all-quiet footer: ${quiet2 ? quiet2.trim() : '(none)'}`);
await shot('02-toggled-to-head-trainer');

/* ── 3 · the session choice survives a reload; the default does not move ── */
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
say(`6 · after reload, pill: ${await pill()}`);
say(`   caption: ${await caption()}`);

/* ── 4 · toggle back, then read the calendar's revenue strip ────────────── */
await page.click('[data-testid="dash-view-business"]');
await page.waitForTimeout(3000);
await page.goto(`${BASE}/app/calendar`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
const strip = await page.locator('text=/Paid this month/').first().textContent().catch(() => null);
const calMonth = strip?.match(/\$[\d,]+/)?.[0] ?? null;
say(`7 · calendar money strip · this month = ${calMonth}  (dashboard said ${revMonth})`);
say(`   §7.4 one number: ${calMonth && calMonth === revMonth ? 'PASS — identical' : 'MISMATCH'}`);
await shot('03-calendar-paid-this-month');

/* ── 5 · the settings screen: a per-account default, for someone else ───── */
await page.goto(`${BASE}/app/ops/team`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await page.click('button:has-text("hello@fhequestrian.com")').catch(async () => {
  await page.click('text=hello@fhequestrian.com');
});
await page.waitForTimeout(1500);
const sel = page.locator('select[aria-label="Default dashboard"]');
say(`8 · Claire's stored default, as the settings screen shows it: ${await sel.inputValue()}`);
await shot('04-team-default-dashboard-control');
await sel.selectOption('business');
await page.click('button:has-text("Save default")');
await page.waitForTimeout(2500);
say(`   saved 'business' for Claire — panel now says: ${(await page.locator('text=/Default view saved/').first().innerText().catch(() => '(no note surfaced)'))}`);
await shot('05-claires-default-changed');

/* ── 6 · every zone's click-through lands somewhere real ────────────────── */
await page.goto(`${BASE}/app/dashboard`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4500);
const hrefs = [...new Set(await page.locator('[data-testid^="zone-"] a').evaluateAll(
  (els) => els.map((e) => e.getAttribute('href')).filter(Boolean),
))];
say(`9 · distinct zone click-through targets in this view: ${hrefs.length}`);
for (const h of hrefs.slice(0, 14)) {
  await page.goto(`${BASE}${h}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  const body = (await page.locator('body').innerText()).slice(0, 400);
  const dead = /Page not found|404|Something went wrong/i.test(body);
  say(`   ${dead ? 'DEAD ' : 'ok   '} ${h}  ->  ${new URL(page.url()).pathname}${new URL(page.url()).search}`);
}

writeFileSync(process.env.PROBE_OUT || 'probe-out.txt', log.join('\n'));
await b.close();
