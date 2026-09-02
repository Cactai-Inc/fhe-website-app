/* PROBE — TASK-SITECOPY-B. THE FIVE SENTENCES, COMPOSED, IN A REAL CHROMIUM.
 *
 * ⚠️ WHAT THIS TESTS THAT A GREP CANNOT. "The word 'barn' is gone from the
 * source" is not the claim. The claim is that five sentences are BUILT from the
 * tenant's property-term SHAPE and stay grammatical when that shape changes —
 * including the plural case ("the stables"), where a naive find-and-replace
 * produces "3 of us at the stables has been told". So every sentence is read off
 * the rendered page, twice: once for FHE's own word, once for a plural tenant.
 *
 * Run:
 *   VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=anon \
 *     npx vite --config test/browser/vite.config.ts --port 5199 --strictPort &
 *   node test/browser/probe-sitecopy-b.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5199/test/browser';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage();
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };
const say = (label, text) => console.log(`      "${text}"   ← ${label}`);

async function arrive(query) {
  await page.goto(`${BASE}/sitecopy-b.html${query}`, { waitUntil: 'networkidle' });
}
/** The one sentence on screen that contains `needle`, whitespace-collapsed. */
async function sentence(needle) {
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const i = body.indexOf(needle);
  if (i < 0) return null;
  const start = body.lastIndexOf('.', i) + 1;
  const endDot = body.indexOf('.', i);
  return body.slice(start, endDot < 0 ? body.length : endDot + 1).trim();
}
/** No rendered page may ever say this again. */
async function noBarn() {
  const body = await page.locator('body').innerText();
  return !/the barn/i.test(body);
}

/* ══ ONE RUN OF ALL FIVE, FOR ONE TENANT WORD ═══════════════════════════════
   `term` is empty for FHE's own default (ranch) and 'stables' for the plural
   substitution proof, which is the test that separates a mechanism from a
   find-and-replace. */
async function walk(term, expect) {
  const q = term ? `&term=${term}` : '';
  console.log(`\n── the tenant's word is "${expect.noun}" ${term ? '(PLURAL — the substitution proof)' : '(FHE default, no override)'} ──`);

  // ── #1-#3 Confirmation: three states of ONE line, which must stay parallel.
  for (const [state, needle] of [['ok', 'has been emailed to'], ['fail', 'could not email'], ['pending', 'Sending your inquiry']]) {
    await arrive(`?view=confirmation&state=${state}${q}`);
    await page.waitForSelector('#conf-emails');
    const s = await sentence(needle);
    say(`/confirmation · ${state}`, s);
    ok(s?.includes(expect.article), `#${state === 'ok' ? 1 : state === 'fail' ? 2 : 3} /confirmation ${state} names "${expect.article}"`);
    ok(await noBarn(), `      and the page says "the barn" nowhere`);
  }

  // ── #4 OrderPayment, on the surface that is actually reachable: /order/:id.
  await arrive(`?view=order${q}`);
  await page.waitForSelector('h2:has-text("Payment")');
  const pay = await sentence('We accept Zelle');
  say('/order/:id · payment', pay);
  ok(pay?.includes(`or cash ${expect.prep}`), `#4 /order/:id reads "or cash ${expect.prep}"`);
  ok(pay?.includes('—'), '      and both em-dashes survived (&mdash; preserved)');
  ok(await noBarn(), '      and the page says "the barn" nowhere');

  // ── #4b the SAME component on the surface TRAP 4 names second. It is kept but
  //     unrouted (Onboarding.tsx:649-653) — see the entry's own comment.
  await arrive(`?view=retired-onboarding-payment${q}`);
  await page.waitForSelector('h2:has-text("Payment")');
  const pay2 = await sentence('We accept Zelle');
  say('/app/onboarding · retired payment step', pay2);
  ok(pay2?.includes(`or cash ${expect.prep}`), `#4b the kept-but-unrouted onboarding payment step reads the same`);

  // ── #5 the activation panel. reached comes from report_order_incorrect, so the
  //     sentence is REACHED BY CLICKING, exactly as a person reaches it.
  for (const [reached, want] of [[3, `3 of us ${expect.prep} have been told`], [1, `someone ${expect.prep} has been told`]]) {
    await arrive(`?view=activation&reached=${reached}${q}`);
    await page.waitForSelector('button:has-text("Notify staff this isn\'t correct")');
    await page.locator('button:has-text("Notify staff this isn\'t correct")').click();
    await page.locator('#act-order-note').fill('The horse is wrong.');
    await page.locator('button:has-text("Send this to staff")').click();
    await page.waitForSelector('[role="status"]');
    const told = (await page.locator('[role="status"]').innerText()).replace(/\s+/g, ' ').trim();
    say(`activation · reached=${reached}`, told);
    ok(told.includes(want), `#5 reached=${reached} reads "${want}"`);
    ok(!/ has been told/.test(told) || reached === 1,
      `      and reached>1 does NOT say "has been told" (the pre-existing agreement bug)`);
    ok(await noBarn(), '      and the panel says "the barn" nowhere');
  }
}

await walk('', { noun: 'ranch', article: 'the ranch', prep: 'at the ranch' });
await walk('stables', { noun: 'stables', article: 'the stables', prep: 'at the stables' });

await browser.close();
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
