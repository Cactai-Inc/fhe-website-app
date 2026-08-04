-- R11 PHASE A3 — HORSE_LEASE_V2 data pass so the heading-derived numbering of
-- migration 20260804110000 lands on a template whose headings are actually the
-- headers the owner intends.
--
-- Three moves, all idempotent and all guarded on the CURRENT live value so a
-- replay (or a template someone else has since edited) is a no-op rather than a
-- silent overwrite:
--
--   1. HORSE.IDENTITY  'Horse' → 'Horse Details' (the section is already
--      "3. The Horse"; the header repeated it).
--   2. VARIANT GROUPS — a group of mutually-exclusive clauses (individual /
--      entity, disclosed / none, …) is ONE numbered item. The [Pending]
--      placeholder sorts FIRST and carries the group's heading, so the item's
--      number and title exist from the moment the document is created and stay
--      put when the selection resolves. Exactly one member is ever gated on, so
--      exactly one takes the number.
--   3. LOCATION block (which lives inside the HORSE section) gets ONE header:
--      LOCATION.MAIN → 'Location'; MOVE_CHOICE / NEW / INSPECTION stay
--      headingless and read as continuation under it.
--
-- Sort orders are only ever rewritten within a group, never across sections.

BEGIN;

-- ── 1. HORSE.IDENTITY heading ───────────────────────────────────────────────
UPDATE contract_clause_defs SET heading = 'Horse Details'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'HORSE.IDENTITY'
   AND heading = 'Horse';

-- ── 2a. Serious-injury-history group: PENDING first, and it carries the title.
--        live: NONE 43 / DISCLOSED 44 / PENDING 45 (PENDING headingless)
UPDATE contract_clause_defs SET heading = 'Serious Injury History',
       body = '[This section is completed by the Lessor''s selection above. The applicable statement replaces this placeholder once the selection is made; signing is blocked until then.]'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'HORSE.INJURY_HISTORY_PENDING'
   AND heading IS NULL;

UPDATE contract_clause_defs SET sort_order = 43
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'HORSE.INJURY_HISTORY_PENDING'
   AND sort_order = 45;
UPDATE contract_clause_defs SET sort_order = 44
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'HORSE.INJURY_HISTORY_NONE'
   AND sort_order = 43;
UPDATE contract_clause_defs SET sort_order = 45
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'HORSE.INJURY_HISTORY_DISCLOSED'
   AND sort_order = 44;

-- ── 2b. Lessons group: PENDING already headed 'Lessons'; move it in front of
--        LESSONS (250) / LESSONS_ENTITY (255). 245 is free (TRAINER is 200).
UPDATE contract_clause_defs SET sort_order = 245
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'TRAINING_LESSONS.PENDING'
   AND sort_order = 256;

-- ── 2c. Lessee's-representations group: PENDING already headed; move it in
--        front of MAIN_INDIVIDUAL (10) / MAIN_ENTITY (20).
UPDATE contract_clause_defs SET sort_order = 5
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'LESSEE_REPS.PENDING'
   AND sort_order = 21;

-- ── 2d. Purpose group: RECREATION_DEFAULT is the placeholder; move it in front
--        of RECREATION (10). Both already carry 'Purpose of Agreement'.
UPDATE contract_clause_defs SET sort_order = 5
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'PURPOSE.RECREATION_DEFAULT'
   AND sort_order = 12;

-- ── 2e. Definitions groups are PREAMBLE-POSITION variants: every member stays
--        headingless (the whole section reads as unnumbered preamble under
--        "N. DEFINITIONS"), so only the reading order changes — each
--        placeholder ahead of its own variants. The live block carried tied
--        sort_orders (11/11 and 13/13), so it is restated on a clean scale.
UPDATE contract_clause_defs c SET sort_order = v.so
  FROM (VALUES
        ('DEFINITIONS.LESSOR_PENDING', 11, 10),
        ('DEFINITIONS.LESSOR_IND',     10, 20),
        ('DEFINITIONS.LESSOR_ENT',     11, 30),
        ('DEFINITIONS.LESSEE_PENDING', 13, 40),
        ('DEFINITIONS.LESSEE_IND',     12, 50),
        ('DEFINITIONS.LESSEE_ENT',     13, 60),
        ('DEFINITIONS.BINDING',        14, 70),
        ('DEFINITIONS.BENEFICIARIES',  15, 80)
       ) AS v(clause_key, was, so)
 WHERE c.template_key = 'HORSE_LEASE_V2' AND c.clause_key = v.clause_key
   AND c.sort_order = v.was AND c.heading IS NULL;

-- ── 3. LOCATION block: one header total ─────────────────────────────────────
UPDATE contract_clause_defs SET heading = 'Location'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'LOCATION.MAIN'
   AND heading = 'Location of the Horse';

COMMIT;
