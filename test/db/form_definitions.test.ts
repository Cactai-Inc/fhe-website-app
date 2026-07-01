/**
 * Phase 2/3 — form_definitions (migration 19).
 *
 * The 15 client intake + 12 company engagement forms, parsed into data-driven
 * field schemas. Verifies the seed loaded, the schema shape is sound, types are
 * from the allowed set, checkbox groups carry options, and company-form flat
 * tokens were migrated to the namespaced scheme (no {{ENGAGEMENT_ID}} survivors).
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

const TYPES = new Set(['text', 'phone', 'email', 'currency', 'date', 'signature', 'checkbox', 'system']);

type Field = { key: string; label: string; type: string; options?: string[]; token?: string; note?: string };
type Schema = { sections: { heading: string; fields: Field[] }[] };

let h: TestDb;
let rows: { form_key: string; audience: string; title: string; schema: Schema }[];

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  rows = await h.q(`select form_key, audience, title, schema from form_definitions order by form_key`);
});
afterAll(async () => {
  await h?.close();
});

const fields = (s: Schema) => s.sections.flatMap((sec) => sec.fields);

describe('form_definitions seed', () => {
  it('loads 15 client intake + 12 company engagement forms', () => {
    expect(rows.length).toBe(27);
    expect(rows.filter((r) => r.audience === 'CLIENT').length).toBe(15);
    expect(rows.filter((r) => r.audience === 'COMPANY').length).toBe(12);
  });

  it('every form has sections and fields', () => {
    for (const r of rows) {
      expect(r.schema.sections.length, r.form_key).toBeGreaterThan(0);
      expect(fields(r.schema).length, r.form_key).toBeGreaterThan(0);
    }
  });

  it('every field has a key, label, and an allowed type', () => {
    for (const r of rows) {
      for (const f of fields(r.schema)) {
        expect(f.key, `${r.form_key} field key`).toBeTruthy();
        expect(f.label, `${r.form_key} field label`).toBeTruthy();
        expect(TYPES.has(f.type), `${r.form_key}.${f.key} type=${f.type}`).toBe(true);
      }
    }
  });

  it('checkbox fields carry options', () => {
    for (const r of rows) {
      for (const f of fields(r.schema)) {
        if (f.type === 'checkbox') expect(f.options?.length, `${r.form_key}.${f.key}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('token migration (company forms)', () => {
  it('no flat tokens survive anywhere in the schemas', () => {
    for (const r of rows) {
      const blob = JSON.stringify(r.schema);
      expect(blob, r.form_key).not.toMatch(/\{\{(ENGAGEMENT_ID|UUID|DOCUMENT_UUID|CREATED_DATE|DATE_CREATED)\}\}/);
    }
  });

  it('engagement-id system fields use the namespaced {{ENG.ID}} token', () => {
    const eng = rows.find((r) => r.form_key === 'ENGAGEMENT_HORSE_PURCHASE')!;
    const sys = fields(eng.schema).filter((f) => f.type === 'system');
    expect(sys.some((f) => f.token === '{{ENG.ID}}')).toBe(true);
    expect(sys.some((f) => f.token === '{{DOC.UUID}}')).toBe(true);
    // CLIENT_ID has no dictionary token → kept as a system-id note, never a flat token
    expect(sys.some((f) => /CLIENT_ID/.test(f.note ?? ''))).toBe(true);
  });
});

describe('parse fidelity (spot checks)', () => {
  it('captures the purchase intake discipline checkboxes', () => {
    const intake = rows.find((r) => r.form_key === 'INTAKE_HORSE_PURCHASE')!;
    const all = fields(intake.schema);
    const disc = all.find((f) => f.type === 'checkbox' && f.options?.includes('Hunters'));
    expect(disc, 'discipline checkbox group').toBeTruthy();
    expect(disc!.options).toEqual(expect.arrayContaining(['Jumpers', 'Dressage', 'Eventing']));
    // financial fields inferred as currency
    expect(all.some((f) => f.key === 'target_budget' && f.type === 'currency')).toBe(true);
  });
});
