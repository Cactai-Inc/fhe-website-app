/**
 * PGlite test harness — applies the repo's Supabase migrations to an in-memory
 * Postgres (WASM, no Docker) and emulates the Supabase runtime the migrations
 * assume: the `auth` schema, `auth.uid()`, and the anon/authenticated/service_role
 * roles, plus the broad table grants Supabase installs by default so that RLS —
 * not a missing GRANT — is the thing under test.
 *
 * Role semantics, matched to Supabase:
 *   asSuperuser  -> RESET ROLE; bypasses RLS (migration / service-role context)
 *   asServiceRole-> SET ROLE service_role (BYPASSRLS) — server functions
 *   asUser(uid)  -> SET ROLE authenticated + jwt.sub = uid — a logged-in user
 *   asAnon       -> SET ROLE anon — an unauthenticated visitor
 *
 * auth.uid() reads current_setting('request.jwt.claim.sub') just like Supabase,
 * so SECURITY DEFINER helpers (is_admin(), owns_order(), …) resolve the caller
 * correctly.
 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = resolve(HERE, '../../supabase/migrations');
export const SNAPSHOT_FILE = resolve(HERE, 'fixtures/schema_snapshot.sql');

/** Tables the snapshot is allowed to carry rows for (Task 4 drift guard — see
 *  fixtures/schema_snapshot.sql's header). Anything else is schema-only. */
const SNAPSHOT_DATA_TABLES = new Set([
  'organizations',
  'service_types',
  'contract_templates',
  'contract_section_defs',
  'contract_clause_defs',
  'contract_field_defs',
  'template_tokens',
  // Global platform catalog + lookups, added by TASK-TESTDB. Seeded by
  // migrations rather than by tenant activity, so the snapshot path (which does
  // not replay migrations) loaded them empty and broke 21 test files — see the
  // section header these rows live under in schema_snapshot.sql. PII review:
  // none of the five has an org_id or any personal data; they hold feature
  // keys, plan tiers and breed/colour vocabulary.
  'modules',
  'tiers',
  'tier_modules',
  'horse_breeds',
  'horse_colors',
  // Tenant #1's module entitlements — the only per-tenant table here, and the
  // tenant is the single organization the snapshot already carries. Module keys
  // and booleans only; no personal data. Without it every has_module()-gated RLS
  // policy denies and the module suites die in setup.
  'org_modules',
  // Global contract-variant registry: no org_id, no personal data.
  'template_variants',
]);

/** Every table an INSERT/COPY statement in the snapshot targets, in the order
 *  first seen — used to fail loudly if the snapshot ever picks up rows for a
 *  table outside SNAPSHOT_DATA_TABLES (see the file's own header comment). */
function snapshotDataTargets(sql: string): string[] {
  const targets = new Set<string>();
  const re = /^(?:INSERT INTO|COPY)\s+public\.(\w+)/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) targets.add(m[1]);
  return [...targets];
}

/** Monotonic counter for unique synthetic emails (deterministic across a run). */
let userSeq = 0;

/** SQL that stands in for the Supabase-managed parts of the database. */
const BOOTSTRAP = /* sql */ `
  -- Supabase's predefined roles.
  do $$ begin
    if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
    if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
    if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  end $$;

  grant usage on schema public to anon, authenticated, service_role;

  -- Supabase grants table/sequence/function DML to anon+authenticated by default;
  -- RLS then restricts. Emulate that so a missing GRANT never masquerades as an
  -- RLS denial in tests. Applied as default privileges BEFORE migrations run, so
  -- every migration-created object inherits them.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

  -- The auth schema Supabase owns.
  create schema if not exists auth;
  grant usage on schema auth to anon, authenticated, service_role;

  create table if not exists auth.users (
    id                 uuid primary key default gen_random_uuid(),
    email              text unique,
    raw_user_meta_data jsonb not null default '{}',
    created_at         timestamptz not null default now()
  );

  create or replace function auth.uid() returns uuid language sql stable as $fn$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $fn$;

  create or replace function auth.role() returns text language sql stable as $fn$
    select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
  $fn$;

  create or replace function auth.email() returns text language sql stable as $fn$
    select nullif(current_setting('request.jwt.claim.email', true), '')
  $fn$;

  -- The storage schema Supabase owns (minimal emulation so storage RLS policies
  -- can be created and exercised: buckets + objects, RLS on objects).
  create schema if not exists storage;
  grant usage on schema storage to anon, authenticated, service_role;

  create table if not exists storage.buckets (
    id         text primary key,
    name       text,
    public     boolean not null default false,
    created_at timestamptz not null default now()
  );

  create table if not exists storage.objects (
    id         uuid primary key default gen_random_uuid(),
    bucket_id  text references storage.buckets(id),
    name       text not null,
    owner      uuid,
    created_at timestamptz not null default now()
  );

  grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
  alter table storage.objects enable row level security;

  -- Supabase Storage helper used by bucket RLS policies (splits an object path
  -- into its folder segments). PGlite has no Storage extension, so shim it to
  -- match Supabase's implementation: storage.foldername('a/b/c.png') -> {a,b}.
  create or replace function storage.foldername(name text)
    returns text[] language sql immutable as $fn$
    select case
      when name is null or position('/' in name) = 0 then '{}'::text[]
      else (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
    end;
  $fn$;
`;

export interface TestDb {
  db: PGlite;
  /** Reset to the in-memory superuser (RLS bypassed) — migration/admin context. */
  asSuperuser(): Promise<void>;
  /** Act as the Supabase service_role (BYPASSRLS) — server-side functions. */
  asServiceRole(): Promise<void>;
  /** Act as a logged-in user with the given auth uid. */
  asUser(uid: string): Promise<void>;
  /** Act as an unauthenticated visitor. */
  asAnon(): Promise<void>;
  /** Insert an auth.users row (+ optional profile). Returns the new uid. */
  createAuthUser(opts?: { email?: string; profile?: boolean; isAdmin?: boolean; role?: string; org?: string | null }): Promise<string>;
  /** Convenience query that returns rows. */
  q<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

/** List migration files in apply order (timestamp-prefixed → lexical sort). */
export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/** Build the TestDb wrapper around an already-populated PGlite instance —
 *  shared by both setup paths (snapshot and migration-replay) so role/claim
 *  semantics never drift between them. */
function buildHarness(db: PGlite): TestDb {
  const setClaim = async (key: string, value: string) => {
    await db.query(`select set_config('request.jwt.claim.${key}', $1, false)`, [value]);
  };

  return {
    db,
    async asSuperuser() {
      await db.exec('reset role;');
      await setClaim('sub', '');
      await setClaim('role', 'service_role');
    },
    async asServiceRole() {
      await db.exec('reset role;');
      await setClaim('sub', '');
      await setClaim('role', 'service_role');
      await db.exec('set role service_role;');
    },
    async asUser(uid: string) {
      await db.exec('reset role;');
      await setClaim('sub', uid);
      await setClaim('role', 'authenticated');
      await db.exec('set role authenticated;');
    },
    async asAnon() {
      await db.exec('reset role;');
      await setClaim('sub', '');
      await setClaim('role', 'anon');
      await db.exec('set role anon;');
    },
    async createAuthUser(o = {}) {
      await db.exec('reset role;');
      const email = o.email ?? `user-${++userSeq}@test.fhe`;
      const res = await db.query<{ id: string }>(
        `insert into auth.users (email) values ($1) returning id`,
        [email],
      );
      const uid = res.rows[0].id;
      if (o.profile !== false) {
        const role = o.role ?? (o.isAdmin ? 'ADMIN' : 'USER');
        await db.query(
          `insert into profiles (user_id, email, role) values ($1, $2, $3)`,
          [uid, email, role],
        );
        // join a tenant: default to the sole/first org; pass org:null to opt out
        // (an outsider), or org:'<id>' for a specific tenant.
        if (o.org !== null) {
          try {
            const orgId = o.org ?? (await db.query<{ id: string }>(
              `select id from organizations order by created_at limit 1`)).rows[0]?.id;
            if (orgId) await db.query(`update profiles set org_id=$1 where user_id=$2`, [orgId, uid]);
          } catch { /* organizations/profiles.org_id not present yet (early upTo) */ }
        }
      }
      return uid;
    },
    async q<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const res = await db.query<T>(sql, params);
      return res.rows;
    },
    async close() {
      await db.close();
    },
  };
}

/** Default org context + role reset shared by both setup paths. */
async function finalizeHarness(db: PGlite): Promise<TestDb> {
  // Seed/service context: default org for superuser inserts (org_id DEFAULT
  // current_org()). current_org() only reads this GUC when auth.uid() IS NULL.
  try {
    const org = await db.query<{ id: string }>(`select id from organizations order by created_at limit 1`);
    if (org.rows[0]) await db.query(`select set_config('app.current_org', $1, false)`, [org.rows[0].id]);
  } catch {
    // Migration-replay path with a low `upTo`: organizations doesn't exist yet
    // (it's created by migration 24). NOT expected on the snapshot path — if
    // this throws there, something is genuinely wrong with the snapshot, most
    // likely search_path (see the SET search_path TO public; comment above).
  }

  const harness = buildHarness(db);
  await harness.asSuperuser();
  return harness;
}

/**
 * Spin up a fresh database from the committed schema snapshot
 * (fixtures/schema_snapshot.sql) — the DEFAULT setup path (Task 4). Sidesteps
 * the migration chain's known break (20260709160000_enforce_launch_modules.sql)
 * by loading the live database's actual current schema + a small, reviewed
 * seed-data allowlist directly, instead of replaying ~590 migrations' history
 * to reconstruct it.
 *
 * DRIFT GUARD: throws if the snapshot file ever carries rows for a table
 * outside SNAPSHOT_DATA_TABLES — see that constant's comment and the
 * snapshot file's own header for what's allowed and why.
 */
export async function createTestDbFromSnapshot(): Promise<TestDb> {
  const sql = readFileSync(SNAPSHOT_FILE, 'utf8');

  const targets = snapshotDataTargets(sql);
  const unexpected = targets.filter((t) => !SNAPSHOT_DATA_TABLES.has(t));
  if (unexpected.length > 0) {
    throw new Error(
      `schema_snapshot.sql carries data for table(s) not on the reviewed allowlist: ${unexpected.join(', ')}. ` +
      `This snapshot has NOT been reviewed for PII on those tables — regenerate it scoped to exactly ` +
      `${[...SNAPSHOT_DATA_TABLES].join(', ')}, or add the new table to SNAPSHOT_DATA_TABLES in harness.ts ` +
      `only after an explicit PII review.`,
    );
  }

  // pgcrypto is loadable in PGlite but must be registered at create time for
  // `CREATE EXTENSION pgcrypto` (20260703110000 — execution hashes) to work.
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(BOOTSTRAP);
  try {
    await db.exec(sql);
  } catch (err) {
    throw new Error(`Snapshot load failed: fixtures/schema_snapshot.sql\n${(err as Error).message}`);
  }
  // Defense in depth: pg_dump's own header sets search_path to '' (empty,
  // session-scoped) so every dumped statement can safely use unqualified
  // names without ambiguity. The snapshot file resets it back to `public`
  // itself, but that reset living only in generated dump content is fragile
  // against a future regeneration silently dropping it — every unqualified
  // query this harness or a test writes (e.g. `select ... from organizations`)
  // would then fail with "relation does not exist" despite the table being
  // right there in pg_class. Enforced here too so that failure mode can't
  // come back from the data file alone.
  await db.exec('SET search_path TO public;');
  // Same class of leak: the dump header's `SET row_security = off` is
  // session-scoped and survives the load. Under it, any non-BYPASSRLS role
  // (asUser/asAnon) errors with "query would be affected by row-level
  // security policy" on the first RLS-covered table it touches — RLS can
  // only be evaluated, not disabled, for roles that don't own the bypass.
  await db.exec('SET row_security = on;');
  await alignDisplayCodeSequences(db);

  return finalizeHarness(db);
}

/**
 * Advance every display-code sequence past the codes the snapshot's seed rows
 * already carry.
 *
 * The snapshot is schema + a hand-picked seed-data allowlist, and it contains
 * NO `setval` statements at all — `pg_dump`'s sequence-restoring calls are not
 * in the file. So every sequence loads back at its start value while the seeded
 * rows hold codes already consumed from it. The seeded FHE organization holds
 * ORG-000001 and `org_code_seq` restarts at 1, so the FIRST organization any
 * test inserted collided:
 *
 *   duplicate key value violates unique constraint "organizations_display_code_key"
 *
 * That killed the beforeAll of 21 test files. It is a fixture defect, not a
 * test-isolation one — each file gets its own private PGlite, so nothing leaks
 * between them and no two tests were racing for a code.
 *
 * Driven off pg_trigger rather than a hardcoded list: `organizations` is the only
 * seeded table carrying a code today, but seven other tables (bookings, clients,
 * contacts, contracts, deals, horses, purchases) use the same trigger, and a
 * future snapshot regeneration that seeds one of them would otherwise reintroduce
 * this silently.
 */
async function alignDisplayCodeSequences(db: PGlite): Promise<void> {
  await db.exec(/* sql */ `
    do $$
    declare
      t        record;
      v_prefix text;
      v_seq    text;
      v_max    bigint;
    begin
      for t in
        select pg_get_triggerdef(tg.oid) as def, c.relname as tbl
        from pg_trigger tg
        join pg_class c on c.oid = tg.tgrelid
        join pg_proc  p on p.oid = tg.tgfoid
        where p.proname in ('assign_display_code', 'assign_display_code_yearly')
          and not tg.tgisinternal
      loop
        -- ... EXECUTE FUNCTION public.assign_display_code('ORG-', 'org_code_seq')
        v_prefix := (regexp_match(t.def, '\\((''|")([^'']*)''\\s*,\\s*''([^'']*)''\\)$'))[2];
        v_seq    := (regexp_match(t.def, '\\((''|")([^'']*)''\\s*,\\s*''([^'']*)''\\)$'))[3];
        if v_seq is null or to_regclass('public.' || v_seq) is null then
          continue;
        end if;

        -- The counter is always the trailing digit run: ORG-000001 and the
        -- yearly form ENG-2026-000001 both end in the 6-digit sequence value.
        execute format(
          'select coalesce(max((substring(display_code from ''[0-9]+$''))::bigint), 0)
             from public.%I
            where display_code like %L
              and substring(display_code from ''[0-9]+$'') is not null',
          t.tbl, v_prefix || '%'
        ) into v_max;

        -- Only when seed rows exist. Leaving an empty table's sequence untouched
        -- keeps its first nextval() at 1, which is what the tests expect.
        if v_max > 0 then
          perform setval(v_seq::regclass, v_max, true);
        end if;
      end loop;
    end $$;
  `);
}

/**
 * Spin up a fresh database by replaying every migration in order — the
 * ORIGINAL setup path, kept for `upTo` truncation (a fixed-point-in-time
 * snapshot cannot serve an arbitrary earlier cutoff) and for provenance.
 * Throws with the offending filename if one fails — including the known
 * break at 20260709160000_enforce_launch_modules.sql when no `upTo` limits
 * the replay short of it.
 */
export async function createTestDbFromMigrations(opts?: { upTo?: string }): Promise<TestDb> {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(BOOTSTRAP);

  for (const file of migrationFiles()) {
    if (opts?.upTo && file > opts.upTo) break;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await db.exec(sql);
    } catch (err) {
      throw new Error(`Migration failed: ${file}\n${(err as Error).message}`);
    }
  }

  return finalizeHarness(db);
}

/**
 * Spin up a fresh test database. Defaults to the schema snapshot (fast,
 * unblocked by the migration chain's known break). Pass `upTo` to instead
 * replay migrations up to a specific file, for tests that need an earlier
 * schema state than the snapshot's point in time.
 */
export async function createTestDb(opts?: { upTo?: string }): Promise<TestDb> {
  if (opts?.upTo) return createTestDbFromMigrations(opts);
  return createTestDbFromSnapshot();
}
