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
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = resolve(HERE, '../../supabase/migrations');

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
  createAuthUser(opts?: { email?: string; profile?: boolean; isAdmin?: boolean }): Promise<string>;
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

/**
 * Spin up a fresh database: bootstrap the Supabase runtime, then apply every
 * migration in order. Throws with the offending filename if one fails.
 */
export async function createTestDb(opts?: { upTo?: string }): Promise<TestDb> {
  const db = await PGlite.create();
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

  const setClaim = async (key: string, value: string) => {
    await db.query(`select set_config('request.jwt.claim.${key}', $1, false)`, [value]);
  };

  const harness: TestDb = {
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
        await db.query(
          `insert into profiles (user_id, email, is_admin) values ($1, $2, $3)`,
          [uid, email, o.isAdmin ?? false],
        );
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

  await harness.asSuperuser();
  return harness;
}
