/**
 * CONTRACTSEND §1 — every input_kind on the lease, exercised in a REAL browser
 * against the REAL ContractPage. Prints one PASS/FAIL line per kind.
 *
 * Run:  npx vite --config test/browser/vite.config.ts --port 5199 --strictPort
 *       node test/browser/probe-field-roundtrip.mjs
 *
 * Each kind has its own recipe because each control is genuinely different — a
 * date is typed, a yes/no is a pair of buttons, a week grid is day pills, an
 * add_text is a button that reveals an input. A single generic "fill the box"
 * sweep reports eight false failures, which is exactly the kind of result that
 * gets mistaken for a defect.
 *
 * `gate` presets a field value before the page loads. A control behind an unmet
 * conditional is rendered as a deliberate non-interactive PREVIEW
 * (pointer-events-none) because the composer drops its line — accepting input
 * there would be a lie. So opening the gate is part of reaching the control, not
 * a way of dodging the test.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const PAGE = 'http://localhost:5199/test/browser/contract-page.html';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const payloads = JSON.parse(fs.readFileSync(
  new URL('../ui/fixtures/contractsend-rpc-payloads.json', import.meta.url), 'utf8'));
const detail = payloads.contract_document_detail;
const kindOf = new Map(detail.fields.map((f) => [f.field_key, f.input_kind || '(null)']));

/** kind -> how to reach and operate its control. `gate` opens a conditional. */
const RECIPES = [
  // input_kind null = the party/contact tokens, whose control is whatever the
  // clause prose gives them; matched by label like the other free-text kinds.
  { kind: '(null)', fill: { placeholder: null, value: 'probe plain' } },
  { kind: 'text', fill: { placeholder: null, value: 'probe text' } },
  { kind: 'longtext', fill: { placeholder: null, value: 'probe long text' } },
  { kind: 'number', fill: { placeholder: null, value: '11' } },
  { kind: 'currency', fill: { placeholder: null, value: '750' } },
  { kind: 'date', fill: { placeholder: null, value: '2027-03-04' }, noBlur: true },
  { kind: 'percent', fill: { placeholder: null, value: '35' },
    gate: { 'TXN.TRAINER_CARE_INCLUDE': 'YES', 'TXN.TRAINER_EXERCISE_COST': 'SHARED' } },
  { kind: 'select', pick: 'select' },
  { kind: 'certify', pick: 'checkbox' },
  { kind: 'yesno', click: { name: /^Yes$/ } },
  { kind: 'buttons', click: { name: /trail|arena|show|jump|hack/i } },
  { kind: 'contacts_list', click: { name: /Add Co-owner/i } },
  { kind: 'fee_schedule', click: { name: /Add fee option/i } },
  { kind: 'med_schedule', click: { name: /Add a medication or supplement/i } },
  { kind: 'reveal_text', click: { name: /^Yes$/ }, near: /prohibited from using certain tack/ },
  { kind: 'location', fill: { placeholder: 'Facility / place name (e.g. Willow Creek Stables)', value: 'Willow Creek Stables' } },
  { kind: 'add_text', reveal: { button: /Add Restrictions/i, placeholder: 'list any restrictions', value: 'No jumping over 2ft' } },
  { kind: 'week_grid', pill: true, gate: { 'TXN.LEASE_TYPE': 'PARTIAL' } },
];

const b = await chromium.launch({ executablePath: CHROME });

async function open(gate) {
  const p = await b.newPage({ viewport: { width: 1400, height: 1100 } });
  await p.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await p.evaluate(({ d, gate }) => {
    const copy = JSON.parse(JSON.stringify(d));
    for (const [k, v] of Object.entries(gate ?? {})) {
      const f = copy.fields.find((x) => x.field_key === k); if (f) f.value = v;
    }
    sessionStorage.setItem('harness-contract-detail', JSON.stringify(copy));
  }, { d: detail, gate });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(2400);
  await p.evaluate(() => { window.__rpc.length = 0; });
  return p;
}

/** The saves this kind produced, if any. */
const savesFor = (p, kind) => p.evaluate((kindEntries) => {
  const m = new Map(kindEntries);
  return window.__rpc
    .filter((c) => /^set_(contract_field|field_structured)$/.test(c.name))
    .map((c) => ({ k: c.args?.p_field_key, v: c.args?.p_value ?? c.args?.p_structured }))
    .filter((c) => m.get(c.k) === window.__kind);
}, [...kindOf.entries()]);

async function centre(loc) {
  // scrollIntoViewIfNeeded parks the target under the sticky toolbar, which then
  // intercepts the click; centring it keeps the pointer on the control itself.
  await loc.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' })).catch(() => {});
}

async function run(r) {
  const p = await open(r.gate);
  await p.evaluate((k) => { window.__kind = k; }, r.kind);
  const labels = detail.fields
    .filter((f) => (f.input_kind || '(null)') === r.kind && f.can_edit)
    .map((f) => f.label || f.field_key);
  let note = 'no enabled control found';

  const done = async () => {
    const s = await savesFor(p, r.kind);
    return s.length ? `PASS — ${s[0].k} = ${JSON.stringify(s[0].v).slice(0, 60)}` : null;
  };

  try {
    if (r.fill) {
      const phs = r.fill.placeholder ? [r.fill.placeholder] : labels;
      for (const ph of phs) {
        const loc = p.locator(`input[placeholder="${ph.replace(/["\\]/g, '\\$&')}"], textarea[placeholder="${ph.replace(/["\\]/g, '\\$&')}"]`);
        for (let i = 0; i < await loc.count(); i++) {
          const c = loc.nth(i);
          if (await c.isDisabled()) { note = 'control found but DISABLED (gate not open)'; continue; }
          await centre(c);
          await c.fill(r.fill.value, { timeout: 3000 });
          if (!r.noBlur) { await p.keyboard.press('Tab'); }
          await p.waitForTimeout(600);
          const hit = await done(); if (hit) { note = hit; break; }
          note = 'control found but NO save fired';
        }
        if (note.startsWith('PASS')) break;
      }
    } else if (r.reveal) {
      const btn = p.getByRole('button', { name: r.reveal.button }).first();
      await centre(btn); await btn.click({ timeout: 3000 });
      await p.waitForTimeout(400);
      const box = p.locator(`input[placeholder="${r.reveal.placeholder}"]`).first();
      await box.click(); await box.fill(r.reveal.value); await p.keyboard.press('Tab');
      await p.waitForTimeout(700);
      note = (await done()) ?? 'revealed input did not save';
    } else if (r.pill) {
      const pill = p.locator('[aria-pressed]').first();
      await centre(pill); await pill.click({ timeout: 4000 });
      await p.waitForTimeout(700);
      note = (await done()) ?? 'day pill did not save';
    } else if (r.click) {
      const btns = p.getByRole('button', { name: r.click.name });
      const n = Math.min(await btns.count(), 12);
      for (let i = 0; i < n; i++) {
        const c = btns.nth(i);
        if (!(await c.isVisible().catch(() => false)) || await c.isDisabled().catch(() => true)) continue;
        if (r.near) {
          const anchor = p.locator(`text=${r.near.source.replace(/\\/g, '')}`).first();
          const [bb, ab] = [await c.boundingBox().catch(() => null), await anchor.boundingBox().catch(() => null)];
          if (bb && ab && Math.abs(bb.y - ab.y) > 60) continue;
        }
        await centre(c); await c.click({ timeout: 2500 }).catch(() => {});
        await p.waitForTimeout(500);
        const hit = await done(); if (hit) { note = hit; break; }
      }
    } else if (r.pick) {
      const sel = r.pick === 'select' ? 'select' : 'input[type=checkbox]';
      const loc = p.locator(sel);
      const n = Math.min(await loc.count(), 60);
      for (let i = 0; i < n; i++) {
        const c = loc.nth(i);
        if (!(await c.isVisible().catch(() => false)) || await c.isDisabled().catch(() => true)) continue;
        await centre(c);
        if (sel === 'select') {
          const vals = await c.locator('option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
          if (!vals.length) continue;
          await c.selectOption(vals[0], { timeout: 2000 }).catch(() => {});
        } else {
          await c.click({ timeout: 1500, force: true }).catch(() => {});
        }
        await p.waitForTimeout(400);
        const hit = await done(); if (hit) { note = hit; break; }
      }
    }
  } catch (e) {
    note = 'ERROR ' + String(e).split('\n')[0].slice(0, 90);
  }
  await p.close();
  return note;
}

let failed = 0;
for (const r of RECIPES) {
  const note = await run(r);
  if (!note.startsWith('PASS')) failed += 1;
  console.log(`${r.kind.padEnd(15)} ${note}`);
}
await b.close();
console.log(`\n${RECIPES.length - failed}/${RECIPES.length} input kinds round-trip.`);
process.exit(failed ? 1 : 0);
