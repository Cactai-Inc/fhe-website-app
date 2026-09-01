/* PROBE — TASK-SIGNDOOR (was TASK-FIX1 §A; the question moved, so the probe did).
 *
 * Two halves, because the task is one move across two pages:
 *
 *   THE DOOR  — /sign/{guest,rider,horse,rider+horse} asks for the email address
 *               and NOTHING else, and POSTs exactly {path,email,confirmEmail};
 *               /sign/deal is untouched. (SIGNDOOR test items 1 and 6.)
 *   THE FIRST — /app/onboarding `details` asks who is signing up, as a radio pair
 *   PAGE        with NO DEFAULT, on the doors that may carry a minor, and sends
 *   AFTER AUTH  the guardian as the account holder with the child alongside.
 *               (SIGNDOOR test item 3 — FIX1 §A held.)
 *
 * Both halves render the REAL page in a REAL Chromium. `window.__rpc` (shim) and
 * a route interception give the payload evidence a network log would.
 *
 * Run:
 *   VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=anon \
 *     npx vite --config test/browser/vite.config.ts --port 5199 --strictPort &
 *   node test/browser/probe-sign-minor.mjs
 */
import { chromium } from 'playwright';

const DOOR = 'http://localhost:5199/test/browser/sign-start.html';
const AFTER = 'http://localhost:5199/test/browser/onboarding-details.html';
const FUNNELS = ['guest', 'rider', 'horse', 'rider+horse'];
const ASKS = ['guest', 'rider', 'rider+horse'];
const SILENT = ['horse', 'deal'];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage();
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };

// ══ THE DOOR ═══════════════════════════════════════════════════════════════
console.log('── the door: /sign/* ──');
for (const p of FUNNELS) {
  await page.goto(`${DOOR}?path=${encodeURIComponent(p)}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('form');
  const inputs = await page.locator('form input').count();
  const ids = await page.locator('form input').evaluateAll((els) => els.map((e) => e.id));
  ok(inputs === 2 && ids.join(',') === 'sign-email,sign-confirm-email',
    `/sign/${p} — exactly the email capture (${inputs} inputs: ${ids.join(', ')})`);
  ok(await page.locator('input[name="sign-signing-for"]').count() === 0
     && await page.locator('#sign-first').count() === 0
     && await page.locator('#sign-phone').count() === 0
     && await page.locator('#sign-address1').count() === 0,
    `/sign/${p} — no name, no phone, no address, no minor question`);
}

// `deal` is UNCHANGED — SIGNDOOR §5.4 / test item 6.
await page.goto(`${DOOR}?path=deal`, { waitUntil: 'networkidle' });
await page.waitForSelector('form');
const dealIds = await page.locator('form input').evaluateAll((els) => els.map((e) => e.id));
ok(['sign-first', 'sign-last', 'sign-phone', 'sign-email', 'sign-confirm-email',
    'sign-address1', 'sign-address2', 'sign-city', 'sign-state', 'sign-zip']
     .every((id) => dealIds.includes(id)),
  `/sign/deal — the full form is untouched (${dealIds.length} inputs)`);
ok(await page.locator('input[name="sign-signing-for"]').count() === 0,
  '/sign/deal — still never asks the minor question (a deal party must be 18+)');

// ── what a funnel actually SENDS, and what it renders afterwards ───────────
let posted = null;
await page.route('**/api/sign-start', async (route) => {
  posted = JSON.parse(route.request().postData() ?? '{}');
  await route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, status: 'sent', attemptId: 'probe-attempt', nameApplied: false }) });
});
await page.goto(`${DOOR}?path=rider`, { waitUntil: 'networkidle' });
await page.waitForSelector('form');
ok(await page.locator('button[type="submit"]').isDisabled(),
  '/sign/rider — Continue is disabled until the two addresses agree');
await page.fill('#sign-email', 'newrider@example.com');
await page.fill('#sign-confirm-email', 'newrider@example.com');
ok(!(await page.locator('button[type="submit"]').isDisabled()),
  '/sign/rider — and enabled once they do');
await page.locator('button[type="submit"]').click();
await page.waitForSelector('[role="status"]');
console.log('POSTed body: ' + JSON.stringify(posted));
ok(JSON.stringify(Object.keys(posted ?? {}).sort()) === '["confirmEmail","email","path"]',
  'payload — three keys and no more: path, email, confirmEmail');

const screen = await page.locator('[role="status"]').innerText();
ok(/on its way to newrider@example\.com/i.test(screen),
  'send state — the real outcome names the address');
ok(/spam or junk folder/i.test(screen), 'send state — the spam notice is there');
ok(await page.locator('[role="status"] button', { hasText: 'I never received it' }).count() === 1,
  'send state — the report-issue escape hatch is there');

// ══ THE FIRST PAGE AFTER AUTH ══════════════════════════════════════════════
console.log('\n── the first page after auth: /app/onboarding `details` ──');
/* ⚠️ useFormDraft persists this form to localStorage under the `anon` namespace
   (TASK-FIX4 §6), and a restored draft legitimately PRE-ANSWERS the minor
   question — it is the person's own earlier answer, not a default. So every
   arrival below is a genuinely FIRST arrival, which is the state the no-default
   rule is about. Without this the probe tests the draft, not the rule. */
const fresh = async (url) => {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle' });
};
for (const p of [...ASKS, ...SILENT]) {
  await fresh(`${AFTER}?path=${encodeURIComponent(p)}`);
  await page.waitForSelector('#ob-first');
  const radios = await page.locator('input[name="ob-signing-for"]').count();
  const shouldAsk = ASKS.includes(p);
  const legend = (await page.locator('fieldset legend').allTextContents()).join(' | ');
  ok(shouldAsk ? radios === 2 : radios === 0,
    `sign_path=${p} — minor question ${shouldAsk ? 'PRESENT' : 'ABSENT'} (radios=${radios}) ${legend ? `[${legend}]` : ''}`);
}

// An already-attached child is always editable, whatever door they came in by.
await fresh(`${AFTER}?path=horse&minor=1`);
await page.waitForSelector('#ob-first');
ok(await page.locator('input[name="ob-signing-for"]').count() === 2
   && await page.locator('input[name="ob-signing-for"][value="child"]').isChecked(),
  'sign_path=horse WITH a minor already attached — the question renders, prefilled to "My child"');

// ── no default, and the block is refused until it is answered ─────────────
await fresh(`${AFTER}?path=rider`);
await page.waitForSelector('#ob-first');
ok(await page.locator('input[name="ob-signing-for"]:checked').count() === 0,
  'sign_path=rider — NO DEFAULT: neither radio is checked on arrival');
ok(await page.locator('#ob-minor-first').count() === 0,
  'sign_path=rider — the rider block is hidden until the question is answered');
ok(await page.locator('button[type="submit"]').isDisabled(),
  'sign_path=rider — Save is disabled while the question is unanswered');

await page.locator('input[name="ob-signing-for"][value="self"]').check();
ok(await page.locator('#ob-minor-first').count() === 0,
  'sign_path=rider "Me" — no rider block (the self-serving adult is unchanged)');
/* textContent, not innerText: .form-label is text-transform:uppercase, so
   innerText returns the RENDERED "FIRST NAME" and an assertion on the source
   string reads as a failure that isn't one. */
ok((await page.locator('label[for="ob-first"]').textContent())?.trim() === 'First name',
  'sign_path=rider "Me" — the name field is still just "First name"');

await page.locator('input[name="ob-signing-for"][value="child"]').check();
await page.waitForSelector('#ob-minor-first');
ok((await page.locator('label[for="ob-first"]').textContent())?.trim() === 'Your first name',
  'sign_path=rider "My child" — the account holder\'s field says YOUR first name');
ok(await page.locator('#ob-minor-first').isVisible()
   && await page.locator('#ob-minor-last').isVisible()
   && await page.locator('#ob-minor-dob').isVisible(),
  'sign_path=rider "My child" — the rider block renders: first, last, date of birth');

// ── the 18+ refusal, carried over from the door ───────────────────────────
await page.fill('#ob-minor-dob', '1990-01-01');
await page.waitForTimeout(100);
ok(await page.locator('[role="alert"]').filter({ hasText: '18 or older' }).count() === 1,
  'sign_path=rider "My child" — a DOB of 18+ is refused at the field');
ok(await page.locator('button[type="submit"]').isDisabled(),
  'sign_path=rider "My child" — Save stays disabled while the DOB is 18+');

// ── what the form actually SENDS to the spine ─────────────────────────────
await page.fill('#ob-first', 'Test');
await page.fill('#ob-last', 'Parent');
await page.fill('#ob-minor-first', 'Test');
await page.fill('#ob-minor-last', 'Child');
await page.fill('#ob-minor-dob', '2015-01-01');
await page.fill('#ob-phone', '619 555 0100');
await page.fill('#ob-dob', '1985-03-02');
await page.fill('#ob-street', '1 Test Way');
await page.fill('#ob-city', 'San Diego');
await page.fill('#ob-state', 'CA');
await page.fill('#ob-zip', '92109');
await page.fill('#ob-ec1-name', 'Someone Else');
await page.fill('#ob-ec1-rel', 'Sibling');
await page.fill('#ob-ec1-phone', '619 555 0199');
await page.locator('button[type="submit"]').click();
await page.waitForFunction(
  () => (window.__rpc ?? []).some((c) => c.name === 'update_my_onboarding_profile'),
  { timeout: 10000 });
const sent = await page.evaluate(
  () => window.__rpc.find((c) => c.name === 'update_my_onboarding_profile').args.p);
console.log('update_my_onboarding_profile payload: ' + JSON.stringify(sent, null, 2));
ok(sent.first_name === 'Test' && sent.last_name === 'Parent',
  'payload — the ACCOUNT HOLDER is the parent');
ok(sent.has_minor === true && sent.minor_first_name === 'Test'
   && sent.minor_last_name === 'Child' && sent.minor_dob === '2015-01-01',
  'payload — the MINOR travels separately, with a date of birth');

// ── and "Me" must not smuggle a minor ─────────────────────────────────────
await fresh(`${AFTER}?path=rider`);
await page.waitForSelector('#ob-first');
await page.locator('input[name="ob-signing-for"][value="child"]').check();
await page.fill('#ob-minor-first', 'Ghost');
await page.locator('input[name="ob-signing-for"][value="self"]').check();
await page.fill('#ob-first', 'Solo');
await page.fill('#ob-last', 'Adult');
await page.fill('#ob-phone', '619 555 0101');
await page.fill('#ob-dob', '1985-03-02');
await page.fill('#ob-street', '1 Test Way');
await page.fill('#ob-city', 'San Diego');
await page.fill('#ob-state', 'CA');
await page.fill('#ob-zip', '92109');
await page.fill('#ob-ec1-name', 'Someone Else');
await page.fill('#ob-ec1-rel', 'Sibling');
await page.fill('#ob-ec1-phone', '619 555 0199');
await page.locator('button[type="submit"]').click();
await page.waitForFunction(
  () => (window.__rpc ?? []).some((c) => c.name === 'update_my_onboarding_profile'),
  { timeout: 10000 });
const solo = await page.evaluate(
  () => window.__rpc.find((c) => c.name === 'update_my_onboarding_profile').args.p);
ok(!('has_minor' in solo) && !('minor_first_name' in solo),
  'payload — switching back to "Me" sends NO minor key at all, even after one was typed');

await browser.close();
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
