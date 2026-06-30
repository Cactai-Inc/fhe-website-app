/**
 * Headless-Chrome screenshot helper for visual milestones.
 *
 *   node scripts/shot.mjs <url-or-file> <out.png> [widthxheight] [vt-budget-ms]
 *
 * Examples:
 *   node scripts/shot.mjs http://localhost:5173/ride out/ride.png 1280x2400
 *   node scripts/shot.mjs file:///abs/path/preview.html out/doc.png 900x1200 1500
 *
 * Uses --virtual-time-budget so animations/fonts settle before capture. Honors
 * the working agreement: SHOW renders at each visual milestone.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const [, , target, out = 'out/shot.png', size = '1280x2000', vt = '2000'] = process.argv;
if (!target) {
  console.error('usage: node scripts/shot.mjs <url-or-file> <out.png> [WxH] [vt-budget-ms]');
  process.exit(1);
}

const [w, h] = size.split('x');
const outPath = resolve(out);
mkdirSync(dirname(outPath), { recursive: true });

execFileSync(
  CHROME,
  [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${w},${h}`,
    `--screenshot=${outPath}`,
    `--virtual-time-budget=${vt}`,
    target,
  ],
  { stdio: 'inherit' },
);
console.log(`wrote ${outPath}`);
