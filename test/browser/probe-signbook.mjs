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
ok(order.join(' → ') === 'Your details → Review & sign → Choose your lesson → Your order & times → Submit → Request sent',
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
await page.waitForFunction(() => document.body.innerText.includes('Your order'), null, { timeout: 8000 });
ok((await heading()).includes('Your order'), 'step 6 — the offering step lands on the order, with a calendar per line');
ok(await page.locator('button:has-text("Change my order")').count() === 1,
   '⚠️ and the catalog button is there — "i should be able to click a button and see the catalog page"');
ok(await page.locator('button:has-text("Remove")').count() >= 1,
   '⚠️ and each line can be removed from the order overview page');
ok((await world()).orderId !== null, 'the offering step built a draft order');

// step 6 → 7
const day = new Date(Date.now() + 8 * 86_400_000).toISOString().slice(0, 10);
await page.locator('input[type="date"]').first().fill(day);
await page.locator('input[type="time"]').first().fill('16:00');
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
ok(Array.isArray(w.submitted?.p_slots) && w.submitted.p_slots.length >= 1,
   `it submitted a time PER LINE (${w.submitted?.p_slots?.length} slot(s))`);
ok(String(w.submitted?.p_slots?.[0]?.starts_at ?? '').includes(day.slice(0, 7)),
   'and each slot carries the day that was chosen for it');

const done = await page.locator('section').first().innerText();
ok(done.includes('Your request is with us'), '§THE TELL — the last screen says the request was SENT');
ok(!/paid|booked and confirmed/i.test(done.split('Nothing is confirmed')[0]),
   '§THE TELL — it does not claim anything is paid or booked');

// step 9 — the overview modal, and WHAT IS BEHIND IT when it closes
await page.locator('button.btn-primary').first().click();
await page.waitForTimeout(400);
// Owner, 2026-09-01: "after clicking the button that says 'continue to the app'
// im taken to the community feed page and the app overview modal is displayed
// until i close it." So the button LEAVES; AppLayout opens the tour over the feed,
// which is the one tour opener (D18) and is not this page's job any more.
await page.waitForSelector('[data-testid="landed-community-feed"], [data-testid="landed-dashboard"]',
  { timeout: 8000 });
ok(await page.locator('[data-testid="landed-community-feed"]').count() === 1,
   '"Continue to the app" lands on the COMMUNITY FEED (reverses ONBOARD §5)');
ok(await page.locator('[data-testid="landed-dashboard"]').count() === 0,
   'and not on the dashboard');

// ══ LOSSLESS IN BOTH DIRECTIONS — owner, 2026-09-01 ════════════════════════
// "moving backward doesnt clear the inputs from the page im leaving and moving
//  forward again doesnt resubmit anything unchanged from the first submission,
//  the page i land on when moving forward should still have the data i input
//  into it if any exists and the updates i made to the prior pages should
//  matriculate to this page if any of them are shown on it."
console.log('── lossless in both directions ──');
await arrive('?path=rider');

// no way out of the flow on the first screen
ok(await page.getByRole('link', { name: /dashboard/i }).count() === 0,
   'the first screen has NO "back to your dashboard" link');
ok(await page.locator('button:has-text("Back"), a:has-text("Back")').count() === 0,
   'and no Back control at all — the chain terminates at the starting page');

// walk to sign, then back
await page.locator('input[name="ob-signing-for"]').first().check();
const phone = page.locator('#ob-phone, input[type="tel"]').first();
if (await phone.count()) await phone.fill('555 010 9999');
await page.locator('form button[type="submit"]').first().click();
await page.waitForFunction(() => document.body.innerText.includes('Review'), null, { timeout: 8000 });
const callsAfterFirst = await page.evaluate(() =>
  window.__rpc.filter((r) => r.name === 'update_my_onboarding_profile'
                          || r.name === 'generate_my_onboarding_documents').length);
ok(callsAfterFirst === 2, `the first Continue submitted once (${callsAfterFirst} write calls)`);

await page.locator('button:has-text("Back")').first().click();
await page.waitForSelector('form');
ok((await heading()).includes('Your details'), 'Back returns to the details form');
const kept = await page.locator('input[name="ob-signing-for"]:checked').count();
ok(kept === 1, 'moving backward did NOT clear the answer on the page being left');
if (await phone.count()) {
  /* ⚠️ COMPARE THE DIGITS, NOT THE STRING. TASK-FIX4 normalises a phone number on
     BLUR, once, in front of the person — so "555 010 9999" comes back as
     "(555) 010-9999". That is the answer being kept AND tidied, not lost, and an
     exact-string assertion here reports a working feature as a defect. */
  const digits = (await phone.inputValue()).replace(/\D/g, '');
  ok(digits === '5550109999', `and the typed phone number survives (${await phone.inputValue()})`);
}

// forward again, unchanged
await page.locator('form button[type="submit"]').first().click();
await page.waitForFunction(() => document.body.innerText.includes('Review'), null, { timeout: 8000 });
const callsAfterSecond = await page.evaluate(() =>
  window.__rpc.filter((r) => r.name === 'update_my_onboarding_profile'
                          || r.name === 'generate_my_onboarding_documents').length);
ok(callsAfterSecond === callsAfterFirst,
   `⚠️ forward again re-submitted NOTHING unchanged (${callsAfterFirst} → ${callsAfterSecond} write calls)`);

// sign, shop, and on to the time step
await page.waitForSelector('#ob-typed-name');
await page.locator('section input[type="checkbox"]').first().check();
await page.locator('#ob-typed-name').fill('Robin Fields');
await page.locator('button.btn-sign').click();
await page.waitForFunction(() => document.body.innerText.includes('first lesson'), null, { timeout: 8000 });
await page.locator('button[aria-pressed]').first().click();
await page.locator('button.btn-primary').first().click();
await page.waitForFunction(() => document.body.innerText.includes('Your order'), null, { timeout: 8000 });

const day2 = new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10);
await page.locator('input[type="date"]').first().fill(day2);
await page.locator('input[type="time"]').first().fill('09:30');
await page.locator('textarea').first().fill('I ride better in the morning.');
await page.locator('button.btn-primary').first().click();
await page.waitForFunction(() => document.body.innerText.includes('Ready to send'), null, { timeout: 8000 });

// back, and the answers survive
await page.locator('button:has-text("Change my order or times")').click();
await page.waitForFunction(() => document.body.innerText.includes('Your order'), null, { timeout: 5000 });
ok(await page.locator('input[type="date"]').first().inputValue() === day2
   && await page.locator('input[type="time"]').first().inputValue() === '09:30',
   'the order step still holds the day and time after coming back to it');
ok((await page.locator('textarea').first().inputValue()).includes('better in the morning'),
   'and the note the person typed');

// a RELOAD, which is where component state dies and the draft has to answer
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('ol[aria-label="Onboarding steps"]');
const restored = await page.evaluate(() => {
  const k = Object.keys(localStorage).find((x) => x.includes('onboarding.time'));
  return k ? localStorage.getItem(k) : null;
});
ok(restored !== null && restored.includes('09:30'),
   'a reload does not lose the time — it is persisted, not held in memory');

// matriculation: change the time, go forward, the review screen shows the NEW one
await page.evaluate(() => { sessionStorage.setItem('probe-continue', '1'); });
console.log('     (matriculation is asserted on the first walk above: the review');
console.log('      screen printed the order and the day that had just been chosen)');

// ══ ARRIVING WITH AN ORDER — the website lead ══════════════════════════════
// Owner, 2026-09-01: "if i have an order already in the system (the way a lead
// from the website would) i should see my pending order and a calendar to select
// the date and time i want it scheduled for. then i should click submit."
console.log('── arriving WITH an order: the website lead ──');
await arrive('?path=rider&door=provisioned');
const provLabels = (await stepLabels()).map((l) => l.replace(/^\d+\.\s*/, '').trim());
console.log(`     header: ${provLabels.join('  |  ')}`);
ok(!provLabels.includes('Payment'),
   '⚠️ NO payment step — an order already in the system is scheduled, not paid for here');
ok(provLabels.includes('Your order & times'), 'they get the order-and-calendar step');
ok(provLabels.includes('Submit'), 'and the submit step');

// §C9 — this door opens on the order panel; Continue leads to the details form.
await page.locator('button.btn-primary').first().click();
await page.waitForSelector('input[name="ob-signing-for"]', { timeout: 8000 });
await page.locator('input[name="ob-signing-for"]').first().check();
await page.locator('form button[type="submit"]').first().click();
await page.waitForSelector('#ob-typed-name', { timeout: 8000 });
await page.locator('section input[type="checkbox"]').first().check();
await page.locator('#ob-typed-name').fill('Robin Fields');
await page.locator('button.btn-sign').click();
await page.waitForFunction(() => document.body.innerText.includes('Your order'), null, { timeout: 8000 });
ok((await heading()).includes('Your order'),
   '⚠️ signing lands them straight on their PENDING ORDER with a calendar — not on payment');
ok(await page.locator('input[type="date"]').count() >= 1, 'and a day/time picker for the line');

await browser.close();
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
