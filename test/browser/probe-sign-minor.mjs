/* PROBE — TASK-FIX1 §A. Does the front door ask whose name it is?
 *
 * Test criteria 1 and 2 from the task:
 *   1. guest, rider and rider+horse show the minor question; horse and deal do not.
 *   2. Ticking it produces guardian-as-account-holder + minor-as-participant
 *      through the existing spine.
 *
 * (2) is proven in two halves: this probe proves what the DOOR SENDS — the
 * payload POSTed to /api/sign-start, captured by intercepting the request — and
 * the psql proof in the report proves what attach_minor_to_guardian() then does
 * with it, and that my_onboarding_state() reads it straight back.
 *
 * Run:
 *   VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=anon \
 *     npx vite --config test/browser/vite.config.ts --port 5199 --strictPort &
 *   node test/browser/probe-sign-minor.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5199/test/browser/sign-start.html';
const ASKS = ['guest', 'rider', 'rider+horse'];
const SILENT = ['horse', 'deal'];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage();
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };

// ── criterion 1 ─────────────────────────────────────────────────────────────
for (const p of [...ASKS, ...SILENT]) {
  await page.goto(`${BASE}?path=${encodeURIComponent(p)}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('form', { timeout: 10000 });
  const radios = await page.locator('input[name="sign-signing-for"]').count();
  const legend = (await page.locator('fieldset legend').allTextContents()).join(' | ');
  const shouldAsk = ASKS.includes(p);
  ok(shouldAsk ? radios === 2 : radios === 0,
    `/sign/${p} — minor question ${shouldAsk ? 'PRESENT' : 'ABSENT'} (radios=${radios}) ${legend ? `[${legend}]` : ''}`);
}

// ── criterion 2 — "Me" changes nothing; "My child" splits the form ──────────
await page.goto(`${BASE}?path=rider`, { waitUntil: 'networkidle' });
await page.waitForSelector('form');
ok(await page.locator('#sign-minor-first').count() === 0,
  '/sign/rider — the rider block is hidden until the question is answered');

await page.locator('input[name="sign-signing-for"][value="self"]').check();
ok(await page.locator('#sign-minor-first').count() === 0,
  '/sign/rider "Me" — no rider block, no second name (the self-serving adult is unchanged)');
/* textContent, not innerText: .form-label is text-transform:uppercase, so
   innerText returns the RENDERED "FIRST NAME *" and an assertion on the source
   string reads as a failure that isn't one. The README's scrollIntoView trap in
   another costume. */
ok((await page.locator('label[for="sign-first"]').textContent())?.trim() === 'First name *',
  '/sign/rider "Me" — the name field is still just "First name"');

await page.locator('input[name="sign-signing-for"][value="child"]').check();
await page.waitForSelector('#sign-minor-first');
ok((await page.locator('label[for="sign-first"]').textContent())?.trim() === 'Your first name *',
  '/sign/rider "My child" — the account holder\'s field says YOUR first name');
ok(await page.locator('#sign-minor-first').isVisible()
   && await page.locator('#sign-minor-last').isVisible()
   && await page.locator('#sign-minor-dob').isVisible(),
  '/sign/rider "My child" — the rider block renders: first, last, date of birth');

// ── the 18+ refusal ─────────────────────────────────────────────────────────
await page.fill('#sign-minor-dob', '1990-01-01');
await page.waitForTimeout(100);
const adultWarn = await page.locator('[role="alert"]').filter({ hasText: '18 or older' }).count();
ok(adultWarn === 1, '/sign/rider "My child" — a DOB of 18+ is refused at the field');
ok(await page.locator('button[type="submit"]').isDisabled(),
  '/sign/rider "My child" — submit stays disabled while the DOB is 18+');

// ── criterion 2 — what the door actually SENDS ─────────────────────────────
let posted = null;
await page.route('**/api/sign-start', async (route) => {
  posted = JSON.parse(route.request().postData() ?? '{}');
  await route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, status: 'sent', attemptId: null, nameApplied: false }) });
});
await page.fill('#sign-first', 'Test');
await page.fill('#sign-last', 'Parent');
await page.fill('#sign-phone', '619 555 0100');
await page.fill('#sign-email', 'test-parent@example.com');
await page.fill('#sign-confirm-email', 'test-parent@example.com');
await page.fill('#sign-minor-first', 'Test');
await page.fill('#sign-minor-last', 'Child');
await page.fill('#sign-minor-dob', '2015-01-01');
await page.locator('button[type="submit"]').click();
await page.waitForFunction(() => !!document.querySelector('[role="status"]'), { timeout: 10000 });

console.log('\nPOSTed body:\n' + JSON.stringify(posted, null, 2));
ok(posted?.firstName === 'Test' && posted?.lastName === 'Parent',
  'payload — the ACCOUNT HOLDER is the parent');
ok(posted?.isForMinor === true && posted?.minorFirstName === 'Test'
   && posted?.minorLastName === 'Child' && posted?.minorDob === '2015-01-01',
  'payload — the MINOR travels separately, with a date of birth');

// ── and "Me" must not smuggle a minor ──────────────────────────────────────
await page.goto(`${BASE}?path=rider`, { waitUntil: 'networkidle' });
await page.waitForSelector('form');
posted = null;
await page.locator('input[name="sign-signing-for"][value="child"]').check();
await page.fill('#sign-minor-first', 'Ghost');
await page.locator('input[name="sign-signing-for"][value="self"]').check();
await page.fill('#sign-first', 'Solo');
await page.fill('#sign-last', 'Adult');
await page.fill('#sign-phone', '619 555 0101');
await page.fill('#sign-email', 'solo@example.com');
await page.fill('#sign-confirm-email', 'solo@example.com');
await page.locator('button[type="submit"]').click();
await page.waitForFunction(() => !!document.querySelector('[role="status"]'), { timeout: 10000 });
ok(posted?.isForMinor === false && posted?.minorFirstName === '',
  'payload — switching back to "Me" sends NO minor, even after one was typed');

await browser.close();
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
