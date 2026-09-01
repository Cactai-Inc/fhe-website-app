-- §3.1 Lease Fee — a fee-schedule builder. One structured field TXN.LEASE_FEE
-- holds { initial_due, options:[{amount,notes}], selected }. The composed clause
-- reads: "Initial payment due: <initial_due>. <selected option sentence>", where
-- the selected option is "$<amount> due on the first day of each month. <notes>".
-- Before an option is selected, only the initial-payment line composes.

-- add a fee_schedule case to the structured-prose composer (before the ELSE).
CREATE OR REPLACE FUNCTION public.compose_field_prose(p_format text, p_structured jsonb, p_label text, p_value text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  s jsonb := coalesce(p_structured, '{}'::jsonb);
  v_out text;
  v_party text;
  v_prov jsonb;
  v_cost jsonb;
  v_manage jsonb;
  v_split jsonb;
  v_parts text[];
  v_e jsonb;
  v_sel int;
  v_opt jsonb;
  v_amt text;
BEGIN
  IF p_structured IS NULL OR p_structured = '{}'::jsonb THEN
    RETURN coalesce(p_value, '');
  END IF;

  CASE p_format
    WHEN 'yesno' THEN
      v_out := CASE upper(coalesce(s->>'value', p_value, '')) WHEN 'YES' THEN 'Yes' WHEN 'NO' THEN 'No' ELSE coalesce(p_value,'') END;

    WHEN 'contact' THEN
      v_parts := ARRAY[]::text[];
      IF coalesce(s->>'name','')    <> '' THEN v_parts := v_parts || (s->>'name'); END IF;
      IF coalesce(s->>'company','') <> '' THEN v_parts := v_parts || (s->>'company'); END IF;
      IF coalesce(s->>'line1','')   <> '' THEN v_parts := v_parts || (s->>'line1'); END IF;
      IF coalesce(s->>'city','')    <> '' OR coalesce(s->>'state','') <> '' OR coalesce(s->>'postal','') <> '' THEN
        v_parts := v_parts || btrim(concat_ws(' ', concat_ws(', ', nullif(s->>'city',''), nullif(s->>'state','')), nullif(s->>'postal','')));
      END IF;
      IF coalesce(s->>'phone','')   <> '' THEN v_parts := v_parts || (s->>'phone'); END IF;
      IF coalesce(s->>'email','')   <> '' THEN v_parts := v_parts || (s->>'email'); END IF;
      IF coalesce(s->>'website','') <> '' THEN v_parts := v_parts || (s->>'website'); END IF;
      v_out := array_to_string(v_parts, ', ');
      IF v_out = '' THEN v_out := needs(coalesce(p_label,'contact')); END IF;

    WHEN 'person' THEN
      v_parts := ARRAY[]::text[];
      IF coalesce(s->>'name','')    <> '' THEN v_parts := v_parts || (s->>'name'); END IF;
      IF coalesce(s->>'company','') <> '' THEN v_parts := v_parts || (s->>'company'); END IF;
      IF coalesce(s->>'phone','')   <> '' THEN v_parts := v_parts || (s->>'phone'); END IF;
      IF coalesce(s->>'email','')   <> '' THEN v_parts := v_parts || (s->>'email'); END IF;
      v_out := array_to_string(v_parts, ', ');
      IF v_out = '' THEN v_out := needs(coalesce(p_label,'contact')); END IF;

    WHEN 'address' THEN
      v_out := compose_address(s->>'line1', s->>'line2', s->>'city', s->>'state', s->>'postal');
      IF coalesce(v_out,'') = '' THEN v_out := needs(coalesce(p_label,'address')); END IF;

    WHEN 'location' THEN
      v_out := nullif(btrim(concat_ws(' — ', nullif(s->>'name',''),
                 compose_address(s->>'line1', s->>'line2', s->>'city', s->>'state', s->>'postal'))), '');
      IF coalesce(v_out,'') = '' THEN v_out := needs(coalesce(p_label,'location')); END IF;

    WHEN 'percent_split' THEN
      v_split := s->'parties';
      v_parts := ARRAY[]::text[];
      IF v_split IS NOT NULL THEN
        FOR v_e IN SELECT * FROM jsonb_array_elements(v_split) LOOP
          v_parts := v_parts || (party_label(v_e->>'party') || ' ' || coalesce(v_e->>'pct','?') || '%');
        END LOOP;
      END IF;
      v_out := array_to_string(v_parts, ', ');
      IF coalesce(nullif(s->>'note',''),'') <> '' THEN v_out := btrim(v_out || ' (' || (s->>'note') || ')'); END IF;
      IF v_out = '' THEN v_out := needs(coalesce(p_label,'split')); END IF;

    WHEN 'fee_schedule' THEN
      -- initial-payment line + the selected fee option (if one is chosen)
      v_parts := ARRAY[]::text[];
      IF coalesce(nullif(btrim(s->>'initial_due'),''),'') <> '' THEN
        v_parts := v_parts || ('Initial payment due: ' || (s->>'initial_due') || '.');
      END IF;
      v_sel := nullif(s->>'selected','')::int;
      IF v_sel IS NOT NULL AND s->'options' IS NOT NULL
         AND jsonb_array_length(s->'options') > v_sel THEN
        v_opt := (s->'options') -> v_sel;
        v_amt := btrim(coalesce(v_opt->>'amount',''));
        IF v_amt <> '' THEN
          IF left(v_amt,1) <> '$' THEN v_amt := '$' || v_amt; END IF;
          v_out := v_amt || ' due on the first day of each month.';
          IF coalesce(nullif(btrim(v_opt->>'notes'),''),'') <> '' THEN
            v_out := v_out || ' ' || btrim(v_opt->>'notes');
          END IF;
          v_parts := v_parts || v_out;
        END IF;
      END IF;
      v_out := array_to_string(v_parts, ' ');
      IF v_out = '' THEN v_out := needs(coalesce(p_label,'lease fee')); END IF;

    WHEN 'party' THEN
      v_party := s->>'party';
      IF coalesce(v_party,'') = '' THEN
        v_out := needs(coalesce(p_label,'responsible party'));
      ELSIF v_party = 'CARE_PROVIDER' THEN
        v_prov := s->'provider';
        v_out := party_label('CARE_PROVIDER');
        IF coalesce(v_prov->>'name','') <> '' THEN
          v_out := v_out || ' (' || compose_field_prose('person', v_prov, p_label, NULL) || ')';
        ELSE
          v_out := v_out || ' (' || needs('care provider contact') || ')';
        END IF;
      ELSIF v_party = 'OTHER' THEN
        v_out := coalesce(nullif(s->>'note',''), needs(coalesce(p_label,'arrangement')));
      ELSIF v_party = 'SHARED' THEN
        v_out := compose_field_prose('percent_split', s, p_label, NULL);
      ELSE
        v_out := party_label(v_party);
      END IF;

    WHEN 'pair' THEN
      v_manage := s->'manage';
      IF v_manage IS NULL THEN v_manage := s; END IF;
      v_out := compose_field_prose('party', v_manage, p_label, NULL);

    ELSE
      v_out := coalesce(nullif(s->>'value',''), nullif(s->>'text',''), p_value, '');
  END CASE;

  RETURN coalesce(v_out, '');
END;
$function$;

-- the fee-schedule field + the §3.1 clause that renders it.
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   guidance, required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.LEASE_FEE', 'Lease fee', 'LEASE_FEE', 'LESSOR',
   'fee_schedule', 'text',
   'Set the initial payment due, then add one or more monthly fee options. When more than one option is present, select the one that applies.',
   false, false, 10, 'fee_schedule', 'LEASE_FEE.CHOICE');

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'LEASE_FEE', 'LEASE_FEE.CHOICE', NULL,
   '{{TXN.LEASE_FEE}}', 'input', 5, false, NULL);

-- retire the old fee-payments clause + its fields (replaced by the builder).
DELETE FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND clause_key='LEASE_FEE.PAYMENTS';
DELETE FROM contract_field_defs  WHERE template_key='HORSE_LEASE_V2'
  AND field_key IN ('TXN.INITIAL_PAYMENT','TXN.INITIAL_PAYMENT_DATE','TXN.MONTHLY_PAYMENT','TXN.PAYMENT_DAY');
