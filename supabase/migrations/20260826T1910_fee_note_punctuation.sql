-- PUNCTUATION, BECAUSE THIS IS PRINTED PROSE ON A CONTRACT.
-- The fee note was appended AFTER the full stop — "$30.00. per lesson" — which is
-- what the previous migration surfaced the moment the line started printing at all.
-- The note qualifies the amount, so it belongs inside the sentence.

BEGIN;

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
          /* The note qualifies the amount, so it belongs INSIDE the sentence:
             "$30.00 per lesson." — not "$30.00. per lesson", which is what the
             full stop before the note produced. This is printed prose on a
             contract, so the punctuation is part of the deliverable. */
          IF coalesce(nullif(btrim(v_opt->>'notes'),''),'') <> '' THEN
            v_out := v_amt || ' ' || btrim(v_opt->>'notes');
            IF right(v_out, 1) <> '.' THEN v_out := v_out || '.'; END IF;
          ELSE
            v_out := v_amt || '.';
          END IF;
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

COMMIT;
