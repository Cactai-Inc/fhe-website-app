#!/usr/bin/env node
/**
 * Generate docs/reference/DB-MAP.md from the live database: the RPC surface
 * (functions granted to authenticated/anon — the app's actual reach into the
 * database), the trigger spines (what fires on writes, per table), and which
 * client-side files call which RPC (cross-referenced against src/lib/api*.ts).
 *
 * "The functions that matter" means the reachable surface, not all 751
 * functions in the public schema — most of the rest are internal helpers
 * only other functions call.
 *
 * Usage: node scripts/gen-db-map.mjs
 * Connection: DATABASE_URL, else first line of .env.db.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'docs/reference/DB-MAP.md');

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

const rpcs = q(`select json_agg(t) from (
  select p.proname as name,
         pg_get_function_identity_arguments(p.oid) as args,
         array_agg(distinct r.rolname order by r.rolname) as granted_to,
         obj_description(p.oid, 'pg_proc') as comment
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join information_schema.routine_privileges rp
      on rp.specific_schema = n.nspname and rp.routine_name = p.proname
    join pg_roles r on r.rolname = rp.grantee
   where n.nspname = 'public'
     and rp.grantee in ('authenticated','anon')
     and rp.privilege_type = 'EXECUTE'
   group by p.proname, p.oid
   order by p.proname) t`);

const triggers = q(`select json_agg(t) from (
  select c.relname as table_name, tg.tgname as trigger_name,
         p.proname as function_name,
         case when tg.tgtype & 2 > 0 then 'BEFORE' when tg.tgtype & 64 > 0 then 'INSTEAD OF' else 'AFTER' end as timing,
         case when tg.tgtype & 4 > 0 then 'INSERT'
              when tg.tgtype & 8 > 0 then 'DELETE'
              when tg.tgtype & 16 > 0 then 'UPDATE'
              else 'multi' end as event
    from pg_trigger tg
    join pg_class c on c.oid = tg.tgrelid
    join pg_proc p on p.oid = tg.tgfoid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and not tg.tgisinternal
   order by c.relname, tg.tgname) t`);

// cross-reference: which src/lib/api*.ts files call which RPC name via .rpc('name')
function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) { if (entry !== 'node_modules') walk(full, files); }
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

const srcFiles = [...walk(resolve(ROOT, 'src')), ...walk(resolve(ROOT, 'api'))];
const callers = {}; // rpcName -> Set of relative file paths
const rpcCallRe = /\.rpc\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
for (const f of srcFiles) {
  const content = readFileSync(f, 'utf8');
  let m;
  while ((m = rpcCallRe.exec(content))) {
    const name = m[1];
    const rel = f.replace(ROOT + '/', '');
    (callers[name] ??= new Set()).add(rel);
  }
}

const now = new Date().toISOString().slice(0, 10);
const out = [];
out.push('# DB MAP — the reachable RPC surface and the trigger spines');
out.push('');
out.push(`**Generated ${now}. Regenerate with:**`);
out.push('```');
out.push('node scripts/gen-db-map.mjs');
out.push('```');
out.push('');
out.push('Replaces the 972-file migration journal as the day-to-day "what writes what"');
out.push('reference (D30). Two parts: the RPC surface actually granted to `authenticated`');
out.push('or `anon` (the app\'s real reach into the database — most of the ~750 functions');
out.push('in the public schema are internal helpers only other functions call, and are not');
out.push('listed here), and the trigger spines (what fires automatically on a write). The');
out.push('"called from" column is a static grep for `.rpc(\'name\')` across `src/` and `api/`');
out.push('only -- a function may also be called from inside another SQL function (function-');
out.push('to-function calls are not traced here) or not be reachable yet at all. Absence in');
out.push('this column is a lead worth checking, not proof of dead code.');
out.push('');
out.push(`**${rpcs.length} granted RPCs · ${triggers.length} triggers.**`);
out.push('');
out.push('---');
out.push('');
out.push('## RPC surface');
out.push('');
out.push('| function | args | granted to | called from |');
out.push('|---|---|---|---|');
for (const r of rpcs) {
  const callerFiles = [...(callers[r.name] ?? [])].sort();
  const callerText = callerFiles.length
    ? callerFiles.map((c) => '`' + c + '`').join(', ')
    : '_no src/**/*.ts(x) caller found_';
  const args = (r.args || '').replace(/\|/g, '\\|').slice(0, 60);
  out.push(`| **${r.name}** | ${args} | ${r.granted_to.join(', ')} | ${callerText} |`);
}
out.push('');
out.push('---');
out.push('');
out.push('## Trigger spines — grouped by table');
out.push('');
let lastTable = null;
for (const t of triggers) {
  if (t.table_name !== lastTable) {
    out.push(`### ${t.table_name}`, '');
    out.push('| trigger | fires | function |');
    out.push('|---|---|---|');
    lastTable = t.table_name;
  }
  out.push(`| ${t.trigger_name} | ${t.timing} ${t.event} | ${t.function_name} |`);
}
out.push('');

writeFileSync(OUT, out.join('\n') + '\n');
console.log(`wrote ${OUT} (${rpcs.length} RPCs, ${triggers.length} triggers)`);
