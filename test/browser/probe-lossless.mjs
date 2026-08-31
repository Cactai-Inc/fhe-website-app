/* PROBE — TASK-FIX4 §10, criteria 4, 5, 6 and 7.
 *
 * ⚠️ Criterion 5 says it outright: *"A reload mid-form restores what was typed.
 * Prove it in Chromium, not by reading code."* So this drives the REAL
 * `SignStart` in a REAL Chromium and does the two things jsdom cannot:
 * `page.reload()` and `page.goBack()`.
 *
 * WHY THOSE TWO CANNOT BE FAKED. A reload and a browser-back both destroy React
 * state identically, and both fire `pagehide` — which is the event that flushes
 * the last 400ms of typing out of the debounce. jsdom has no page lifecycle, so a
 * jsdom test would pass on a component that loses every keystroke since the last
 * debounce tick. That gap is the whole reason this file exists.
 *
 * Run:
 *   VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=anon \
 *     npx vite --config test/browser/vite.config.ts --port 5199 --strictPort &
 *   node test/browser/probe-lossless.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5199/test/browser/lossless.html';
const FORM = `${BASE}#/sign/rider`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage();
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };

const val = (sel) => page.locator(sel).inputValue();

async function openForm() {
  await page.goto(FORM, { waitUntil: 'networkidle' });
  await page.waitForSelector('#sign-first', { timeout: 15000 });
}

/** Clear every draft so a rerun starts from nothing. */
async function wipeDrafts() {
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('fhe.draft.')) localStorage.removeItem(k);
  });
}

// ── setup ───────────────────────────────────────────────────────────────────
await openForm();
await wipeDrafts();
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#sign-first');

// ── criterion 7 · normalisation, ON BLUR, in front of them ──────────────────
console.log('\n── §4 · normalisation happens on blur, and is visible ──');

const NAME_CASES = [
  ['fiszer', 'Fiszer', 'a leading lowercase letter is capitalised'],
  ['labuzetta', 'Labuzetta', 'better than nothing on a run-together surname'],
  ['LaBuzetta', 'LaBuzetta', '⚠️ an interior capital is NEVER touched'],
  ['la buzetta', 'La Buzetta', 'per WORD, not per field'],
];
for (const [typed, expected, why] of NAME_CASES) {
  await page.fill('#sign-last', '');
  await page.fill('#sign-last', typed);
  // Nothing may change while they are still in the box.
  ok(await val('#sign-last') === typed, `"${typed}" is untouched while focused`);
  await page.locator('#sign-first').focus();          // ← the blur
  const got = await val('#sign-last');
  ok(got === expected, `"${typed}" → "${got}" (expected "${expected}") — ${why}`);
}

// ── criterion 8 · their correction is not re-normalised ─────────────────────
// ⚠️ Fresh page first. The loop above already produced "La Buzetta" for this
// field, and the guard remembers it: re-typing `la buzetta` would then be read as
// walking our own answer back — correct behaviour, wrong starting state for this
// assertion. The rule under test is about a DIFFERENT revision.
console.log('\n── §4 · a deliberate correction survives ──');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#sign-last');
await page.fill('#sign-last', 'la buzetta');
await page.locator('#sign-first').focus();
ok(await val('#sign-last') === 'La Buzetta', 'we produced "La Buzetta"');
await page.fill('#sign-last', 'La buzetta');           // they revise our answer
await page.locator('#sign-first').focus();
ok(await val('#sign-last') === 'La buzetta',
  '⚠️ "La buzetta" survives the blur — the field does not fight the correction');

// phone and email, same mechanism
await page.fill('#sign-phone', '8585550123');
await page.locator('#sign-first').focus();
ok(await val('#sign-phone') === '(858) 555-0123', 'phone 8585550123 → (858) 555-0123');
await page.fill('#sign-email', '  Elisheva.Fiszer@Example.COM ');
await page.locator('#sign-first').focus();
ok(await val('#sign-email') === 'elisheva.fiszer@example.com', 'email is trimmed and lowercased');

// ── criterion 4 · auto-save fires after input, and the indicator shows it ───
console.log('\n── §3 · auto-save, and the indicator that makes it visible ──');
await page.fill('#sign-first', 'Elisheva');
await page.locator('#sign-last').focus();
await page.waitForFunction(
  () => Object.keys(localStorage).some((k) => k.startsWith('fhe.draft.') && k.includes('sign-start')),
  { timeout: 5000 },
);
ok(true, 'a draft key appears in storage after input');
// The indicator passes through "Saving…" first, so wait for the settled state
// rather than sampling it mid-debounce.
const indicatorSeen = await page.locator('text=Saved on this device')
  .first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
ok(indicatorSeen, '⚠️ the auto-save indicator is on screen — without it, auto-save reads as data loss');

// what is on screen, immediately before the reload
const before = {
  first: await val('#sign-first'),
  last: await val('#sign-last'),
  phone: await val('#sign-phone'),
  email: await val('#sign-email'),
};
console.log('   before:', JSON.stringify(before));

// ── criterion 5 · A RELOAD MID-FORM RESTORES WHAT WAS TYPED ─────────────────
console.log('\n── §6 · a reload is lossless ──');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#sign-first');
await page.waitForFunction(() => document.querySelector('#sign-first')?.value !== '', { timeout: 5000 })
  .catch(() => {});
const afterReload = {
  first: await val('#sign-first'),
  last: await val('#sign-last'),
  phone: await val('#sign-phone'),
  email: await val('#sign-email'),
};
console.log('   after reload:', JSON.stringify(afterReload));
for (const k of Object.keys(before)) {
  ok(afterReload[k] === before[k], `reload · ${k} came back as "${afterReload[k]}"`);
}

// ⚠️ AND THE CASE THE DEBOUNCE WOULD LOSE: type, then reload IMMEDIATELY.
await page.fill('#sign-first', 'Brian');
await page.reload({ waitUntil: 'networkidle' });      // no pause — inside the 400ms
await page.waitForSelector('#sign-first');
await page.waitForFunction(() => document.querySelector('#sign-first')?.value !== '', { timeout: 5000 })
  .catch(() => {});
ok(await val('#sign-first') === 'Brian',
  '⚠️ a reload INSIDE the debounce window still keeps the keystrokes (pagehide flush)');

// ── criterion 6 · BROWSER-BACK LIKEWISE ────────────────────────────────────
console.log('\n── §6 · browser-back is lossless ──');
await page.fill('#sign-last', 'Olenik');
await page.locator('#sign-first').focus();
await page.evaluate(() => { window.location.hash = '#/elsewhere'; });
await page.waitForSelector('[data-testid="elsewhere"]', { timeout: 10000 });
ok(true, 'navigated away from the form');

await page.goBack();
await page.waitForSelector('#sign-first', { timeout: 10000 });
await page.waitForFunction(() => document.querySelector('#sign-first')?.value !== '', { timeout: 5000 })
  .catch(() => {});
const afterBack = { first: await val('#sign-first'), last: await val('#sign-last') };
console.log('   after browser-back:', JSON.stringify(afterBack));
ok(afterBack.first === 'Brian', `browser-back · first came back as "${afterBack.first}"`);
ok(afterBack.last === 'Olenik', `browser-back · last came back as "${afterBack.last}"`);

// ── Clear form discards the draft DELIBERATELY ─────────────────────────────
console.log('\n── §1 · Clear form is the one control that discards ──');
await page.locator('button:has-text("Clear form")').click();
ok(await val('#sign-first') === '', 'Clear form empties the boxes');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#sign-first');
ok(await val('#sign-first') === '', '⚠️ and the draft is gone — a cleared form stays cleared across a reload');

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
