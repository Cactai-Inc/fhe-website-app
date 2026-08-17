/**
 * Screenshot helper for content scrolled below a fixed/pinned hero
 * (e.g. Landing's `position: fixed` hero, where scripts/shot.mjs's plain
 * --window-size capture can't reach anything below the fold because it
 * doesn't execute JS scrolling).
 *
 *   node scripts/shot-footer.mjs <url> <out.png> [width] [height] [anchor-id]
 *
 * Requires puppeteer-core (npm install --no-save puppeteer-core) and a local
 * Chrome install; drives real Chrome to scroll the given element into view,
 * waiting for layout to settle (images/fonts can still grow the page after
 * the first scroll), before capturing.
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const [, , url, out, wStr = '1440', hStr = '900', anchorId = 'site-footer'] = process.argv;
const w = Number(wStr);
const h = Number(hStr);
mkdirSync('out', { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
});
const page = await browser.newPage();
await page.setViewport({ width: w, height: h });
await page.goto(url, { waitUntil: 'networkidle0' });

let prevHeight = -1;
for (let i = 0; i < 10; i++) {
  await page.evaluate((id) => {
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, anchorId);
  await new Promise((r) => setTimeout(r, 400));
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  if (height === prevHeight) break;
  prevHeight = height;
}
await page.screenshot({ path: out });
await browser.close();
console.log('wrote', out);
