/**
 * Parse the client intake + company engagement forms into structured field
 * schemas and emit the form_definitions seed migration.
 *
 *   node scripts/build-form-definitions-migration.mjs            # write migration
 *   node scripts/build-form-definitions-migration.mjs --preview  # print JSON, no write
 *
 * The source .md forms are the editable truth; this derives a data-driven schema
 * (sections → fields, with type inference + checkbox groups) so the IntakeBuilder
 * / EngagementWizard can render them. Company-form flat tokens are migrated to the
 * namespaced scheme ({{ENGAGEMENT_ID}}→{{ENG.ID}}, {{UUID}}→{{DOC.UUID}}, …).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS = resolve(HERE, '../build_instructions_phase_2/Documents/Forms');
const OUT = resolve(HERE, '../supabase/migrations/20260629120000_form_definitions.sql');

const SOURCES = [
  { dir: resolve(DOCS, 'Client/Intake Forms'), audience: 'CLIENT', prefix: 'Intake Form - ', key: 'INTAKE' },
  { dir: resolve(DOCS, 'Company/Engagement Intake'), audience: 'COMPANY', prefix: 'Engagement Form - ', key: 'ENGAGEMENT' },
];

// Flat → namespaced token migration for company forms (RECONCILIATION_SPEC C1).
const TOKEN_MAP = {
  ENGAGEMENT_ID: '{{ENG.ID}}', UUID: '{{DOC.UUID}}', DOCUMENT_UUID: '{{DOC.UUID}}',
  CREATED_DATE: '{{DOC.GENERATED_DATE}}', DATE_CREATED: '{{DOC.GENERATED_DATE}}',
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const isHeading = (l) => /^[A-Z0-9][A-Z0-9 &/()'’.-]*$/.test(l) && !l.endsWith(':') && l.split(' ').length <= 7;
const titleCase = (s) => s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

function inferType(label) {
  if (/signature/i.test(label)) return 'signature';
  if (/price|budget|fee|deposit|\$|commission|amount|compensation/i.test(label)) return 'currency';
  if (/\bdate\b|timeline|closing/i.test(label)) return 'date';
  if (/email/i.test(label)) return 'email';
  if (/phone/i.test(label)) return 'phone';
  return 'text';
}

function parseForm(text) {
  const lines = text.split('\n').map((l) => l.trim());
  const sections = [];
  let section = null;
  let group = null; // open checkbox group
  let title = null;
  let purpose = null;

  const ensureSection = () => {
    if (!section) { section = { heading: 'General', fields: [] }; sections.push(section); }
    return section;
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    if (l === 'FRENCH HERITAGE EQUESTRIAN' || l === 'INTERNAL USE ONLY') continue;
    if (!title) { title = titleCase(l); continue; }
    if (/^Purpose:/i.test(l)) { purpose = l.replace(/^Purpose:\s*/i, '') || lines[++i] || null; continue; }

    // checkbox option
    const cb = l.match(/^[□☐]\s*(.*)$/);
    if (cb) {
      const opt = cb[1].trim();
      ensureSection();
      if (group) { group.options.push(opt); continue; }
      const last = section.fields[section.fields.length - 1];
      if (last && last.type === 'text' && last._bare) {
        last.type = 'checkbox'; last.options = [opt]; delete last._bare; group = last;
      } else {
        group = { key: slug(section.heading), label: titleCase(section.heading), type: 'checkbox', options: [opt] };
        section.fields.push(group);
      }
      continue;
    }
    group = null;

    // bare flat token line → value placeholder for the previous field
    const tok = l.match(/^\{\{([A-Z_]+)\}\}$/);
    if (tok) {
      ensureSection();
      const last = section.fields[section.fields.length - 1];
      const mapped = TOKEN_MAP[tok[1]];
      if (last) {
        last.type = 'system';
        if (mapped) last.token = mapped; else last.note = `system id (${tok[1]})`;
      }
      continue;
    }

    // section heading
    if (isHeading(l)) { section = { heading: l, fields: [] }; sections.push(section); group = null; continue; }

    // field "Label:" (optionally with trailing inline marker like $)
    const fld = l.match(/^(.+?):\s*(.*)$/);
    if (fld) {
      ensureSection();
      const label = fld[1].trim();
      const field = { key: slug(label), label, type: inferType(label) };
      if (field.type === 'text') field._bare = true; // may become a checkbox group
      section.fields.push(field);
      continue;
    }
    // free-standing prose (e.g. acknowledgment text) — skip as non-field
  }

  // strip the _bare marker
  for (const s of sections) for (const f of s.fields) delete f._bare;
  return { title, purpose, sections };
}

const out = [];
for (const src of SOURCES) {
  const files = readdirSync(src.dir).filter((f) => f.endsWith('.md')).sort();
  for (const file of files) {
    const name = basename(file, '.md').replace(src.prefix, '');
    const formKey = `${src.key}_${slug(name).toUpperCase()}`;
    const parsed = parseForm(readFileSync(resolve(src.dir, file), 'utf8'));
    out.push({ formKey, audience: src.audience, sourceName: name, ...parsed });
  }
}

if (process.argv.includes('--preview')) {
  console.log(JSON.stringify(out.slice(0, 2), null, 2));
  console.log(`\n--- ${out.length} forms parsed ---`);
  for (const f of out) {
    const nFields = f.sections.reduce((n, s) => n + s.fields.length, 0);
    console.log(`${f.formKey}: ${f.sections.length} sections, ${nFields} fields`);
  }
  process.exit(0);
}

let sql = `/*
  # FHE CRM — Form Definitions (migration 19)

  GENERATED by scripts/build-form-definitions-migration.mjs from the client intake
  and company engagement forms under build_instructions_phase_2/Documents/Forms/.
  Re-run the generator after editing a source form.

  form_definitions is the data-driven schema for the IntakeBuilder / EngagementWizard:
  one row per form, with its sections → fields (type-inferred, checkbox groups
  expanded) as JSONB. Company-form flat tokens are migrated to the namespaced scheme.
*/

CREATE TABLE IF NOT EXISTS form_definitions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_key     text UNIQUE NOT NULL,
  audience     text NOT NULL CHECK (audience IN ('CLIENT','COMPANY')),
  title        text NOT NULL,
  purpose      text,
  schema       jsonb NOT NULL,              -- { sections: [ { heading, fields: [...] } ] }
  version      integer NOT NULL DEFAULT 1,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS form_definitions_set_updated_at ON form_definitions;
CREATE TRIGGER form_definitions_set_updated_at BEFORE UPDATE ON form_definitions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE form_definitions ENABLE ROW LEVEL SECURITY;

-- Authenticated staff read; admin writes. (Intake forms are rendered to clients
-- through the app layer, not by direct table reads.)
DROP POLICY IF EXISTS form_definitions_read ON form_definitions;
CREATE POLICY form_definitions_read ON form_definitions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS form_definitions_admin_write ON form_definitions;
CREATE POLICY form_definitions_admin_write ON form_definitions
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

`;

for (const f of out) {
  const schema = JSON.stringify({ sections: f.sections }).replace(/'/g, "''");
  const title = (f.title || f.sourceName).replace(/'/g, "''");
  const purpose = f.purpose ? `'${f.purpose.replace(/'/g, "''")}'` : 'NULL';
  sql += `INSERT INTO form_definitions (form_key, audience, title, purpose, schema) VALUES\n`;
  sql += `  ('${f.formKey}', '${f.audience}', '${title}', ${purpose}, '${schema}'::jsonb)\n`;
  sql += `  ON CONFLICT (form_key) DO UPDATE SET audience = EXCLUDED.audience, title = EXCLUDED.title,\n`;
  sql += `    purpose = EXCLUDED.purpose, schema = EXCLUDED.schema, updated_at = now();\n`;
}

writeFileSync(OUT, sql);
console.log(`wrote ${OUT} (${out.length} forms)`);
