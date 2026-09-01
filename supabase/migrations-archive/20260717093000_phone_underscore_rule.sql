-- apply_field_formats phone rule now also catches _PHONE keys (HORSE.VET_PHONE,
-- HORSE.FARRIER_PHONE were typed text instead of phone).
CREATE OR REPLACE FUNCTION public.apply_field_formats(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pairs text[][] := ARRAY[
    ARRAY['TXN.BOARDING_RESPONSIBILITY','TXN.BOARD_COST'],
    ARRAY['TXN.FARRIER_RESPONSIBILITY','TXN.FARRIER_COST'],
    ARRAY['TXN.ROUTINE_VET_RESPONSIBILITY','TXN.ROUTINE_VET_COST'],
    ARRAY['TXN.EMERGENCY_VET_RESPONSIBILITY','TXN.NON_ROUTINE_VET_COST'],
    ARRAY['TXN.SUPPLEMENTS_RESPONSIBILITY','TXN.SUPPLEMENTS_COST']
  ];
  p text[];
BEGIN
  -- base format_type from input_kind/value_type
  UPDATE contract_fields SET format_type = CASE
      WHEN input_kind = 'responsibility' THEN 'party'
      WHEN input_kind = 'contact'        THEN 'person'
      WHEN input_kind IN ('week_grid','select','buttons','currency','date','percent','longtext') THEN input_kind
      ELSE 'text' END
    WHERE document_id = p_document_id AND coalesce(format_type,'') = '';

  -- semantic upgrades so the data is reusable
  UPDATE contract_fields SET format_type='email'       WHERE document_id=p_document_id AND field_key LIKE '%.EMAIL';
  UPDATE contract_fields SET format_type='phone'       WHERE document_id=p_document_id AND (field_key LIKE '%.PHONE' OR field_key LIKE '%\_PHONE');
  UPDATE contract_fields SET format_type='person_name' WHERE document_id=p_document_id AND (field_key LIKE '%.FULL_NAME' OR field_key LIKE '%.PRINTED_NAME' OR field_key LIKE '%.VET_NAME' OR field_key LIKE '%.FARRIER_NAME');
  UPDATE contract_fields SET format_type='address'     WHERE document_id=p_document_id AND field_key LIKE '%.ADDRESS';
  UPDATE contract_fields SET format_type='currency'    WHERE document_id=p_document_id AND field_key LIKE '%FAIR_MARKET_VALUE';
  UPDATE contract_fields SET format_type='location'    WHERE document_id=p_document_id AND field_key IN ('HORSE.CURRENT_LOCATION','HORSE.HOME_LOCATION');
  UPDATE contract_fields SET format_type='number'      WHERE document_id=p_document_id AND field_key LIKE 'TXN.LESSONS_%' AND field_key <> 'TXN.LESSONS_COST';

  -- link the manageâcost pairs
  FOREACH p SLICE 1 IN ARRAY pairs LOOP
    UPDATE contract_fields SET format_type='pair', input_kind='pair', pair_cost_key=p[2]
      WHERE document_id=p_document_id AND field_key=p[1];
    UPDATE contract_fields SET pair_manage_key=p[1]
      WHERE document_id=p_document_id AND field_key=p[2];
  END LOOP;

  -- guidance from the registry where missing
  UPDATE contract_fields cf SET guidance = f.guidance
    FROM contract_formats f
   WHERE cf.document_id=p_document_id AND cf.format_type=f.format_type
     AND coalesce(cf.guidance,'')='' AND coalesce(f.guidance,'')<>'';
END;
$function$;
