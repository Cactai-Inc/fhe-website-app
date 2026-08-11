/**
 * TASK ONEAUTHOR — per-document-type surface configuration on contract_templates.
 *
 * The one authoring page decides which surfaces a document gets from DATA on its
 * template row, never from `if (template_key === …)`. This proves the data side of
 * that on a FRESH database, because a typecheck that passes says nothing about
 * whether a migration applies.
 *
 * The default harness loads the committed schema snapshot rather than replaying
 * the migration chain, and the snapshot predates this migration — so the test
 * applies the migration file ITSELF on top of it. That is the point: it exercises
 * the real file against the real current schema, catching exactly what a typecheck
 * cannot (a column that already exists, a constraint that cannot be added twice, a
 * function body that does not compile).
 *
 * Proves:
 *  - the migration applies to a fresh database, and applies AGAIN with no effect
 *    (idempotent — the repo's migrations are a hand-maintained journal, so a
 *    replay must not double-write or raise),
 *  - contract_template_structure returns the config on BOTH branches: the flat one
 *    (zero sections — the branch the page turns into a null structure) and the
 *    clause-composed one,
 *  - an UNKNOWN template_key gets the permissive default, so a lookup that finds
 *    nothing never reads as "this document has no drawers",
 *  - standard-form documents lose exactly the two surfaces they can never fill,
 *    and negotiated ones keep everything,
 *  - the companion pairing is a real FK, not a string that can name nothing,
 *  - contract_signing_set carries a per-row label, so a signing set never renders
 *    a step called "Document".
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestDb, MIGRATIONS_DIR, type TestDb } from './harness';

const MIGRATION = '20260811T1700_oneauthor_template_surface_config.sql';

/** A clause-composed template and a flat one — the two branches of the one page. */
const CLAUSE_KEY = 'HORSE_SALE_V2';
const FLAT_KEY = 'RELEASE_GENERAL';

interface Cfg {
  title: string | null;
  short_label: string | null;
  show_comments: boolean;
  show_change_requests: boolean;
  show_history: boolean;
  show_party_controls: boolean;
  allows_co_buyer: boolean;
  companion_template_key: string | null;
  companion_label: string | null;
}

let h: TestDb;

async function structure(key: string): Promise<{ config: Cfg; sections: unknown[] }> {
  const rows = await h.q<{ s: { config: Cfg; sections: unknown[] } }>(
    `select contract_template_structure($1) as s`, [key]);
  return rows[0].s;
}

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();

  const sql = readFileSync(join(MIGRATIONS_DIR, MIGRATION), 'utf8');
  // Applied TWICE on purpose: the second run is the replay-safety proof.
  await h.db.exec(sql);
  await h.db.exec(sql);
}, 600_000);

afterAll(async () => { await h.close(); });

describe('the migration lands on a fresh database', () => {
  it('adds every surface column', async () => {
    const cols = await h.q<{ column_name: string; column_default: string | null }>(
      `select column_name, column_default from information_schema.columns
        where table_schema='public' and table_name='contract_templates'
          and column_name in ('short_label','show_comments','show_change_requests',
                              'show_history','show_party_controls','allows_co_buyer',
                              'companion_template_key')
        order by column_name`);
    expect(cols.map((c) => c.column_name)).toEqual([
      'allows_co_buyer', 'companion_template_key', 'short_label', 'show_change_requests',
      'show_comments', 'show_history', 'show_party_controls',
    ]);
  });

  it('defaults every surface to SHOWN, so an unclassified template loses nothing', async () => {
    const rows = await h.q<{ column_name: string; column_default: string }>(
      `select column_name, column_default from information_schema.columns
        where table_schema='public' and table_name='contract_templates'
          and column_name like 'show_%'`);
    expect(rows).toHaveLength(4);
    for (const r of rows) expect(r.column_default).toBe('true');
  });

  it('applied twice, which is what a replay of the journal does', async () => {
    // beforeAll already ran it twice without raising. Confirm the second pass
    // did not duplicate the companion constraint or double-write a label.
    const cons = await h.q(
      `select 1 from pg_constraint where conname='contract_templates_companion_fkey'`);
    expect(cons).toHaveLength(1);
    const dupes = await h.q(
      `select template_key from contract_templates group by template_key having count(*) > 1`);
    expect(dupes).toHaveLength(0);
  });
});

describe('contract_template_structure returns the config on both branches', () => {
  it('flat template: zero sections AND a config', async () => {
    const s = await structure(FLAT_KEY);
    // Zero sections is what ContractPage turns into a null structure — the flat
    // branch. The config must still arrive, because that is the branch it decides
    // the most about.
    expect(s.sections).toHaveLength(0);
    expect(s.config.short_label).toBe('Visitor release');
    expect(s.config.show_change_requests).toBe(false);
    expect(s.config.show_party_controls).toBe(false);
    // …but a staff note and a status trail are possible on ANY document.
    expect(s.config.show_comments).toBe(true);
    expect(s.config.show_history).toBe(true);
  });

  it('clause-composed template: sections AND a config', async () => {
    const s = await structure(CLAUSE_KEY);
    expect(s.sections.length).toBeGreaterThan(0);
    expect(s.config.show_change_requests).toBe(true);
    expect(s.config.show_party_controls).toBe(true);
    expect(s.config.allows_co_buyer).toBe(true);
    expect(s.config.companion_template_key).toBe('HORSE_BILL_OF_SALE');
    expect(s.config.companion_label).toBe('Bill of sale');
  });

  it('unknown template_key gets the PERMISSIVE default, never a stripped page', async () => {
    const s = await structure('NO_SUCH_TEMPLATE_KEY');
    expect(s.sections).toHaveLength(0);
    expect(s.config.show_comments).toBe(true);
    expect(s.config.show_change_requests).toBe(true);
    expect(s.config.show_history).toBe(true);
    expect(s.config.show_party_controls).toBe(true);
    expect(s.config.allows_co_buyer).toBe(false);
    expect(s.config.companion_template_key).toBeNull();
  });

  it('the clause structure itself is unchanged — every existing caller still works', async () => {
    const s = await structure(CLAUSE_KEY);
    const first = s.sections[0] as Record<string, unknown>;
    expect(Object.keys(first).sort()).toEqual(
      ['clauses', 'guidance', 'heading', 'is_optional', 'section_key', 'sort_order']);
  });
});

describe('the classification is the standard-form / negotiated split', () => {
  it('every wall-gated (onboarding) document is standard-form', async () => {
    const rows = await h.q<{ template_key: string }>(
      `select template_key from contract_templates
        where wall_gating and (show_change_requests or show_party_controls)`);
    expect(rows).toEqual([]);
  });

  it('every clause-composed document stays fully negotiable', async () => {
    const rows = await h.q<{ template_key: string }>(
      `select t.template_key from contract_templates t
        where exists (select 1 from contract_section_defs s where s.template_key = t.template_key)
          and not (t.show_change_requests and t.show_party_controls)`);
    expect(rows).toEqual([]);
  });

  /* `short_label` is an OPTIONAL shorter override, not a registry every template
     must appear in. The enumerated seed gives concise names where a long title
     would crowd a step chip; everything else resolves through coalesce(…, title)
     at read time — which also means a title edited later flows straight through
     instead of going stale against a backfilled copy.
     Asserting on the stored column instead of the resolved value is what this
     test did first, and the harness caught it: the schema snapshot carries
     templates the seed list does not name (HORSE_EVALUATION, RIDER_LESSON,
     HORSE_TRAINING and others no longer in production). That is precisely the
     case a hardcoded enumeration must not break on. */
  it('resolves a name for EVERY template, including ones the seed list never heard of', async () => {
    const unnamed = await h.q<{ template_key: string }>(
      `select template_key from contract_templates
        where deleted_at is null
          and coalesce(nullif(trim(coalesce(short_label, title)), ''), '') = ''`);
    expect(unnamed).toEqual([]);
  });

  it('a template outside the seed list still gets a label out of the RPC', async () => {
    await h.q(
      `insert into contract_templates (template_key, title, party_namespaces)
       values ('ZZ_UNSEEDED_TEMPLATE', 'Some Later Agreement', '{CLIENT}')`);
    const s = await structure('ZZ_UNSEEDED_TEMPLATE');
    expect(s.config.short_label).toBe('Some Later Agreement');
    // …and it keeps every surface, because nothing classified it as standard-form.
    expect(s.config.show_change_requests).toBe(true);
    expect(s.config.show_party_controls).toBe(true);
    await h.q(`delete from contract_templates where template_key = 'ZZ_UNSEEDED_TEMPLATE'`);
  });
});

describe('the companion pairing is enforced, not merely stored', () => {
  it('refuses a companion key that names no template', async () => {
    await expect(h.q(
      `update contract_templates set companion_template_key = 'NOT_A_TEMPLATE'
        where template_key = $1`, [CLAUSE_KEY],
    )).rejects.toThrow(/foreign key|violates/i);
  });
});

describe('contract_signing_set carries each step its own name', () => {
  it('returns short_label alongside template_key', async () => {
    // The function returns [] for a document with no contract_id, which is the
    // path most documents take; assert on the SHAPE the query builds rather than
    // constructing a whole multi-document engagement to observe one column.
    const src = (await h.q<{ def: string }>(
      `select pg_get_functiondef(oid) as def from pg_proc where proname='contract_signing_set'`))[0].def;
    expect(src).toContain(`'short_label', coalesce(t.short_label, t.title)`);
    // template_key is still there — the change is additive.
    expect(src).toContain(`'template_key', t.template_key`);
  });
});
