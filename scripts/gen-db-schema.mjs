#!/usr/bin/env node
/**
 * Generate docs/reference/DB-SCHEMA.md from the live database: every table,
 * its columns, and (where present) the table/column comments as the "what it
 * is for" text. Replaces the 972-file migration journal as the day-to-day
 * schema reference (D30 — the journal is archived history, not a live spec).
 *
 * Usage: node scripts/gen-db-schema.mjs
 * Connection: DATABASE_URL, else first line of .env.db.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'docs/reference/DB-SCHEMA.md');

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

const tables = q(`select json_agg(t) from (
  select c.relname as table_name,
         obj_description(c.oid, 'pg_class') as table_comment
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r','p')
   order by c.relname) t`);

const columns = q(`select json_agg(t) from (
  select c.table_name, c.column_name, c.data_type, c.is_nullable, c.column_default,
         col_description(format('%I.%I', c.table_schema, c.table_name)::regclass::oid,
                          c.ordinal_position) as column_comment
    from information_schema.columns c
   where c.table_schema = 'public'
   order by c.table_name, c.ordinal_position) t`);

const pks = q(`select json_agg(t) from (
  select tc.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
   where tc.constraint_type = 'PRIMARY KEY' and tc.table_schema = 'public') t`);

const fks = q(`select json_agg(t) from (
  select tc.table_name, kcu.column_name, ccu.table_name as foreign_table,
         ccu.column_name as foreign_column
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
   where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public') t`);

const rowCounts = q(`select json_agg(t) from (
  select relname as table_name, n_live_tup as row_count
    from pg_stat_user_tables) t`);

const byTable = {};
for (const c of columns) (byTable[c.table_name] ??= []).push(c);
const pkByTable = {};
for (const p of pks) (pkByTable[p.table_name] ??= new Set()).add(p.column_name);
const fkByTable = {};
for (const f of fks) (fkByTable[f.table_name] ??= []).push(f);
const rowsByTable = {};
for (const r of rowCounts) rowsByTable[r.table_name] = r.row_count;

const now = new Date().toISOString().slice(0, 10);
const out = [];
out.push('# DB SCHEMA — generated from the live database');
out.push('');
out.push(`**Generated ${now}. Regenerate with:**`);
out.push('```');
out.push('node scripts/gen-db-schema.mjs');
out.push('```');
out.push('');
out.push(`Replaces the 972-file migration journal as the day-to-day schema reference (D30 —`);
out.push('the journal is archived history at `supabase/migrations-archive/`, kept for audit,');
out.push('not read to understand current shape). Table/column comments below are `pg_catalog`');
out.push('`COMMENT ON` text where a migration set one; most do not have one yet.');
out.push('');
out.push(`**${tables.length} tables.**`);
out.push('');
out.push('---');
out.push('');

for (const t of tables) {
  const cols = byTable[t.table_name] ?? [];
  const pkSet = pkByTable[t.table_name] ?? new Set();
  const rowCount = rowsByTable[t.table_name];
  out.push(`## ${t.table_name}`);
  if (t.table_comment) out.push('', t.table_comment);
  out.push('', `Rows (estimate): ${rowCount ?? 0}`, '');
  out.push('| column | type | nullable | default | comment |');
  out.push('|---|---|---|---|---|');
  for (const c of cols) {
    const fk = (fkByTable[t.table_name] ?? []).find((f) => f.column_name === c.column_name);
    const namePart = pkSet.has(c.column_name) ? `**${c.column_name}** (PK)` : c.column_name;
    const nameWithFk = fk ? `${namePart} → ${fk.foreign_table}.${fk.foreign_column}` : namePart;
    const def = (c.column_default ?? '').replace(/\|/g, '\\|').slice(0, 40);
    const comment = (c.column_comment ?? '').replace(/\|/g, '\\|');
    out.push(`| ${nameWithFk} | ${c.data_type} | ${c.is_nullable} | ${def} | ${comment} |`);
  }
  out.push('');
}

writeFileSync(OUT, out.join('\n') + '\n');
console.log(`wrote ${OUT} (${tables.length} tables)`);
