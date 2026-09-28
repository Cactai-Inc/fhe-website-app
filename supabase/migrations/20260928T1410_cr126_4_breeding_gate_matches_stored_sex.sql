-- CR-126 B3 — the breeding include/exclude control never appeared for the author.
--
-- ROOT CAUSE: the breeding gates compare HORSE.SEX against the CODE ("MARE"), but
-- horse_field_token_value maps HORSE.SEX to the DISPLAY label ("Mare") — the same
-- code-vs-label trap sync_contract_fields_from_defs already documents for HORSE.%.
-- So `equals ["MARE"]` never matched the stored "Mare", the Sex ∈ {Mare,Stallion,
-- Colt,Filly} predicate was always false, the TXN.BREEDING_ELECTION control was
-- hidden, and both breeding sections could never turn on. The author saw the
-- disclosure notice (generated from the same never-satisfied gate) and two grayed
-- sections with no control — exactly the owner's report.
--
-- FIX: the four Sex leaves compare against the DISPLAY values HORSE.SEX actually
-- holds. Applies to the election field's gate and both breeding clause gates.
-- Zero executed BOS documents, so no signed paper is touched (D33).

-- TXN.BREEDING_ELECTION: the Sex ∈ {Mare,Stallion,Colt,Filly} gate.
UPDATE contract_field_defs
   SET conditional_on = '{"any":[{"equals":["Mare"],"field_key":"HORSE.SEX"},{"equals":["Stallion"],"field_key":"HORSE.SEX"},{"equals":["Colt"],"field_key":"HORSE.SEX"},{"equals":["Filly"],"field_key":"HORSE.SEX"}]}'::jsonb
 WHERE template_key = 'HORSE_SALE_V2' AND field_key = 'TXN.BREEDING_ELECTION';

-- HORSE.BREEDING (warranty included): Sex ∈ {…} AND election = Included.
UPDATE contract_clause_defs
   SET conditional_on = '{"all":[{"any":[{"equals":["Mare"],"field_key":"HORSE.SEX"},{"equals":["Stallion"],"field_key":"HORSE.SEX"},{"equals":["Colt"],"field_key":"HORSE.SEX"},{"equals":["Filly"],"field_key":"HORSE.SEX"}]},{"equals":["INCLUDED"],"field_key":"TXN.BREEDING_ELECTION"}]}'::jsonb
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'HORSE.BREEDING';

-- HORSE.BREEDING_DECLINED (warranty not elected): Sex ∈ {…} AND election = Not included.
UPDATE contract_clause_defs
   SET conditional_on = '{"all":[{"any":[{"equals":["Mare"],"field_key":"HORSE.SEX"},{"equals":["Stallion"],"field_key":"HORSE.SEX"},{"equals":["Colt"],"field_key":"HORSE.SEX"},{"equals":["Filly"],"field_key":"HORSE.SEX"}]},{"equals":["NOT_INCLUDED"],"field_key":"TXN.BREEDING_ELECTION"}]}'::jsonb
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'HORSE.BREEDING_DECLINED';

-- B3: rename the election options to Include / Don't Include (the owner's control
-- words). Values unchanged so the clause gates and any stored selection still match.
UPDATE contract_field_defs
   SET options = '[{"label":"Include","value":"INCLUDED"},{"label":"Don''t Include","value":"NOT_INCLUDED"}]'::jsonb,
       label = 'Breeding warranty'
 WHERE template_key = 'HORSE_SALE_V2' AND field_key = 'TXN.BREEDING_ELECTION';
