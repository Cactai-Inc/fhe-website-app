-- Fix round 3, item 1 — client/staff horse-add regression R1.
--
-- horses.injuries_to_humans was made text NOT NULL with no default by the
-- disclosure overhaul (disc_21), but both writers (create_horse_record,
-- update_horse_record) insert nullif(btrim(coalesce(p->>'injuries_to_humans',
-- '')),'') which is NULL whenever no injuries answer is supplied — i.e. the
-- normal create — so every horse-add without an injuries answer 400'd.
--
-- NULL is the correct value for "the question has not been answered": the
-- record shows it blank, the contract HORSE.INJURIES_TO_HUMANS_GATE mirrors it
-- as empty, and an empty required selector keeps the document unsignable until
-- it is answered (contract_lock_blockers). None is the maker's explicit YES/NO/
-- UNKNOWN choice, never a stand-in for unanswered. So the column holds NULL for
-- unanswered, not a NOT NULL empty string.
--
-- Drop the NOT NULL and normalize the existing six '' rows (backfilled by
-- disc_21) to NULL so "unanswered" is one value everywhere.

BEGIN;

ALTER TABLE horses ALTER COLUMN injuries_to_humans DROP NOT NULL;

UPDATE horses SET injuries_to_humans = NULL
 WHERE btrim(coalesce(injuries_to_humans, '')) = '';

COMMIT;
