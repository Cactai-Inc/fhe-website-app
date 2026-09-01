-- SPEC H.11 — account surfacing: a lease executed for me puts the horse in MY
-- stable. my_stable_horses v2 adds the current-lessee link (horses.lessee_contact_id,
-- set by the execution-effects trigger) alongside owner + active-party links, and
-- returns the lease term so the account can show it.
--
-- test/db harness repair (2026-08-02): this CREATE OR REPLACE appends two new
-- OUT columns (lease_start, lease_end) to the RETURNS TABLE shape from
-- 20260710050000_my_stable_horses_bridge.sql. Postgres does not allow that —
-- confirmed against BOTH PGlite and a real local Postgres 18.3 instance,
-- identical error either way: "cannot change return type of existing
-- function... Row type defined by OUT parameters is different. HINT: Use DROP
-- FUNCTION my_stable_horses() first." That is what made a FRESH sequential
-- build (the harness) fail here. How this ever applied against production
-- without failing is not reconstructable from the migration journal alone —
-- the journal is hand-maintained (per the Stage 1-3 report), so it may not be
-- a literal record of every statement actually run there; a later migration
-- (20260717151000_functions_nickname_barn_stall.sql) DOES do the correct
-- DROP FUNCTION IF EXISTS + CREATE for a subsequent signature change, which is
-- the pattern applied here too.
--
-- NOT SAFE TO RE-RUN AGAINST PRODUCTION AS WRITTEN, and it never will be:
-- tested in a rolled-back transaction against lrstswfxfsezdmvkvukc and it
-- FAILS THERE TODAY — "column h.barn_name does not exist" — because
-- 20260717151000_functions_nickname_barn_stall.sql already renamed
-- horses.barn_name to horses.nickname on that database. This file's DROP+CREATE
-- is correct ONLY for a database replaying the full migration sequence in
-- order from empty (the harness), where barn_name still exists at this point
-- in history. Production's my_stable_horses is already at its final,
-- nickname-column shape via the later migration and this file is never
-- re-applied there — migrations run once, by hand, per the project's journal
-- convention (Stage 1-3 report, §7.2). Left exactly as Postgres requires for
-- a correct fresh build; do not "fix" the column name here to match
-- production's current schema, or the harness will diverge from what this
-- migration actually meant at the time it was written.
DROP FUNCTION IF EXISTS public.my_stable_horses();
CREATE FUNCTION public.my_stable_horses()
RETURNS TABLE (
  id              uuid,
  registered_name text,
  barn_name       text,
  breed           text,
  sex             text,
  height          text,
  date_of_birth   date,
  color           text,
  current_location text,
  is_owner        boolean,
  created_at      timestamptz,
  lease_start     date,
  lease_end       date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT h.id, h.registered_name, h.barn_name, h.breed, h.sex, h.height,
         h.date_of_birth, h.color, h.current_location,
         (h.current_owner_contact_id = current_contact_id()) AS is_owner,
         h.created_at, h.lease_start, h.lease_end
  FROM horses h
  WHERE h.deleted_at IS NULL
    AND h.org_id = current_org()
    AND (
      h.current_owner_contact_id = current_contact_id()
      OR h.lessee_contact_id     = current_contact_id()
      OR EXISTS (
        SELECT 1 FROM horse_parties hp
        WHERE hp.horse_id = h.id
          AND hp.deleted_at IS NULL
          AND hp.contact_id = current_contact_id()
          AND (hp.effective_to IS NULL OR hp.effective_to >= current_date)
      )
    )
  ORDER BY h.created_at
$$;
