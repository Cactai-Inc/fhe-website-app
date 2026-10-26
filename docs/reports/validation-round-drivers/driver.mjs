// Shared Playwright driver helpers for the validation round.
import { chromium } from '/Users/cactai/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
export const BASE = 'https://www.frenchheritageequestrian.com';
export const SHOTS = '/Users/Cactai/Downloads/claude-code-repo/French Heritage Project/Repo/worktrees/validation/docs/reports/validation-round-shots';

export async function newBrowser(opts={}) {
  return chromium.launch({ headless: true, ...opts });
}
export async function newCtx(b) {
  const ctx = await b.newContext({ viewport: { width: 1360, height: 1000 } });
  ctx.setDefaultTimeout(30000);
  return ctx;
}
export async function loginEmailPassword(page, email, password) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  // reveal the email/password form
  const toggle = page.getByRole('button', { name: /email and password/i });
  if (await toggle.count()) { await toggle.first().click(); await page.waitForTimeout(600); }
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  await page.locator('input[type="password"], input[name="password"]').first().fill(password);
  // submit
  const submit = page.getByRole('button', { name: /^sign in$|log in|continue$/i });
  if (await submit.count()) await submit.first().click();
  else await page.keyboard.press('Enter');
  await page.waitForTimeout(3500);
}
export async function shot(page, name) {
  const path = `${SHOTS}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  return path;
}

// Robust React-controlled <select> setter (owner ruling): set value via the native
// HTMLSelectElement setter, then dispatch input+change so React's onChange fires.
export async function setReactSelect(locator, value) {
  await locator.evaluate((el, val) => {
    const proto = window.HTMLSelectElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}
// Find a select (optionally already visible) that contains an option with this value.
export async function selectByOptionValue(page, value) {
  const sels = await page.locator('select').all();
  for (const s of sels) {
    const has = await s.locator(`option[value="${value}"]`).count();
    if (has) { await setReactSelect(s, value); return true; }
  }
  return false;
}

// Robust React-controlled text/number input setter (owner ruling): native value
// setter + input+change dispatch, then blur to trigger autosave.
export async function setReactInput(locator, value) {
  await locator.evaluate((el, val) => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
  }, value);
}
