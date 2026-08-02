#!/usr/bin/env node
/**
 * Generate the HORSE_LEASE_V2 template extract from the live database —
 * docs/contract-exports/HORSE_LEASE_V2_EXTRACT_<date>.md.
 *
 * Committed version of the one-off script the 2026-08-02 remediation run used
 * (that run's script was never committed; format re-derived from its output).
 * Reads contract_section_defs / contract_clause_defs / contract_field_defs
 * only. One fix over the prior run's renderer: `contains` and `gte` gates now
 * print truthfully ("KEY contains X", "KEY >= N") instead of as an empty
 * "KEY = " (the extract-generator bug flagged by manifest M26).
 *
 * Usage: node scripts/build-lease-extract.mjs [TEMPLATE_KEY] [OUT_FILE]
 * Connection: DATABASE_URL, else first line of .env.db.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TKEY = process.argv[2] ?? 'HORSE_LEASE_V2';

function connectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return readFileSync(resolve(ROOT, '.env.db'), 'utf8').split('\n')[0].trim();
}

function q(sql) {
  const out = execFileSync('psql', [connectionString(), '-tA', '-c', sql], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  }).trim();
  return out ? JSON.parse(out) : [];
}

const sections = q(`select json_agg(t) from (
  select section_key, heading, sort_order from contract_section_defs
   where template_key='${TKEY}' order by sort_order) t`);
const clauses = q(`select json_agg(t) from (
  select section_key, clause_key, heading, body, clause_type, sort_order, conditional_on
    from contract_clause_defs where template_key='${TKEY}' order by sort_order) t`);
const fields = q(`select json_agg(t) from (
  select field_key, label, section, owner_role, input_kind, options, conditional_on,
         required, guidance, clause_key, sort_order
    from contract_field_defs where template_key='${TKEY}' order by sort_order) t`);

/** Render a gate the way the extract legend promises. */
function gate(c) {
  if (!c) return null;
  if (c.all) return c.all.map(gate).join(' AND ');
  if (c.any) {
    const parts = c.any.map(gate);
    return parts.length === 1 ? `(${parts[0]})` : `(${parts.join(' OR ')})`;
  }
  if (c.equals) {
    const vals = c.equals.map((v) => (v === '' ? '(empty)' : v)).join(' or ');
    return `${c.field_key} = ${vals}`;
  }
  if (c.contains) {
    return `${c.field_key} contains ${c.contains.join(' or ')}`;
  }
  if (c.gte !== undefined) return `${c.field_key} >= ${c.gte}`;
  return JSON.stringify(c);
}

const now = new Date();
const stamp = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
const migHead = execFileSync('bash', ['-c', `ls ${ROOT}/supabase/migrations | sort | tail -1`], { encoding: 'utf8' }).trim();

const out = [];
out.push(`# ${TKEY} — full template extract`, '');
out.push(`Generated ${stamp} from the live database (project \`lrstswfxfsezdmvkvukc\`),`);
out.push(`reflecting migration head \`${migHead}\`.`, '');
out.push('Every section, clause, field, option list, helper text and conditional in the');
out.push('live lease template, in render order.', '');
out.push('Legend:');
out.push('  **CONDITIONAL** — appears only when the stated expression is true.');
out.push('  *(info)* — the text behind that item\'s info button.');
out.push('  `{{TOKEN}}` — an input rendered inline in the clause prose.');
out.push('  Fields list their input kind, and their choices where they have a fixed set.');
out.push('', '---', '');

let n = 0;
for (const s of sections) {
  n += 1;
  out.push(`## ${n}. ${s.heading}`, '', `\`${s.section_key}\``, '');
  const secClauses = clauses.filter((c) => c.section_key === s.section_key);
  for (const c of secClauses) {
    const short = c.clause_key.includes('.') ? c.clause_key.split('.').slice(1).join('.') : c.clause_key;
    out.push(c.heading ? `### ${c.heading}` : `### ${short} *(no heading set)*`, '');
    out.push(`\`${c.clause_key}\``, '');
    if (c.conditional_on) out.push(`**CONDITIONAL** — shows when: ${gate(c.conditional_on)}`, '');
    if (c.body) {
      for (const line of c.body.split('\n')) out.push(line.trim() === '' ? '>' : `> ${line}`);
      out.push('');
    }
    const clFields = fields.filter((f) => f.clause_key === c.clause_key);
    for (const f of clFields) {
      const bits = [`- **${f.label}** — \`${f.field_key}\` · input: ${f.input_kind}`];
      if (f.required) bits.push('required');
      bits.push(`owner: ${f.owner_role}`);
      out.push(bits.join(' · '));
      if (f.conditional_on) out.push(`    - **CONDITIONAL** — shows when: ${gate(f.conditional_on)}`);
      if (f.options) out.push(`    - choices: ${f.options.map((o) => o.label).join(', ')}`);
      if (f.guidance) out.push(`    - *(info)* ${f.guidance}`);
    }
    if (clFields.length) out.push('');
  }
}

const orphans = fields.filter((f) => !clauses.some((c) => c.clause_key === f.clause_key));
if (orphans.length) {
  out.push('## Fields not attached to any clause', '');
  for (const f of orphans) out.push(`- **${f.label}** — \`${f.field_key}\` · input: ${f.input_kind} · owner: ${f.owner_role} · clause_key: ${f.clause_key ?? '(none)'}`);
  out.push('');
}

const OUT = process.argv[3]
  ?? resolve(ROOT, `docs/contract-exports/${TKEY}_EXTRACT_${now.toISOString().slice(0, 10)}b.md`);
writeFileSync(OUT, out.join('\n') + '\n');
console.log(`wrote ${OUT} (${n} sections, ${clauses.length} clauses, ${fields.length} fields)`);
