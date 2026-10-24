// check-disclosure-labels.mjs — CI guard: fail when the committed shared/disclosureFieldLabels.js differs from what disclosure_section_spec() in the DB would generate. Keeps the frontend's label copy from drifting off the single DB source. Exit 0 = in sync, 1 = drift (regenerate with gen-disclosure-labels.mjs), 2 = no DB. Usage: node scripts/check-disclosure-labels.mjs
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { labelsFromDb, fileContent } from './gen-disclosure-labels.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(ROOT, 'shared/disclosureFieldLabels.js');

const expected = fileContent(labelsFromDb());
let actual;
try {
  actual = readFileSync(FILE, 'utf8');
} catch {
  console.error(`missing ${FILE} — run: node scripts/gen-disclosure-labels.mjs`);
  process.exit(1);
}
if (actual === expected) {
  console.error('disclosure labels in sync with disclosure_section_spec().');
  process.exit(0);
}
console.error('shared/disclosureFieldLabels.js is STALE vs disclosure_section_spec().');
console.error('Regenerate it: node scripts/gen-disclosure-labels.mjs');
process.exit(1);
