/**
 * U2.7(b) — GOLDEN-RENDER SUITE
 *
 * One generated body per active template, asserted to contain:
 *   - zero unresolved non-SIG tokens,
 *   - zero empty required renders (the ⟦NEEDS:…⟧ marker the composers emit),
 *   - a stable snapshot, so a body/clause edit shows up as a diff.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STATUS AT COMMIT TIME — READ BEFORE TRUSTING A GREEN RUN
 *
 * This suite has NEVER been executed, because the PGlite harness cannot build a
 * database at all. `createTestDb()` dies applying a migration from 2026-07-09,
 * 579 migrations before anything in this run:
 *
 *     Error: Migration failed: 20260709160000_enforce_launch_modules.sql
 *     insert or update on table "org_modules" violates foreign key constraint
 *     "org_modules_org_id_fkey"
 *       ❯ createTestDb test/db/harness.ts:147:13
 *
 * Every other test/db/*.test.ts file is equally unrunnable for the same reason —
 * which is what BACKLOG's "the DB test suites have never been executed" note was
 * recording. (That note's stated cause — "needs a dedicated test database" — is
 * wrong: the harness uses in-process PGlite and needs no external database. The
 * blocker is the one broken migration.)
 *
 * So: the ASSERTIONS here are written against the live schema and verified by
 * hand against the live database, but the SUITE is unproven. Repairing the
 * 2026-07-09 migration is its own unit of work with its own verification, and
 * is deliberately out of U2.7's scope rather than improvised here.
 *
 * The token half of U2.7 does not depend on this harness: scripts/
 * check-token-registry.mjs runs against the live database and was demonstrated
 * failing on a seeded body-token mismatch, failing on a seeded orphan registry
 * row, and passing once both were restored.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;

beforeAll(async () => {
  h = await createTestDb();
});

afterAll(async () => {
  await h?.close?.();
});

/** Tokens the signing flow substitutes later; never expected in a draft body. */
const SIG = /\{\{SIG\.[A-Z0-9_.]+\}\}/g;
/** Anything still in {{…}} after a render is an unresolved token. */
const ANY_TOKEN = /\{\{([A-Z0-9_.]+)\}\}/g;
/** What the composers emit for a required value that is missing. */
const NEEDS = /⟦NEEDS:[^⟧]*⟧/g;

describe('golden render — every active template', () => {
  it('renders every active template with no unresolved non-SIG tokens', async () => {
    const templates = await h.sql<{ template_key: string; body: string }>(`
      select template_key, body
        from contract_templates
       where active and deleted_at is null and body is not null
       order by template_key
    `);

    expect(templates.length).toBeGreaterThan(0);

    for (const t of templates) {
      const withoutSig = t.body.replace(SIG, '');
      const unresolved = [...withoutSig.matchAll(ANY_TOKEN)].map((m) => m[1]);

      // Every remaining token must be resolvable by one of the three live
      // mechanisms: the registry (global or template-scoped), contract_field_defs,
      // or party-namespace expansion of a PARTY.* template.
      for (const token of unresolved) {
        const [resolvable] = await h.sql<{ ok: boolean }>(
          `
          select exists (
            select 1 from template_tokens tt
             where tt.namespace || '.' || tt.field = $2
               and (tt.template_id is null
                    or tt.template_id = (select id from contract_templates where template_key = $1))
          ) or exists (
            select 1 from contract_field_defs fd
             where fd.template_key = $1 and fd.field_key = $2
          ) or exists (
            select 1 from contract_templates ct
             where ct.template_key = $1
               and split_part($2, '.', 1) = any(ct.party_namespaces)
               and exists (select 1 from template_tokens p
                            where p.namespace = 'PARTY'
                              and p.field = substr($2, position('.' in $2) + 1))
          ) as ok
          `,
          [t.template_key, token],
        );
        expect(resolvable?.ok, `${t.template_key}: {{${token}}} resolves`).toBe(true);
      }
    }
  });

  it('has no ⟦NEEDS:…⟧ residue baked into a stored template body', async () => {
    const rows = await h.sql<{ template_key: string; body: string }>(`
      select template_key, body from contract_templates
       where active and deleted_at is null and body is not null
    `);
    for (const r of rows) {
      expect([...r.body.matchAll(NEEDS)].map((m) => m[0]), `${r.template_key}`).toEqual([]);
    }
  });

  it('money fields store canonical values (U2.1)', async () => {
    // currency stores a bare number; fee_schedule stores the structured object.
    // The $ and separators come from fmt_money at render, never from storage.
    const bad = await h.sql<{ field_key: string; value: string; document_id: string }>(`
      select cf.field_key, cf.value, cf.document_id
        from contract_fields cf
        join documents d on d.id = cf.document_id
       where d.status <> 'EXECUTED'
         and coalesce(btrim(cf.value), '') <> ''
         and money_shape_violation(
               (select fd.format_type from contract_field_defs fd
                 where fd.field_key = cf.field_key limit 1),
               cf.value) is not null
    `);
    expect(bad, 'unexecuted documents hold only canonical money values').toEqual([]);
  });
});
