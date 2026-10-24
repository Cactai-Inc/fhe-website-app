/**
 * generate-sample-document.mjs — a SAMPLE of a contract template showing every
 * branch, for review. Kept beside export-template-manifest.mjs.
 *
 * Unlike a real composed document (one selection per gate), the sample prints
 * EVERY clause regardless of condition, so every wording a selection could produce
 * is visible on one page:
 *   - each conditional clause is preceded by one gray line naming the selection
 *     that produces it (its condition, in plain terms);
 *   - every {{input token}} prints as its field label followed by a blank underline,
 *     like a paper form (read-only sample — nothing is filled);
 *   - every disclosure section prints its none clause AND its yes clause, the yes
 *     clause followed by one sample entry whose boxes show the field labels with
 *     blank spaces;
 *   - every pending placeholder prints.
 *
 * Output: an HTML view and a PDF, written next to each other. READ-ONLY (reads the
 * def tables only). Connection: DATABASE_URL, else the first line of .env.db.
 *
 * Usage:
 *   node scripts/generate-sample-document.mjs HORSE_SALE_V3 out/sample_sale
 *   (writes out/sample_sale.html and out/sample_sale.pdf)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function connectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return readFileSync(resolve(ROOT, '.env.db'), 'utf8').split('\n')[0].trim();
}
function queryJson(sql) {
  const out = execFileSync('psql', [connectionString(), '-tAX', '-c', sql], {
    encoding: 'utf8', maxBuffer: 1024 * 1024 * 64, env: { ...process.env, PGCLIENTENCODING: 'UTF8' },
  });
  return out.trim() ? JSON.parse(out.trim()) : null;
}
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// The seven disclosure sections and their sample field labels (mirrors the record
// field-order spec; INJURIES_TO_HUMANS is a scalar, no boxes).
const DISCLOSURE_FIELDS = {
  KNOWN_CONDITIONS: ['Description', 'Trigger', 'Current or Date of last occurrence', 'Accommodations'],
  MEDICAL_HISTORY: ['Description', 'Date', 'Type', 'Status'],
  BEHAVIORAL_HISTORY: ['Description', 'Trigger', 'Current or Date of last occurrence'],
  INJURIES_TO_HORSE: ['Description', 'Date or date range', 'Outcome', 'Status'],
  MEDICATIONS: ['Name', 'Purpose', 'Dose', 'Frequency', 'Cost per dose', 'Rx required'],
  SUPPLEMENTS: ['Name', 'Purpose', 'Dose', 'Frequency', 'Cost per dose', 'Rx required'],
};

/** Plain-language description of a clause condition (what selection shows it). */
function describeCondition(cond) {
  if (!cond) return null;
  if (cond.all) return cond.all.map(describeCondition).filter(Boolean).join(' AND ');
  if (cond.any) return cond.any.map(describeCondition).filter(Boolean).join(' OR ');
  const fk = cond.field_key;
  if (cond.equals) {
    const vals = cond.equals.map((v) => (v === '' ? '(blank / unanswered)' : v)).join(' or ');
    return `${fk} = ${vals}`;
  }
  if (cond.contains) return `${fk} contains ${cond.contains.join(' or ')}`;
  if (cond.gte !== undefined) return `${fk} ≥ ${cond.gte}`;
  return fk ? `${fk} set` : null;
}

function build(templateKey) {
  const tpl = queryJson(`SELECT coalesce(row_to_json(t),'null'::json) FROM (SELECT title FROM contract_templates WHERE template_key=${lit(templateKey)}) t;`);
  const sections = queryJson(`SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.sort_order),'[]'::jsonb) FROM (SELECT section_key, heading, sort_order FROM contract_section_defs WHERE template_key=${lit(templateKey)}) s;`) || [];
  const clauses = queryJson(`SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.section_key, c.sort_order),'[]'::jsonb) FROM (SELECT section_key, clause_key, body, conditional_on, sort_order FROM contract_clause_defs WHERE template_key=${lit(templateKey)}) c;`) || [];
  const fields = queryJson(`SELECT coalesce(jsonb_agg(to_jsonb(f)),'[]'::jsonb) FROM (SELECT field_key, label FROM contract_field_defs WHERE template_key=${lit(templateKey)}) f;`) || [];
  const labelOf = new Map(fields.map((f) => [f.field_key, f.label]));

  // Replace each {{token}} in a body with a paper-form field: label + blank line.
  // A disclosure section's content token renders the box sample (handled separately).
  const renderBody = (body) => esc(body).replace(/\{\{([A-Z0-9_.]+)\}\}/g, (_, tok) => {
    const lbl = labelOf.get(tok) || tok;
    return `<span class="field"><span class="flabel">${esc(lbl)}</span> <span class="blank"></span></span>`;
  });

  const parts = [];
  const sorted = [...sections].sort((a, b) => a.sort_order - b.sort_order);
  let n = 0;
  let clauseCount = 0; // exactly one per clause, however it renders — must equal the manifest's clause count
  for (const s of sorted) {
    n += 1;
    parts.push(`<h2>${n}. ${esc(s.heading)}</h2>`);
    const secClauses = clauses.filter((c) => c.section_key === s.section_key).sort((a, b) => a.sort_order - b.sort_order);
    for (const c of secClauses) {
      clauseCount += 1;
      const dc = `data-clause="${esc(c.clause_key)}"`;
      const desc = describeCondition(c.conditional_on);
      if (desc) parts.push(`<p class="cond">▸ Shows when: ${esc(desc)}</p>`);
      // disclosure content token → the boxed sample
      const discMatch = (c.body || '').match(/\{\{HORSE\.([A-Z_]+)\}\}/);
      if (discMatch && DISCLOSURE_FIELDS[discMatch[1]]) {
        const lead = c.body.split('{{')[0];
        parts.push(`<p ${dc}>${renderBody(lead)}</p>`);
        parts.push(`<div class="entry"><div class="erow">${DISCLOSURE_FIELDS[discMatch[1]]
          .map((l) => `<div class="box"><div class="blabel">${esc(l)}</div><div class="bval"></div></div>`).join('')}</div></div>`);
      } else if ((c.body || '').trim() === '') {
        parts.push(`<p class="carrier" ${dc}>[input carrier — holds a selector; no printed text]</p>`);
      } else {
        parts.push(`<p ${dc}>${renderBody(c.body)}</p>`);
      }
    }
  }
  return `<!doctype html><meta charset=utf-8><style>
    body{font-family:Georgia,serif;max-width:760px;margin:24px auto;color:#1b2a22;font-size:13.5px;line-height:1.7;padding:0 20px}
    h1{font-size:22px} h2{font-size:16px;border-bottom:2px solid #1f5c3a;padding-bottom:4px;margin-top:22px}
    .cond{font-size:11px;color:#8a7a3a;background:#faf6e8;border-left:3px solid #c9b45a;padding:2px 8px;margin:8px 0 2px;font-family:system-ui}
    .carrier{font-size:11px;color:#999;font-style:italic}
    .field{white-space:nowrap} .flabel{font-size:11px;color:#1f5c3a;text-transform:uppercase;letter-spacing:.03em}
    .blank{display:inline-block;min-width:140px;border-bottom:1px solid #999;height:1em;vertical-align:baseline}
    .entry{border:1px solid rgba(20,83,45,.15);background:rgba(240,253,244,.4);border-radius:8px;padding:8px;margin:6px 0}
    .erow{display:flex;flex-wrap:wrap;gap:6px}
    .box{min-width:7rem;flex:1 1 7rem;border:1px solid rgba(20,83,45,.15);background:#fff;border-radius:6px;padding:4px 8px}
    .blabel{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:rgba(21,128,61,.7)}
    .bval{min-height:1.2em;border-bottom:1px dashed #ccc}
  </style><h1>SAMPLE — ${esc(tpl?.title || templateKey)}</h1>
  <p style="font-size:11px;color:#888">Every clause and branch shown (${clauseCount} clauses — matches the editor manifest). Gray lines name the selection that produces each conditional clause. Input tokens print as labeled blanks; disclosure sections show one sample entry with field boxes. Not a real document.</p>
  ${parts.join('\n')}`;
}

// ── main ──
const templateKey = process.argv[2];
const outBase = process.argv[3];
if (!templateKey || !outBase) { console.error('usage: node scripts/generate-sample-document.mjs <TEMPLATE_KEY> <out-base-path>'); process.exit(1); }
const html = build(templateKey);
const absBase = resolve(ROOT, outBase);
mkdirSync(dirname(absBase), { recursive: true });
writeFileSync(`${absBase}.html`, html, 'utf8');
console.error(`wrote ${absBase}.html`);
// PDF via headless Chrome (print-to-pdf) if available.
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
try {
  execSync(`"${chrome}" --headless --disable-gpu --no-sandbox --print-to-pdf="${absBase}.pdf" --print-to-pdf-no-header "file://${absBase}.html"`, { stdio: 'ignore' });
  console.error(`wrote ${absBase}.pdf`);
} catch {
  console.error('(PDF skipped — headless Chrome not available; HTML written)');
}
