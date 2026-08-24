-- TASK-PAMELA §B — {{HORSE.SEX}} printed the raw code into the lease.
--
-- Found while tracing the add-a-horse chain end to end: attaching a horse fills
-- every HORSE.* contract field through `horse_field_token_value`, and that
-- function resolves BREED, COLOR, MARKINGS, REGISTRATION_ORG and
-- PASSPORT_COUNTRY through their vocabularies — but returned `horses.sex`
-- verbatim. A signed lease therefore read "MARE", not "Mare", for the one coded
-- field nobody had noticed.
--
-- The five codes are a fixed biological vocabulary (the same five the intake form
-- offers and the same five `contract_field_defs.options` lists for HORSE.SEX),
-- not tenant-configurable content, so this is a mapping and NOT a fourth
-- `lookup_options` key. `initcap` is the fallback so an unexpected value can
-- never regress to a shouted code either.
--
-- In-place rewrite: read the live body, replace one line, re-execute. Not
-- replayable on a fresh database (a pre-existing property of this repo).
DO $mig$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src
    FROM pg_proc WHERE proname = 'horse_field_token_value';
  IF v_src IS NULL THEN
    RAISE EXCEPTION 'horse_field_token_value not found';
  END IF;
  IF position($$WHEN 'SEX'                 THEN v_horse.sex$$ IN v_src) = 0 THEN
    RAISE NOTICE 'HORSE.SEX already resolves its label — nothing to do';
    RETURN;
  END IF;
  v_src := replace(v_src,
    $$WHEN 'SEX'                 THEN v_horse.sex$$,
    $$WHEN 'SEX'                 THEN CASE upper(coalesce(v_horse.sex, ''))
                                   WHEN 'MARE' THEN 'Mare'
                                   WHEN 'GELDING' THEN 'Gelding'
                                   WHEN 'STALLION' THEN 'Stallion'
                                   WHEN 'COLT' THEN 'Colt'
                                   WHEN 'FILLY' THEN 'Filly'
                                   WHEN '' THEN v_horse.sex
                                   ELSE initcap(v_horse.sex) END$$);
  EXECUTE v_src;
END
$mig$;

-- Repair anything already materialised onto a live document. (Zero rows in
-- production today — checked — so this is the guard, not the fix.)
UPDATE contract_fields
   SET value = initcap(lower(value)), updated_at = now()
 WHERE regexp_replace(field_key, '[{}]', '', 'g') = 'HORSE.SEX'
   AND upper(coalesce(value, '')) IN ('MARE', 'GELDING', 'STALLION', 'COLT', 'FILLY')
   AND value = upper(value);
