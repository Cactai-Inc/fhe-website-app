-- Lease authoring batch (owner directives 2026-08-03/04): restrictions polarity,
-- competitions grouping, Training restored as an allowed activity, Lessons at
-- one clause slot, and the trailing-period rule.

-- ── S10: RESTRICTIONS POLARITY ───────────────────────────────────────────────
-- Old shape: the restriction-AUTHORING clause rendered by default and a
-- checkbox suppressed it, so an untouched lease read "Jumping is restricted as
-- follows: [blank]" — asserting restrictions that do not exist. New shape: the
-- no-restriction statement is the default, and the checkbox ADDS restrictions.
UPDATE contract_field_defs SET
  label = 'Check this box to include restrictions for jumping'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.JUMP_OMIT';
UPDATE contract_field_defs SET
  label = 'Check this box to include restrictions for competitions'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.COMP_OMIT';
UPDATE contract_field_defs SET
  label = 'Check this box to include restrictions for trail riding'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.TRAIL_OMIT';

-- The *_ON clauses (authoring) now require the box CHECKED; the *_OFF clauses
-- (no-restriction statement) become the default, shown while unchecked.
UPDATE contract_clause_defs SET conditional_on =
  '{"all":[{"contains":["JUMPING"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["YES"],"field_key":"TXN.JUMP_OMIT"}]}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.JUMP_ON';
UPDATE contract_clause_defs SET conditional_on =
  '{"all":[{"contains":["JUMPING"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["NO",""],"field_key":"TXN.JUMP_OMIT"}]}'::jsonb,
  body = 'Lessor does not restrict jumping activity in any way.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.JUMP_OFF';

UPDATE contract_clause_defs SET conditional_on =
  '{"all":[{"contains":["COMPETITIONS"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["YES"],"field_key":"TXN.COMP_OMIT"}]}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.COMP_ON';
UPDATE contract_clause_defs SET conditional_on =
  '{"all":[{"contains":["COMPETITIONS"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["NO",""],"field_key":"TXN.COMP_OMIT"}]}'::jsonb,
  body = 'Lessor does not restrict competition activity in any way.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.COMP_OFF';

UPDATE contract_clause_defs SET conditional_on =
  '{"all":[{"contains":["TRAIL"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["YES"],"field_key":"TXN.TRAIL_OMIT"}]}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.TRAIL_ON';
UPDATE contract_clause_defs SET conditional_on =
  '{"all":[{"contains":["TRAIL"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["NO",""],"field_key":"TXN.TRAIL_OMIT"}]}'::jsonb,
  body = 'Lessor does not restrict trail-riding activity in any way.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.TRAIL_OFF';

-- ── S11a: Training restored as an allowed activity ───────────────────────────
-- Removed previously, which left a clause REGULATING training (FHE Approved
-- Trainer) with no clause PERMITTING it — a rule without a grant, against a
-- section that bars any use not listed. Restoring it also forces the talking
-- point: selected, it acknowledges workload/risk beyond lesson hours;
-- unselected, it is an affirmative bar against silent expectation.
-- Button order per owner: lessons, arena solo, arena group, TRAINING, then the
-- restricted run (competitions, jumping, trail) matching clause order below.
UPDATE contract_field_defs SET options = '[
  {"label":"Riding Lessons","value":"LESSONS"},
  {"label":"Solo Arena Riding","value":"ARENA_SOLO"},
  {"label":"Group Arena Riding","value":"ARENA_GROUP"},
  {"label":"Training","value":"TRAINING"},
  {"label":"Competitions","value":"COMPETITIONS"},
  {"label":"Jumping","value":"JUMPING"},
  {"label":"Trail Riding","value":"TRAIL"}]'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.PERMITTED_ACTIVITIES';

-- The FHE-trainer requirement gates on training being permitted, so it cannot
-- render on a lease where training was barred.
UPDATE contract_clause_defs SET conditional_on =
  '{"contains":["TRAINING"],"field_key":"TXN.PERMITTED_ACTIVITIES"}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='TRAINING_LESSONS.TRAINING';

-- ── S11b: Competitions retitled + regrouped ──────────────────────────────────
-- "Competitions" was ambiguous for a clause that allocates entry costs and
-- prize money; and it sat above the restrictions block, splitting the run.
UPDATE contract_clause_defs SET heading = 'Competition Costs and Winnings', sort_order = 310
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='COMPETITIONS.INTRO';
-- Competition restrictions move directly beneath their costs clause; jumping
-- and trail follow, so the restricted run is unbroken and matches button order.
UPDATE contract_clause_defs SET sort_order = 312 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.COMP_TITLE';
UPDATE contract_clause_defs SET sort_order = 313 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.COMP_ON';
UPDATE contract_clause_defs SET sort_order = 314 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.COMP_OFF';
UPDATE contract_clause_defs SET sort_order = 320 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.JUMP_TITLE';
UPDATE contract_clause_defs SET sort_order = 321 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.JUMP_ON';
UPDATE contract_clause_defs SET sort_order = 322 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.JUMP_OFF';
UPDATE contract_clause_defs SET sort_order = 330 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.TRAIL_TITLE';
UPDATE contract_clause_defs SET sort_order = 331 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.TRAIL_ON';
UPDATE contract_clause_defs SET sort_order = 332 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.TRAIL_OFF';

-- ── S12: Lessons variants share ONE clause slot ──────────────────────────────
-- Exactly one renders (individual / entity / pending), so they occupy the same
-- position and everything below renumbers naturally. Bodies unchanged by owner
-- instruction — headings only, for authoring clarity.
UPDATE contract_clause_defs SET heading = 'Lessons — Continuous Enrollment'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='TRAINING_LESSONS.LESSONS';
UPDATE contract_clause_defs SET heading = 'Lessons — Lessee''s Instruction Program'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='TRAINING_LESSONS.LESSONS_ENTITY';
UPDATE contract_clause_defs SET heading = 'Lessons'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='TRAINING_LESSONS.PENDING';

-- ── R5: trailing period removed from bodies ending "…{{TOKEN}}." ─────────────
-- The period is terminal punctuation the signer naturally types, not legal
-- content: leaving it authored produced an orphan "." under a full-width input
-- and a doubled ".." when they typed their own. It is appended at render only
-- when the entered value lacks terminal punctuation (composer change below).
UPDATE contract_clause_defs SET body = left(body, length(body) - 1)
 WHERE template_key='HORSE_LEASE_V2'
   AND body ~ '\{\{[A-Z0-9_.]+\}\}\.$';
