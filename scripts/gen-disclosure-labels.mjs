// gen-disclosure-labels.mjs — write shared/disclosureFieldLabels.js from the DB (disclosure_section_spec, the single source), so the frontend reads a generated copy, never an independent one. Run after any change to the spec; check-disclosure-labels.mjs fails a gate when the committed file is stale. Usage: node scripts/gen-disclosure-labels.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'shared/disclosureFieldLabels.js');
const SECTIONS = ['KNOWN_CONDITIONS', 'MEDICAL_HISTORY', 'BEHAVIORAL_HISTORY', 'INJURIES_TO_HORSE', 'MEDICATIONS', 'SUPPLEMENTS'];

export function connectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    return readFileSync(resolve(ROOT, '.env.db'), 'utf8').split('\n')[0].trim();
  } catch {
    console.error('No DATABASE_URL and no .env.db — cannot reach the database.');
    process.exit(2);
  }
}

/** The labels per section, in order, straight from disclosure_section_spec. */
export function labelsFromDb() {
  const json = execFileSync('psql', [connectionString(), '-tAX', '-c',
    `SELECT coalesce(jsonb_object_agg(section, labels),'{}'::jsonb) FROM (
       SELECT sec AS section, jsonb_agg(s.label ORDER BY s.ord) AS labels
       FROM unnest(ARRAY['${SECTIONS.join("','")}']) sec,
            LATERAL disclosure_section_spec(sec) WITH ORDINALITY AS s(k,label,kind,ord)
       GROUP BY sec) q;`,
  ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, PGCLIENTENCODING: 'UTF8' } }).trim();
  return JSON.parse(json);
}

/** The committed file's literal content (so gen and check agree byte-for-byte). */
export function fileContent(labels) {
  const body = SECTIONS
    .filter((s) => labels[s])
    .map((s) => `  ${s}: ${JSON.stringify(labels[s])},`)
    .join('\n');
  return `// GENERATED from the DB by scripts/gen-disclosure-labels.mjs — do not edit by hand.
// The single source is disclosure_section_spec(); check-disclosure-labels.mjs fails a
// gate when this file drifts from it. The frontend (src/lib/disclosureMarker.ts) reads
// these labels; the sample script reads the DB directly.
export const DISCLOSURE_FIELD_LABELS = {
${body}
};
`;
}

// Run directly (not when imported by the check) → (re)write the file.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const content = fileContent(labelsFromDb());
  writeFileSync(OUT, content);
  console.error(`wrote ${OUT}`);
}
