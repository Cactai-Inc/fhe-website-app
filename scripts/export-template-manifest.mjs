/**
 * export-template-manifest.mjs — editor manifest for a contract template.
 *
 * Writes a plain-text manifest of a clause-composed template in DOCUMENT ORDER:
 *   - every section: number, key, heading, sort, optional flag, guidance;
 *   - every clause under it: key, sort, condition (verbatim JSON), clause type,
 *     optional/subitem flags, and the FULL body verbatim;
 *   - every field attached to a clause: key, label, control type (input_kind +
 *     format_type), options, placeholder, helper/guidance, tooltip, required,
 *     which party may set it (owner_role), and which clauses it GATES.
 *
 * Hidden branches are included — every conditional clause and every field is
 * listed regardless of any selection, each marked with its gating condition, so
 * every selection's output is visible. No truncation, no ellipses.
 *
 * This reads the live def tables (contract_section_defs / _clause_defs /
 * _field_defs); it is READ-ONLY. Connection: DATABASE_URL, else the first line of
 * .env.db — the same convention as scripts/gen-db-schema.mjs.
 *
 * Usage:
 *   node scripts/export-template-manifest.mjs <TEMPLATE_KEY> [outfile]
 *   node scripts/export-template-manifest.mjs HORSE_SALE_V3 docs/manifests/sale.txt
 * With no outfile the manifest is written to stdout.
 *
 * NOTE ON PLACEHOLDERS: input placeholders are not stored in the field def — they
 * are constants in the React controls (components/app/ContractCascade.tsx), keyed
 * by format_type. This script prints the placeholder the UI uses for a field's
 * format where that placeholder is a fixed constant, and prints
 * "(UI-derived; see ContractCascade.tsx)" where it varies at render time. The
 * tooltip/helper is the field's `guidance`; for imported HORSE.* and party tokens
 * the tooltip is additionally the import-source line ("Changes to this information
 * must be made on … record"), noted inline.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function connectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return readFileSync(resolve(ROOT, '.env.db'), 'utf8').split('\n')[0].trim();
}

/** Run one SQL statement and parse its single-row JSON result. */
function queryJson(sql) {
  const out = execFileSync('psql', [connectionString(), '-tAX', '-c', sql], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
    env: { ...process.env, PGCLIENTENCODING: 'UTF8' },
  });
  const trimmed = out.trim();
  return trimmed ? JSON.parse(trimmed) : null;
}

// Fixed per-format placeholders, mirroring the controls in ContractCascade.tsx.
// Where a format's placeholder is composed at render time (e.g. from a label),
// the value is the sentinel below and the manifest prints the UI-derived note.
const UI_DERIVED = '(UI-derived at render time; see components/app/ContractCascade.tsx)';
const FORMAT_PLACEHOLDER = {
  party: 'Select the responsible party',
  contact: 'Name / Company / Street address / City / State / ZIP / Phone / Email / Website',
  person: 'Contact name / Company / Phone / Email',
  address: 'Street / City / State / ZIP',
  location: 'Location name + address',
  share_amount: '$ amount or %',
  cost_split: UI_DERIVED,
  pair: UI_DERIVED,
  fee_schedule: UI_DERIVED,
  med_schedule: 'Name / Dose / Schedule / responsible party (per entry)',
  installment_schedule: 'Amount / Due / Notes (per row)',
  incident_list: 'Category / date range / detail (per row)',
  contacts_list: 'First / Last / Phone / Email (per row)',
  reveal_text: 'Yes/No → free text',
  certify: '(checkbox; label is the certification statement)',
  yesno: '(Yes / No buttons)',
  add_text: '"+ Add …" → free text',
  initials: 'Initials (typed; must match the signing party’s initials)',
};

/** control-type description from input_kind + format_type. */
function controlType(f) {
  const kind = f.input_kind || 'text';
  const fmt = f.format_type || '';
  if (fmt && fmt !== kind) return `${kind} / ${fmt}`;
  return kind;
}

/** placeholder for a field, from its format (UI-side constants). */
function placeholderFor(f) {
  const fmt = f.format_type || '';
  if (fmt && FORMAT_PLACEHOLDER[fmt] !== undefined) return FORMAT_PLACEHOLDER[fmt];
  // free-text / select placeholders are UI constants not tied to the def
  return UI_DERIVED;
}

/** tooltip for a field — guidance is the ⓘ popover; imported tokens add a
 *  source line, noted here (the exact text is composed in the UI). */
function tooltipFor(f) {
  const parts = [];
  if (f.guidance) parts.push(f.guidance);
  if (/^HORSE\./.test(f.field_key)) {
    parts.push('[imported — tooltip also says: "Changes to this information must be made on the horse\'s record on the Horses page."]');
  } else if (/^(LESSOR|LESSEE|BUYER|SELLER|PARTY)\./.test(f.field_key)) {
    parts.push('[imported — tooltip also says: "Changes to this information must be made on that party\'s account on the Contacts page."]');
  }
  return parts.length ? parts.join(' ') : '(none)';
}

/** every field_key referenced by a condition (flattened across all/any). */
function conditionFieldKeys(cond, acc = new Set()) {
  if (!cond || typeof cond !== 'object') return acc;
  if (Array.isArray(cond.all)) cond.all.forEach((c) => conditionFieldKeys(c, acc));
  if (Array.isArray(cond.any)) cond.any.forEach((c) => conditionFieldKeys(c, acc));
  if (cond.field_key) acc.add(cond.field_key);
  return acc;
}

function hr(ch = '─', n = 78) { return ch.repeat(n); }
function indent(text, pad) {
  return String(text).split('\n').map((l) => pad + l).join('\n');
}

function buildManifest(templateKey) {
  const tpl = queryJson(
    `SELECT coalesce(row_to_json(t), 'null'::json) FROM (
       SELECT template_key, title, version, active, contract_kind
       FROM contract_templates WHERE template_key = ${lit(templateKey)}
     ) t;`,
  );
  if (!tpl) throw new Error(`template not found: ${templateKey}`);

  const sections = queryJson(
    `SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.sort_order), '[]'::jsonb)
       FROM (SELECT section_key, heading, sort_order, is_optional, cut_name, guidance
             FROM contract_section_defs WHERE template_key = ${lit(templateKey)}) s;`,
  ) || [];
  const clauses = queryJson(
    `SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.section_key, c.sort_order), '[]'::jsonb)
       FROM (SELECT section_key, clause_key, heading, body, clause_type, sort_order,
                    is_optional, render_as_subitem, cut_name, conditional_on, guidance
             FROM contract_clause_defs WHERE template_key = ${lit(templateKey)}) c;`,
  ) || [];
  const fields = queryJson(
    `SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.clause_key, f.sort_order), '[]'::jsonb)
       FROM (SELECT field_key, label, section, clause_key, parent_field_key, owner_role,
                    input_kind, value_type, format_type, options, conditional_on,
                    guidance, required, is_optional, responsibility_kind, default_value, sort_order
             FROM contract_field_defs WHERE template_key = ${lit(templateKey)}) f;`,
  ) || [];

  // index: clauses a given field gates
  const gatedBy = new Map(); // field_key -> [clause_key...]
  for (const c of clauses) {
    for (const fk of conditionFieldKeys(c.conditional_on)) {
      if (!gatedBy.has(fk)) gatedBy.set(fk, []);
      gatedBy.get(fk).push(`${c.clause_key} (sort ${c.sort_order})`);
    }
  }
  // fields grouped by clause_key (a field attaches to its clause)
  const fieldsByClause = new Map();
  for (const f of fields) {
    const k = f.clause_key || '(no clause)';
    if (!fieldsByClause.has(k)) fieldsByClause.set(k, []);
    fieldsByClause.get(k).push(f);
  }

  const L = [];
  L.push(hr('═'));
  L.push(`EDITOR MANIFEST — ${templateKey}`);
  L.push(`Title: ${tpl.title}   ·   version: ${tpl.version}   ·   active: ${tpl.active}   ·   kind: ${tpl.contract_kind ?? '(none)'}`);
  L.push(`Generated: ${new Date().toISOString()}`);
  L.push('Document order. Hidden branches included and marked. No truncation.');
  L.push(hr('═'));
  L.push('');

  const sortedSections = [...sections].sort((a, b) => a.sort_order - b.sort_order);
  let secNo = 0;
  for (const s of sortedSections) {
    secNo += 1;
    L.push(hr('━'));
    L.push(`SECTION ${secNo} — [${s.section_key}]  ${s.heading}`);
    L.push(`  sort: ${s.sort_order}   optional-section: ${s.is_optional}${s.cut_name ? `   cut: ${s.cut_name}` : ''}`);
    if (s.guidance) L.push(`  section guidance: ${s.guidance}`);
    L.push(hr('━'));

    const secClauses = clauses
      .filter((c) => c.section_key === s.section_key)
      .sort((a, b) => a.sort_order - b.sort_order);

    if (secClauses.length === 0) L.push('  (no clauses)');

    for (const c of secClauses) {
      L.push('');
      L.push(`  CLAUSE [${c.clause_key}]  (sort ${c.sort_order}, type ${c.clause_type}${c.is_optional ? ', optional' : ''}${c.render_as_subitem ? ', subitem' : ''})`);
      if (c.heading) L.push(`    heading: ${c.heading}`);
      L.push(`    condition: ${c.conditional_on ? JSON.stringify(c.conditional_on) : '(none — always shown)'}`);
      if (c.cut_name) L.push(`    cut: ${c.cut_name}`);
      if (c.guidance) L.push(`    clause guidance: ${c.guidance}`);
      L.push('    body:');
      L.push(indent(c.body ?? '(empty body — input carrier only)', '      | '));

      const cf = fieldsByClause.get(c.clause_key) || [];
      if (cf.length) {
        L.push('    fields on this clause:');
        for (const f of cf) {
          L.push(`      ● FIELD [${f.field_key}]  "${f.label}"`);
          L.push(`          control: ${controlType(f)}   value_type: ${f.value_type}`);
          L.push(`          required: ${f.required}   optional: ${f.is_optional}   set-by (owner_role): ${f.owner_role}${f.responsibility_kind ? `   responsibility_kind: ${f.responsibility_kind}` : ''}`);
          L.push(`          options: ${f.options ? JSON.stringify(f.options) : '(none)'}`);
          if (f.default_value) L.push(`          default: ${f.default_value}`);
          L.push(`          placeholder: ${placeholderFor(f)}`);
          L.push(`          helper (guidance): ${f.guidance ?? '(none)'}`);
          L.push(`          tooltip: ${tooltipFor(f)}`);
          L.push(`          own condition (when this field itself is shown): ${f.conditional_on ? JSON.stringify(f.conditional_on) : '(none)'}`);
          const gates = gatedBy.get(f.field_key) || [];
          L.push(`          gates clauses: ${gates.length ? gates.join(', ') : '(none)'}`);
        }
      }
    }
    L.push('');
  }

  // Any fields not attached to a clause in this template (should be none, but
  // listed so nothing is invisible).
  const orphan = fields.filter((f) => !f.clause_key || !clauses.some((c) => c.clause_key === f.clause_key));
  if (orphan.length) {
    L.push(hr('━'));
    L.push('FIELDS NOT ATTACHED TO A LISTED CLAUSE (shown so nothing is hidden):');
    L.push(hr('━'));
    for (const f of orphan) {
      L.push(`  ● FIELD [${f.field_key}]  "${f.label}"  (clause_key: ${f.clause_key ?? '(null)'})`);
      L.push(`      control: ${controlType(f)}   required: ${f.required}   set-by: ${f.owner_role}`);
      L.push(`      options: ${f.options ? JSON.stringify(f.options) : '(none)'}`);
      L.push(`      helper: ${f.guidance ?? '(none)'}`);
      const gates = gatedBy.get(f.field_key) || [];
      L.push(`      gates clauses: ${gates.length ? gates.join(', ') : '(none)'}`);
    }
    L.push('');
  }

  // Selector index: every field that gates at least one clause, with the full set.
  L.push(hr('━'));
  L.push('SELECTOR INDEX — every field that gates one or more clauses');
  L.push(hr('━'));
  const selectorKeys = [...gatedBy.keys()].sort();
  for (const fk of selectorKeys) {
    const f = fields.find((x) => x.field_key === fk);
    const req = f ? `required: ${f.required}` : 'required: (no field def — e.g. a SYSTEM-derived or party token)';
    L.push(`  [${fk}]  ${req}`);
    L.push(`      gates: ${gatedBy.get(fk).join(', ')}`);
  }
  L.push('');
  L.push(hr('═'));
  L.push('END OF MANIFEST');
  L.push(hr('═'));
  return L.join('\n');
}

/** SQL string literal (single-quote escape). */
function lit(s) { return `'${String(s).replace(/'/g, "''")}'`; }

// ── main ──
const templateKey = process.argv[2];
const outfile = process.argv[3];
if (!templateKey) {
  console.error('usage: node scripts/export-template-manifest.mjs <TEMPLATE_KEY> [outfile]');
  process.exit(1);
}
const manifest = buildManifest(templateKey);
if (outfile) {
  const abs = resolve(ROOT, outfile);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, manifest + '\n', 'utf8');
  console.error(`wrote ${abs} (${manifest.length} chars)`);
} else {
  process.stdout.write(manifest + '\n');
}
