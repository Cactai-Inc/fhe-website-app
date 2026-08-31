/* PROBE — TASK-FIX1 §D. Is the signing box gone, and is the library intact?
 *
 * Test criterion 7: "DocumentsContent no longer offers signing; reading, PDF,
 * email-a-copy and the contract deep-link all still work."
 *
 * ⚠️ Absence is asserted on the EMITTED DOM, and positively: the probe finds the
 * unsigned row first and then proves there is no sign input inside it. Asserting
 * "no input on the page" would pass just as well on a page that failed to render.
 *
 * Run:
 *   VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=anon \
 *     npx vite --config test/browser/vite.config.ts --port 5199 --strictPort &
 *   node test/browser/probe-documents-retired.mjs
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:5199/test/browser/documents-content.html';
const UNSIGNED = '00000000-0000-4000-8000-0000000000d1';
const EXECUTED = '00000000-0000-4000-8000-0000000000d2';
const CONTRACT = '00000000-0000-4000-8000-0000000000d3';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage();
let failures = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) failures++; };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector(`[data-testid="self-sign-${UNSIGNED}"]`, { timeout: 10000 });

// The page rendered and the hazardous state is actually on screen.
ok(await page.locator('[data-testid="self-sign-section"]').isVisible(),
  'the page rendered, with an unsigned document the member is a signer on');

// ── the box is gone ────────────────────────────────────────────────────────
const unsignedRow = page.locator(`[data-testid="self-sign-${UNSIGNED}"]`);
ok(await unsignedRow.locator('input').count() === 0,
  'unsigned row — NO input of any kind (the name box is retired)');
ok(await unsignedRow.locator('text=Type your full legal name to sign').count() === 0,
  'unsigned row — the sign label is not in the emitted DOM');
ok(await unsignedRow.locator('button', { hasText: /^Sign$/ }).count() === 0,
  'unsigned row — no Sign button');
ok(await page.locator('input').count() === 0,
  'and no name box anywhere on the page');

// ── and it points into the corridor instead ───────────────────────────────
const corridor = unsignedRow.locator('a[href="/app/onboarding"]');
ok(await corridor.count() === 1, 'unsigned row — deep-links to /app/onboarding instead');
ok((await corridor.textContent())?.includes('Open to review'),
  `unsigned row — the link reads: "${(await corridor.textContent())?.trim()}"`);

// ── capability 1: reading, on an UNSIGNED row (it is not lost with the box) ──
ok(await unsignedRow.locator('button', { hasText: 'Read' }).count() === 1,
  'CAPABILITY reading — the unsigned row still opens the paginated reader');
await unsignedRow.locator('button', { hasText: 'Read' }).click();
await page.waitForSelector('text=Participant Liability Release', { timeout: 5000 });
const viewerText = await page.locator('body').textContent();
ok(viewerText.includes('Printed Name: Test Member'),
  'CAPABILITY reading — the full merged body is on screen');
await page.keyboard.press('Escape').catch(() => {});
await page.locator('button[aria-label], button', { hasText: /close/i }).first().click().catch(() => {});

// ── capability 2 + 3: PDF and email-a-copy, on the EXECUTED row ────────────
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector(`[data-testid="self-sign-${EXECUTED}"]`);
const executedRow = page.locator(`[data-testid="self-sign-${EXECUTED}"]`);
ok(await executedRow.locator('button', { hasText: 'Download signed PDF' }).count() === 1,
  'CAPABILITY PDF — "Download signed PDF" still on the executed row');
ok(await executedRow.locator('button', { hasText: /copy to me/ }).count() === 1,
  'CAPABILITY email — "Send a copy to me" still on the executed row');
ok(await executedRow.locator('button', { hasText: 'Read' }).count() === 1,
  'CAPABILITY reading — still on the executed row');

// ── capability 4: the contract deep-link, now converged on /start ──────────
const contractRow = page.locator(`[data-testid="self-sign-${CONTRACT}"]`);
const link = contractRow.locator('a');
ok(await link.count() === 1, 'CAPABILITY deep-link — the contract row still links out');
const href = await link.getAttribute('href');
ok(href === `/app/contracts/${CONTRACT}/start`,
  `CAPABILITY deep-link — converged on /start (AR7 §9): ${href}`);

// ── nothing tried to sign ─────────────────────────────────────────────────
const rpcs = await page.evaluate(() => window.__rpc.map((r) => r.name));
ok(!rpcs.includes('record_signature'),
  `no record_signature call was made rendering this page [rpcs: ${[...new Set(rpcs)].join(', ')}]`);

await browser.close();
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
