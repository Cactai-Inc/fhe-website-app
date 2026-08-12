/*
  # LEASESET — the lease family becomes Standard / Simple / Detailed, and the
  original is archived (owner ruling D10, 2026-08-11).

  Built to docs/tasks/TASK-LEASESET-three-leases-and-an-archive.md. The ruling is
  settled — this migration implements it, it does not re-open it.

  Four TITLE-ONLY / one-flag changes on `contract_templates`. No clause content
  changes: `contract_clause_defs` / `contract_field_defs` are untouched by this
  file, and so is every generated document.

  1. HORSE_LEASE_V2   -> title "Horse Lease Agreement — Standard". Key unchanged:
     6 live documents reference this template by `id`, and 16 `leasefix`
     migrations match on the key string. Renaming the key would break both for a
     cosmetic gain.
  2. HORSE_LEASE_STANDARD -> active = false. Zero-document duplicate of the row
     above (was cloned from _V2 on 2026-08-07 by
     20260807121000_leasefork_three_lease_forks.sql). Deactivating removes it
     from `listLeaseTemplates()` (which filters on `active`); its 163 clause
     rows are left in place, not deleted. If the owner later wants the name on a
     different row, this is one UPDATE back.
  3. HORSE_LEASE_FULL -> title "...Detailed" (was "...Comprehensive"). The owner
     used "the Detailed" twice; key unchanged, same reasoning as #1.
  4. HORSE_LEASE_SIMPLE — no change. Listed here only so a reader of this
     migration sees all three Standard/Simple/Detailed keys accounted for.

  ARCHIVE NOTE — HORSE_LEASE (the pre-clause flat original, already
  active = false, 18,253-char body): retained as historical reference and as a
  source of wording that could be resurrected if something in the current
  clause-composed version is judged worse than the original. It is NOT to be
  activated and NOT to be used to generate a document. `contract_templates` has
  no `archived` boolean (checked — see 20260629040000_contract_templates_tokens.sql)
  and this migration does not add one; this comment plus the note at the top of
  supabase/contract_templates/HORSE_LEASE.md are the record a future cleanup
  pass should find.

  LOCKSTEP NOTE: after this migration the set of keys future `leasefix`-style
  content migrations should write to in lockstep is THREE —
  HORSE_LEASE_V2 + HORSE_LEASE_SIMPLE + HORSE_LEASE_FULL — not four.
  HORSE_LEASE_STANDARD is inactive and must stop receiving content updates, or
  it drifts into a stale copy someone could reactivate by mistake. Same note is
  recorded at the top of supabase/contract_templates/HORSE_LEASE.md.

  NO temp table (nothing here needs one). NO `COMMIT;` — this file is meant to
  be run inside a caller-supplied BEGIN/COMMIT (or dry-run BEGIN/ROLLBACK)
  wrapper; a self-contained COMMIT would end that wrapper early.
*/

-- 1. HORSE_LEASE_V2 becomes the Standard — title only, key unchanged.
UPDATE contract_templates
   SET title = 'Horse Lease Agreement — Standard'
 WHERE template_key = 'HORSE_LEASE_V2';

-- 2. HORSE_LEASE_STANDARD: the redundant fourth clone goes inactive.
--    Clause rows (163 of them) are NOT deleted.
UPDATE contract_templates
   SET active = false
 WHERE template_key = 'HORSE_LEASE_STANDARD';

-- 3. HORSE_LEASE_FULL: "Comprehensive" -> "Detailed" — title only, key unchanged.
UPDATE contract_templates
   SET title = 'Horse Lease Agreement — Detailed'
 WHERE template_key = 'HORSE_LEASE_FULL';
