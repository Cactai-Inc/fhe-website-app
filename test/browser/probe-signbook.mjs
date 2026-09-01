/* PROBE — TASK-SIGNBOOK. THE ORDER OF THE STEPS, PROVEN BY WALKING THEM.
 *
 * CR-98 steps 3–9 are an ORDER, and an order is exactly what reading source
 * cannot establish: the spec read `Onboarding.tsx`'s `Step` TYPE UNION and
 * reported that signing came after shopping. It never did. So this walks the
 * REAL page in a REAL Chromium, clicking the REAL controls, and records the step
 * it lands on after each click.
 *
 * TWO DOORS, BOTH WALKED (spec trap 2 / NOSTRIP):
 *   self-serve   — `/sign/rider`, no order: details → sign → shop → time →
 *                  submit → done, and NO payment step anywhere.
 *   provisioned  — staff sold them something first: the payment step must still
 *                  be there, because that is this page's original job.
 *
 * Run:
 *   VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=anon \
 *     npx vite --config test/browser/vite.config.ts --port 5199 --strictPort &
 *   node test/browser/probe-signbook.mjs
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:5199/test/browser/onboarding-flow.html';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage();
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };

/** The heading of the step currently on screen — what the person actually sees. */
const heading = () => page.locator('section h2, form h2').first().innerText();
/** The step list in the header, in the order it is rendered. */
const stepLabels = () =>
  page.locator('ol[aria-label="Onboarding steps"] li').allInnerTexts();
const world = () => page.evaluate(() => window.__world);

async function arrive(query) {
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }).catch(() => {});
  await page.goto(`${URL}${query}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('ol[aria-label="Onboarding steps"]');
}

// ══ THE SELF-SERVE DOOR — CR-98 steps 3 → 7 ════════════════════════════════
console.log('── /sign/rider, no order: the visitor CR-98 is about ──');
await arrive('?path=rider');

const labels = await stepLabels();
console.log(`     header: ${labels.map((l) => l.replace(/\n/g, ' ')).join('  |  ')}`);
const order = labels.map((l) => l.replace(/^\d+\.\s*/, '').trim());
ok(order.join(' → ') === 'Your details → Review & sign → Choose your lesson → Pick a time → Send your request → Request sent',
  `the header states the owner's order: ${order.join(' → ')}`);
ok(!order.includes('Payment'), 'no Payment step on the self-serve door (CR-98: pay after approval)');

ok((await heading()).includes('Your details'), 'step 3 — the first page after auth is the details form');

// step 3 → 4. ⚠️ SIGNDOOR's minor question has NO DEFAULT and the form refuses
// to submit until it is answered — answering it is part of walking the step, not
// a way around the test.
await page.locator('input[name="ob-signing-for"]').first().check();
await page.locator('form button[type="submit"]').first().click();
await page.waitForFunction(() => document.body.innerText.includes('Review'), null, { timeout: 5000 });
ok((await heading()).toLowerCase().includes('review'), 'step 4 — details submit lands on Review & sign');

// step 4 → 5 · sign, which is where the delivery hold is declared
await page.waitForSelector('#ob-typed-name');
// ⚠️ THE E-SIGN CONSENT BOX IS PART OF SIGNING, and the exact-match gate keeps
// the button disabled until the typed name matches the printed one (CR-83).
await page.locator('section input[type="checkbox"]').first().check();
await page.locator('#ob-typed-name').fill('Robin Fields');
await page.locator('button.btn-sign').click();
await page.waitForFunction(() => document.body.innerText.includes('first lesson'), null, { timeout: 8000 });
ok((await world()).held === 1, 'CR-98 step 8 — the signing run is HELD, so one email can carry everything');
ok((await heading()).includes('Your first lesson'),
   '⚠️ step 5 — signing lands on the OFFERING step (before SIGNBOOK it landed on "You\'re all set")');

// step 5 → 6
await page.locator('button[aria-pressed]').first().click();
await page.locator('button.btn-primary').first().click();
await page.waitForFunction(() => document.body.innerText.includes('When would you like'), null, { timeout: 8000 });
ok((await heading()).includes('When would you like to come'), 'step 6 — the offering step lands on pick a day and time');
ok((await world()).orderId !== null, 'the offering step built a draft order');

// step 6 → 7
const day = new Date(Date.now() + 8 * 86_400_000).toISOString().slice(0, 10);
await page.locator('input[type="date"]').fill(day);
await page.locator('input[type="time"]').fill('16:00');
await page.locator('button.btn-primary').first().click();
await page.waitForFunction(() => document.body.innerText.includes('Ready to send'), null, { timeout: 5000 });
ok((await heading()).includes('Ready to send'), 'step 7 — the time step lands on the review-and-send step');
const body = await page.locator('section').first().innerText();
ok(body.includes('Evaluation Lesson'), 'D19 — it states the order back before it acts');
ok(/Nothing is booked and nothing is charged/.test(body), 'D19 — and says plainly that no money moves');

// the act
await page.locator('button.btn-primary').first().click();
await page.waitForFunction(() => document.body.innerText.includes('request is with us'), null, { timeout: 8000 });
const w = await world();
ok(w.submitted !== null, 'the send button called submit_my_booking_request');
ok(w.submitted?.p_purchase_id === w.orderId, 'it submitted THE ORDER the shop step built');
ok(typeof w.submitted?.p_starts_at === 'string' && w.submitted.p_starts_at.includes(day.slice(0, 7)),
   'it submitted the day that was chosen');

const done = await page.locator('section').first().innerText();
ok(done.includes('Your request is with us'), '§THE TELL — the last screen says the request was SENT');
ok(!/paid|booked and confirmed/i.test(done.split('Nothing is confirmed')[0]),
   '§THE TELL — it does not claim anything is paid or booked');

// step 9 — the overview modal
await page.locator('button.btn-primary').first().click();
await page.waitForTimeout(400);
ok(await page.locator('[role="dialog"], .fixed').count() > 0,
   'step 9 — Continue opens the app-overview modal');

// ══ THE PROVISIONED DOOR — spec trap 2 / NOSTRIP ═══════════════════════════
console.log('── staff-provisioned, arriving WITH an order: the page\'s original job ──');
await arrive('?path=rider&door=provisioned');
const provLabels = (await stepLabels()).map((l) => l.replace(/^\d+\.\s*/, '').trim());
console.log(`     header: ${provLabels.join('  |  ')}`);
ok(provLabels.includes('Payment'), 'the payment step is STILL THERE on the provisioned door');
ok(provLabels.includes('Your order'), 'and it still opens on the order it was provisioned with');
ok(!provLabels.includes('Send your request'), 'and it does not get the request end-cap');

await browser.close();
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
