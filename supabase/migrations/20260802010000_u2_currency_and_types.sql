-- U2.1 — CURRENCY, END TO END
-- Spec: master-finishing-plan.md U2.1. Verify-first: compose_field_prose was
-- rebuilt as a full CREATE OR REPLACE from its LIVE pg_get_functiondef body
-- captured 2026-08-01.
--
-- WHAT THE LIVE SYSTEM ACTUALLY SHOWED (the plan's premise was wrong on both
-- halves, so the fix differs from the one it describes):
--
--   * The plan calls HORSE.FAIR_MARKET_VALUE "the model" because it renders
--     "$45,000.00". It renders correctly only because the FORMATTED STRING is
--     what is stored. That is the anti-model — U2.1 requires numeric storage
--     with the symbol applied at render.
--   * The plan says to route the bare-rendering lease fee through the money
--     formatter. Routing alone fixes nothing: compose_field_prose's
--     fee_schedule branch parses a JSON OBJECT, and every live TXN.LEASE_FEE
--     value is a plain string, so the value never reaches the formatter at
--     all. Document b7446f9e (value '850') rendered ⟦NEEDS:Lease fee⟧ — a
--     missing-value placeholder, not a formatting error.
--   * fmt_money was genuinely never applied: the branch bare-concatenated '$',
--     so 8500.5 rendered "$8500.5" rather than "$8,500.50".
--
-- OWNER RULING (2026-08-01) — status-keyed, covering the whole money class:
--   EXECUTED documents are never touched; the frozen merged body is the
--   instrument and the rows beneath it are historical inputs. Unexecuted
--   (editable) documents repair to canonical. Never invent a number:
--   unrecoverable components clear to unset so the editor requires them
--   honestly.

BEGIN;

-- ============================================================================
-- U2.1a — money normalizer, used by both the render path and the write guard
-- ============================================================================
-- Accepts anything a human or a legacy row might hold ('850', '$45,000.00',
-- '1 200.50') and returns the numeric, or NULL when there is no number in it.
-- This is the single definition of "is this a money value" for the codebase.
CREATE OR REPLACE FUNCTION public.money_numeric(p_raw text)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN p_raw IS NULL THEN NULL
    WHEN btrim(regexp_replace(p_raw, '[^0-9.\-]', '', 'g')) IN ('', '-', '.', '-.') THEN NULL
    ELSE btrim(regexp_replace(p_raw, '[^0-9.\-]', '', 'g'))::numeric
  END
$function$;

COMMENT ON FUNCTION public.money_numeric(text) IS
  'Extracts the numeric value from any money-shaped string. NULL when no number is present. Paired with fmt_money for render.';

-- ============================================================================
-- U2.1b — render path: fee_schedule amounts go through fmt_money
-- ============================================================================
-- Full replacement from the live body. The ONLY changes are inside the
-- 'fee_schedule' branch: both amount sites (initial_due and the selected
-- option) now normalize then format, so '850' -> '$850.00' and '8500.5' ->
-- '$8,500.50'. A value the user typed with their own wording and no parseable
-- number is still passed through untouched, exactly as before.
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

COMMIT;
