-- ─────────────────────────────────────────────────────────────────────────────
-- HORSE WIRING REPAIRS (2026-07-30)
--
-- Three defects found by a wiring audit of the horse subsystem. Each was
-- verified against the live database before this migration was written.
--
--   1. staff_assign_horse_party had TWO overloads. The 6-arg form is the older
--      version, superseded by the 8-arg one (which adds the TRAINER/CARETAKER/
--      BOARDER ledger roles plus share_pct and notes, and is otherwise a strict
--      superset). Because every argument after p_contact_id has a DEFAULT, a
--      5- or 6-argument call matched BOTH candidates and Postgres refused it:
--        ERROR: function staff_assign_horse_party(...) is not unique
--      That is exactly the call shape src/lib/horses.ts:245 uses, so the staff
--      "assign owner / assign lessee" actions on HorseRecordsPage were dead
--      while the 7-arg HorsePartiesPage path kept working. Drop the old one.
--
--   2. One horse ("Beaumont de Cactai") has no OWNER row in horse_relationships.
--      It was created before 20260717120000_single_horse_intake_path.sql added
--      the ledger INSERT to create_horse_record, so it never got one. Its
--      ownership is currently carried ONLY by horses.current_owner_contact_id.
--      Backfill from that column so the ledger is complete.
--
--   3. modules.description for mod.horserecords still names `horse_parties`,
--      a table retired in favour of horse_relationships. Cosmetic, but it is a
--      live row advertising a table that no longer exists.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Drop the superseded overload ──────────────────────────────────────────
-- Guarded: only drop when BOTH overloads are present, so re-running this (or
-- running it against a database that only ever had the 8-arg form) is a no-op
-- rather than an error that removes the live function.
DO $do$
BEGIN
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'staff_assign_horse_party') = 2 THEN
    DROP FUNCTION public.staff_assign_horse_party(uuid, text, uuid, date, date, boolean);
    RAISE NOTICE 'dropped the superseded 6-arg staff_assign_horse_party';
  ELSE
    RAISE NOTICE 'staff_assign_horse_party: not two overloads — leaving alone';
  END IF;
END
$do$;

-- ── 2. Backfill the missing OWNER ledger row(s) ──────────────────────────────
-- Set-based and idempotent: covers any horse whose owner column is populated but
-- which has no active OWNER relationship. created_by_contact_id is left NULL —
-- this row is a repair, not an act by a person.
INSERT INTO horse_relationships
  (org_id, horse_id, relationship, party_contact_id, active, notes)
SELECT h.org_id, h.id, 'OWNER', h.current_owner_contact_id, true,
       'Backfilled 2026-07-30: created before create_horse_record wrote the ledger.'
  FROM horses h
 WHERE h.deleted_at IS NULL
   AND h.current_owner_contact_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM horse_relationships r
      WHERE r.horse_id = h.id AND r.relationship = 'OWNER' AND r.active);

-- ── 3. Retire the stale table name from the module description ───────────────
UPDATE modules
   SET description = 'Horse records: ownership and rights (horse_relationships), '
                     || 'health events, and medications.'
 WHERE module_key = 'mod.horserecords'
   AND description LIKE '%horse_parties%';
