-- THE ADDED PAYMENT LINES PRINT, AND THE NO-FEE SENTENCE IS CONDITIONAL.
--
-- Owner, 2026-08-26, on a real lease he was about to send:
--   "the payments arent shown other than the intial payment amount... there is no
--    intial payment, only payments made on a per use basis and i added that line
--    to the contract and sent it to my self as pdf for review and it doesnt show
--    up, it only shows the line reading the initial payment amount."
--   "once a payment amount is added if its more than $0 the section of text that
--    reads: 'If no monetary lease fee is payable...' doesnt need to be shown. that
--    text should be conditional against is payment in either intial payment field
--    or any added payment field options, >$0? if yes, dont show the text, if no,
--    show the text."
--
-- ⚠️ HIS LINE WAS NEVER LOST. It is on the live document right now:
--   {"options":[{"notes":"per lesson","amount":"30"}], "initial_due":"0"}
-- The COMPOSER dropped it. compose_field_prose's fee_schedule branch rendered an
-- option only when `selected` named one, and the builder only shows a radio when
-- there are TWO OR MORE options — so a lone option can never be selected through
-- the browser, and composed to nothing. Two defects, one cause:
--
--   ONE option   → could never be chosen, so never printed. It now composes itself,
--                  because a single option is not a choice.
--   TWO OR MORE, none chosen → composed to NOTHING, which on a signed contract
--                  reads as "no fee". It now says what is missing, like every other
--                  unfilled field.
--
-- And the consideration sentence was hardcoded into the LEASE_FEE.CHOICE clause
-- body immediately after {{TXN.LEASE_FEE}}, so it printed unconditionally. It moves
-- to its own clause, gated on a computed flag — because clause_condition_met does
-- equals/contains only, and cannot ask a prose string whether money is moving.

BEGIN;

-- Does this fee schedule move any money? Initial payment OR any option amount.
CREATE OR REPLACE FUNCTION public.lease_fee_payable(s jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(
    coalesce(money_numeric(coalesce(s->>'initial_due','')), 0) > 0
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(coalesce(s->'options','[]'::jsonb)) o
       WHERE coalesce(money_numeric(coalesce(o->>'amount','')), 0) > 0),
    false);
$function$;

CREATE OR REPLACE FUNCTION public.compose_field_prose(p_format text, p_structured jsonb, p_label text, p_value text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  s jsonb := coalesce(p_structured, '{}'::jsonb);
  v_out text; v_party text; v_prov jsonb; v_manage jsonb; v_split jsonb;
  v_parts text[]; v_e jsonb; v_sel int; v_opt jsonb; v_amt text;
  v_num numeric;
BEGIN
  IF p_structured IS NULL OR p_structured = '{}'::jsonb THEN RETURN coalesce(p_value, ''); END IF;
  CASE p_format
    WHEN 'med_schedule' THEN v_out := compose_med_schedule(s);
    WHEN 'reveal_text' THEN v_out := compose_reveal_text(s, p_value);
    WHEN 'yesno' THEN
      v_out := CASE upper(coalesce(s->>'value', p_value, '')) WHEN 'YES' THEN 'Yes' WHEN 'NO' THEN 'No' ELSE coalesce(p_value,'') END;
    WHEN 'contact' THEN
      v_parts := ARRAY[]::text[];
      IF coalesce(s->>'name','')    <> '' THEN v_parts := v_parts || (s->>'name'); END IF;
      IF coalesce(s->>'company','') <> '' THEN v_parts := v_parts || (s->>'company'); END IF;
      IF coalesce(s->>'line1','')   <> '' THEN v_parts := v_parts || (s->>'line1'); END IF;
      IF coalesce(s->>'city','') <> '' OR coalesce(s->>'state','') <> '' OR coalesce(s->>'postal','') <> '' THEN
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
      v_split := s->'parties'; v_parts := ARRAY[]::text[];
      IF v_split IS NOT NULL THEN
        FOR v_e IN SELECT * FROM jsonb_array_elements(v_split) LOOP
          v_parts := v_parts || (party_label(v_e->>'party') || ' ' || coalesce(v_e->>'pct','?') || '%');
        END LOOP;
      END IF;
      v_out := array_to_string(v_parts, ', ');
      IF coalesce(nullif(s->>'note',''),'') <> '' THEN v_out := btrim(v_out || ' (' || (s->>'note') || ')'); END IF;
      IF v_out = '' THEN v_out := needs(coalesce(p_label,'split')); END IF;
    -- LEASEFIX 2026-08-10: the share composite. Authoring is [$|%] + a number;
    -- the composed form puts the symbol where the unit belongs -- before for
    -- currency, after for percent. One field, one party (named in the LABEL),
    -- replacing the per-party pair, the *_SPLIT_TEXT field and the Allocation
    -- field: composition lives in the control, so those had no reason to exist.
    -- A fixed contribution and a proportion are DIFFERENT AGREEMENTS -- 10%
    -- floats with the premium at renewal, $100 does not -- so the unit is stored,
    -- never inferred and never converted.
    WHEN 'share_amount' THEN
      v_num := nullif(regexp_replace(coalesce(s->>'amount',''), '[^0-9.]', '', 'g'), '')::numeric;
      IF v_num IS NULL THEN
        v_out := needs(coalesce(p_label, 'share'));
      ELSIF upper(coalesce(s->>'unit','PCT')) = 'USD' THEN
        v_out := fmt_money(v_num);
      ELSE
        v_out := rtrim(rtrim(to_char(v_num, 'FM999990.99'), '0'), '.') || '%';
      END IF;
    WHEN 'fee_schedule' THEN
      v_parts := ARRAY[]::text[];
      IF coalesce(nullif(btrim(s->>'initial_due'),''),'') <> '' THEN
        DECLARE v_init text := btrim(s->>'initial_due');
        BEGIN
          -- U2.1: a parseable amount is formatted by fmt_money (two decimals,
          -- thousands separators). Anything the user typed as their own wording
          -- with no number in it is left exactly as written.
          v_num := money_numeric(v_init);
          IF v_num IS NOT NULL THEN v_init := fmt_money(v_num); END IF;
          IF coalesce(nullif(btrim(s->>'initial_terms'),''),'') <> '' THEN
            v_parts := v_parts || ('Initial payment due: ' || v_init || ' — ' || btrim(s->>'initial_terms') || '.');
          ELSE
            v_parts := v_parts || ('Initial payment due: ' || v_init || '.');
          END IF;
        END;
      END IF;
      v_sel := nullif(s->>'selected','')::int;
      /* ⚠️ A SINGLE OPTION IS NOT A CHOICE. The builder only shows a radio when
         there are TWO OR MORE options, so a lone option can never be `selected`
         through the browser — and this branch used to require a selection, so
         that option composed to NOTHING and the contract printed only the
         initial-payment line. Owner, 2026-08-26: he added a per-use fee to a real
         lease, sent himself the PDF, and the line was not there.
         One option now composes itself. */
      IF v_sel IS NULL AND s->'options' IS NOT NULL
         AND jsonb_array_length(s->'options') = 1 THEN
        v_sel := 0;
      END IF;
      /* ⚠️ TWO OR MORE AND NO CHOICE MADE IS AN UNANSWERED QUESTION, not silence.
         It used to compose to nothing, which reads as "no fee" on a signed
         contract. It now says what is missing, like every other unfilled field. */
      IF v_sel IS NULL AND s->'options' IS NOT NULL
         AND jsonb_array_length(s->'options') > 1 THEN
        v_parts := v_parts || needs(coalesce(p_label,'lease fee') || ' — no option chosen');
      END IF;
      IF v_sel IS NOT NULL AND s->'options' IS NOT NULL AND jsonb_array_length(s->'options') > v_sel THEN
        v_opt := (s->'options') -> v_sel; v_amt := btrim(coalesce(v_opt->>'amount',''));
        IF v_amt <> '' THEN
          v_num := money_numeric(v_amt);
          IF v_num IS NOT NULL THEN v_amt := fmt_money(v_num);
          ELSIF left(v_amt,1) <> '$' THEN v_amt := '$' || v_amt; END IF;
          v_out := v_amt || '.';
          IF coalesce(nullif(btrim(v_opt->>'notes'),''),'') <> '' THEN v_out := v_out || ' ' || btrim(v_opt->>'notes'); END IF;
          v_parts := v_parts || v_out;
        END IF;
      END IF;
      v_out := array_to_string(v_parts, ' ');
      IF v_out = '' THEN v_out := needs(coalesce(p_label,'lease fee')); END IF;
    WHEN 'party' THEN
      v_party := s->>'party';
      IF coalesce(v_party,'') = '' THEN v_out := needs(coalesce(p_label,'responsible party'));
      ELSIF v_party = 'CARE_PROVIDER' THEN
        v_prov := s->'provider'; v_out := party_label('CARE_PROVIDER');
        IF coalesce(v_prov->>'name','') <> '' THEN v_out := v_out || ' (' || compose_field_prose('person', v_prov, p_label, NULL) || ')';
        ELSE v_out := v_out || ' (' || needs('care provider contact') || ')'; END IF;
      ELSIF v_party = 'OTHER' THEN v_out := coalesce(nullif(s->>'note',''), needs(coalesce(p_label,'arrangement')));
      ELSIF v_party = 'SHARED' THEN v_out := compose_field_prose('percent_split', s, p_label, NULL);
      ELSE v_out := party_label(v_party); END IF;
    WHEN 'pair' THEN
      v_manage := s->'manage'; IF v_manage IS NULL THEN v_manage := s; END IF;
      v_out := compose_field_prose('party', v_manage, p_label, NULL);
    WHEN 'week_grid' THEN v_out := compose_week_grid(s);
    WHEN 'contacts_list' THEN v_out := compose_contacts_list(s);
    WHEN 'certify' THEN
      -- checked → the statement (its label); unchecked → nothing.
      v_out := CASE WHEN upper(coalesce(s->>'value', p_value, '')) = 'YES'
                    THEN coalesce(p_label, '') ELSE '' END;
    ELSE
      v_out := coalesce(nullif(s->>'value',''), nullif(s->>'text',''), p_value, '');
  END CASE;
  RETURN coalesce(v_out, '');
END;
$function$;

CREATE OR REPLACE FUNCTION public.recompose_document_fields(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r RECORD; v_manage jsonb;
BEGIN
  -- 1. every field that has structure → compose its own value
  FOR r IN SELECT field_key, format_type, structured, value, label, pair_manage_key
             FROM contract_fields WHERE document_id = p_document_id LOOP
    IF r.pair_manage_key IS NOT NULL THEN
      CONTINUE;  -- cost children handled in pass 2 (need the manage field's structure)
    END IF;
    IF r.structured IS NOT NULL AND r.structured <> '{}'::jsonb THEN
      UPDATE contract_fields
         SET value = compose_field_prose(r.format_type, r.structured, r.label, r.value),
             updated_at = now()
       WHERE document_id = p_document_id AND field_key = r.field_key;
    END IF;
  END LOOP;

  /* ⚠️ THE FEE-PAYABLE FLAG. A clause cannot ask "is any money changing hands?"
     of a prose string, and clause_condition_met only does equals/contains — so the
     question is answered ONCE, here, and written as an ordinary field the ordinary
     condition mechanism can read. It lands in v_fields because
     remerge_contract_from_clauses calls this function immediately before building
     v_fields from contract_fields.

     Owner, 2026-08-26: "that text should be conditional against is payment in
     either intial payment field or any added payment field options, >$0? if yes,
     dont show the text, if no, show the text." */
  FOR r IN SELECT field_key, structured, org_id
             FROM contract_fields
            WHERE document_id = p_document_id AND format_type = 'fee_schedule' LOOP
    INSERT INTO contract_fields (org_id, document_id, field_key, owner_role, value,
                                 value_type, is_optional, included, sort_order)
    VALUES (r.org_id, p_document_id, 'TXN.LEASE_FEE_PAYABLE', 'SYSTEM',
            CASE WHEN lease_fee_payable(r.structured) THEN 'YES' ELSE 'NO' END,
            'text', true, false, 0)
    ON CONFLICT (document_id, field_key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = now()
      WHERE contract_fields.value IS DISTINCT FROM EXCLUDED.value;
  END LOOP;

  -- 2. pair cost children → compose from the manage field's structure
  FOR r IN SELECT c.field_key, c.label, m.structured AS manage_structured
             FROM contract_fields c
             JOIN contract_fields m ON m.document_id = c.document_id AND m.field_key = c.pair_manage_key
            WHERE c.document_id = p_document_id AND c.pair_manage_key IS NOT NULL LOOP
    IF r.manage_structured IS NOT NULL AND r.manage_structured <> '{}'::jsonb THEN
      UPDATE contract_fields
         SET value = compose_pair_cost(r.manage_structured, r.label), updated_at = now()
       WHERE document_id = p_document_id AND field_key = r.field_key;
    END IF;
  END LOOP;

  -- 3. LEASEFIX 2026-08-09: derived insurance cost allocation. No-ops on every
  --    template that has no TXN.*_POLICY_COST field, i.e. everything but the lease.
  PERFORM compose_insurance_allocation(p_document_id);
END;
$function$;

-- ── THE CLAUSE SPLIT ────────────────────────────────────────────────────────
-- LEASE_FEE.CHOICE keeps the token; the sentence becomes its own conditional
-- clause immediately after it. ⚠️ Applied to EVERY lease template that carries
-- the sentence, not just V2 — all four share this body.
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order,
   is_optional, conditional_on, render_as_subitem)
SELECT cd.template_key, cd.section_key, 'LEASE_FEE.NO_FEE_CONSIDERATION', NULL,
       'If no monetary lease fee is payable under this Agreement, the parties agree that Lessee''s '
       || 'undertakings of care, exercise, and use of the Horse and Lessee''s other obligations under '
       || 'this Agreement constitute good and adequate consideration for this Agreement.',
       cd.clause_type, cd.sort_order + 1, true,
       '{"equals": ["NO"], "field_key": "TXN.LEASE_FEE_PAYABLE"}'::jsonb,
       cd.render_as_subitem
  FROM contract_clause_defs cd
 WHERE cd.clause_key = 'LEASE_FEE.CHOICE'
   AND cd.body LIKE '%good and adequate consideration%'
   AND NOT EXISTS (SELECT 1 FROM contract_clause_defs x
                    WHERE x.template_key = cd.template_key
                      AND x.clause_key = 'LEASE_FEE.NO_FEE_CONSIDERATION');

UPDATE contract_clause_defs
   SET body = btrim(regexp_replace(body,
         'If no monetary lease fee is payable under this Agreement.*?consideration for this Agreement\.',
         '', 'gs'))
 WHERE clause_key = 'LEASE_FEE.CHOICE'
   AND body LIKE '%good and adequate consideration%';

COMMIT;
