-- Disclosure reciprocity, phase 16: remove the dead TXN.KNOWN_CONDITIONS seed in
-- start_sale_contract. The sale v3 template no longer has a TXN.KNOWN_CONDITIONS
-- field — known conditions are the HORSE.KNOWN_CONDITIONS disclosure section, filled
-- generically from the record — so this UPDATE matches no row (a harmless no-op).
-- Removed outright, no narration left behind.

DO $d$
DECLARE
  v_def text;
  v_old text := $q$    -- seller-disclosure seed from the record (attach fills HORSE.* only)
    UPDATE contract_fields
       SET value = coalesce(horse_field_token_value(v_horse, 'KNOWN_CONDITIONS'), '')
     WHERE document_id = v_doc AND field_key = 'TXN.KNOWN_CONDITIONS'
       AND coalesce(btrim(value), '') = ''
       AND coalesce(horse_field_token_value(v_horse, 'KNOWN_CONDITIONS'), '') <> '';

$q$;
BEGIN
  SELECT pg_get_functiondef('public.start_sale_contract'::regproc) INTO v_def;
  IF position('TXN.KNOWN_CONDITIONS' IN v_def) = 0 THEN RETURN; END IF;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'start_sale_contract dead-seed block not found';
  END IF;
  EXECUTE replace(v_def, v_old, '');
END $d$;
