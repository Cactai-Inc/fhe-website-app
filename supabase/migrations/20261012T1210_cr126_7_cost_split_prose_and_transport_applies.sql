-- CR-126 round 2 — the two computed pieces behind #5 (cost_split prose) and #7
-- (location-aware transport). In-place function rewrites (repo convention), not
-- replayable on a fresh DB.

-- ── #7a: the derived TRANSPORT_APPLIES field ─────────────────────────────────
-- A SYSTEM field computed in recompose_document_fields (like TXN.LEASE_FEE_PAYABLE),
-- because clause_condition_met only does equals/contains and cannot compare two
-- locations. The transport clause gates on it (set in cr126_6).
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   format_type, required, is_optional, sort_order, closed)
SELECT 'HORSE_SALE_V2','TXN.TRANSPORT_APPLIES','Transport applies','DELIVERY','SYSTEM',
       'text','text','text', false, true, 424, false
 WHERE NOT EXISTS (SELECT 1 FROM contract_field_defs
                    WHERE template_key='HORSE_SALE_V2' AND field_key='TXN.TRANSPORT_APPLIES');

-- ── #7b: location comparison helper ──────────────────────────────────────────
-- Compares two locations given both their structured form (delivery/trial carry it)
-- and their composed text (the horse's current location is text-only). Match is on
-- the normalised NAME when both have one, else on the normalised full text. Returns
-- NULL (unknown) when either side is empty, so an unanswered location never forces a
-- transport sentence on.
CREATE OR REPLACE FUNCTION public.locations_match(
  p_a_struct jsonb, p_a_text text, p_b_struct jsonb, p_b_text text
) RETURNS boolean
 LANGUAGE sql IMMUTABLE
AS $function$
  WITH norm AS (
    SELECT
      lower(btrim(coalesce(p_a_struct->>'name',''))) AS a_name,
      lower(btrim(coalesce(p_b_struct->>'name',''))) AS b_name,
      -- strip punctuation/space so "Carmel Creek Ranch — …" and "Carmel Creek
      -- Ranch, …" compare equal on the leading identity
      lower(regexp_replace(coalesce(p_a_text,''), '[^a-z0-9]+', '', 'gi')) AS a_full,
      lower(regexp_replace(coalesce(p_b_text,''), '[^a-z0-9]+', '', 'gi')) AS b_full
  )
  SELECT CASE
    WHEN (a_full = '' OR b_full = '') THEN NULL          -- unknown: don't force a decision
    WHEN a_name <> '' AND b_name <> '' THEN a_name = b_name
    -- one side has no structured name (e.g. the horse's text-only current location):
    -- fall back to a prefix test so "<name>…" on each side still matches on identity
    WHEN a_name <> '' THEN b_full LIKE lower(regexp_replace(a_name,'[^a-z0-9]+','','gi')) || '%'
    WHEN b_name <> '' THEN a_full LIKE lower(regexp_replace(b_name,'[^a-z0-9]+','','gi')) || '%'
    ELSE a_full = b_full
  END
  FROM norm
$function$;
-- REVOKE FROM PUBLIC alone is not enough: a fresh function inherits Supabase's
-- default grants to anon + authenticated, so revoke those by name too.
REVOKE EXECUTE ON FUNCTION public.locations_match(jsonb,text,jsonb,text) FROM anon, authenticated, PUBLIC;

-- ── #7c: compute TRANSPORT_APPLIES in recompose_document_fields ──────────────
DO $cr126_recompose$
DECLARE
  v_def text;
  v_anchor text := '  -- 3. LEASEFIX 2026-08-09: derived insurance cost allocation.';
  v_block text := $block$  -- CR-126 #7: transport applies when the delivery location differs from the
  -- handoff origin — the trial location if a trial is elected, else the horse's
  -- current location. Compared over structured + text so a manually-typed address
  -- is recognised, not only a picked one. Written as an ordinary field the gate
  -- can read (delivery gate is TXN.TRANSPORT_APPLIES = YES).
  IF EXISTS (SELECT 1 FROM contract_fields
              WHERE document_id = p_document_id AND field_key = 'TXN.DELIVERY_LOCATION') THEN
    DECLARE
      v_del   RECORD; v_origin RECORD; v_trial_on boolean; v_match boolean; v_org2 uuid;
    BEGIN
      SELECT org_id INTO v_org2 FROM documents WHERE id = p_document_id;
      SELECT structured, value INTO v_del FROM contract_fields
        WHERE document_id = p_document_id AND field_key = 'TXN.DELIVERY_LOCATION';
      v_trial_on := upper(coalesce((SELECT value FROM contract_fields
        WHERE document_id = p_document_id AND field_key = 'TXN.TRIAL_ENABLED'), '')) = 'YES';
      IF v_trial_on THEN
        SELECT structured, value INTO v_origin FROM contract_fields
          WHERE document_id = p_document_id AND field_key = 'TXN.TRIAL_LOCATION';
      ELSE
        SELECT structured, value INTO v_origin FROM contract_fields
          WHERE document_id = p_document_id AND field_key = 'HORSE.CURRENT_LOCATION';
      END IF;
      v_match := locations_match(v_del.structured, v_del.value, v_origin.structured, v_origin.value);
      INSERT INTO contract_fields (org_id, document_id, field_key, owner_role, value,
                                   value_type, is_optional, included, sort_order)
      VALUES (v_org2, p_document_id, 'TXN.TRANSPORT_APPLIES', 'SYSTEM',
              -- transport applies when the two are KNOWN to differ (match = false).
              -- Unknown (NULL) or same (true) => no transport sentence.
              CASE WHEN v_match IS FALSE THEN 'YES' ELSE 'NO' END,
              'text', true, false, 0)
      ON CONFLICT (document_id, field_key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = now()
        WHERE contract_fields.value IS DISTINCT FROM EXCLUDED.value;
    END;
  END IF;

$block$;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc
    WHERE proname='recompose_document_fields' AND pronamespace='public'::regnamespace;
  IF position(v_anchor IN v_def) = 0 THEN
    RAISE EXCEPTION 'recompose_document_fields anchor not found — body changed';
  END IF;
  v_def := replace(v_def, v_anchor, v_block || v_anchor);
  EXECUTE v_def;
END $cr126_recompose$;

-- ── #5: cost_split prose in compose_field_prose ──────────────────────────────
-- Structure: { mode:'PCT'|'USD',
--   pct: { buyer:'60', seller:'40' },
--   usd: { buyer:{amount:'500'}, seller:{remaining:true} | {amount:'…'} } }
-- A single party at 100% / all => "the Buyer" (so the sentence reads "...borne by
-- the Buyer"). A split => "the Seller as to 60% and the Buyer as to 40%" or
-- "the Buyer as to $500.00 and the Seller as to the remaining cost".
DO $cr126_prose$
DECLARE
  v_def text;
  v_anchor text := '    ELSE
      v_out := coalesce(nullif(s->>''value'','''')';
  v_block text := $block$    WHEN 'cost_split' THEN
      DECLARE
        v_mode text := upper(coalesce(s->>'mode',''));
        v_bp text := nullif(btrim(coalesce(s#>>'{pct,buyer}','')),'');
        v_sp text := nullif(btrim(coalesce(s#>>'{pct,seller}','')),'');
        v_bu text := nullif(btrim(coalesce(s#>>'{usd,buyer,amount}','')),'');
        v_su text := nullif(btrim(coalesce(s#>>'{usd,seller,amount}','')),'');
        v_br boolean := coalesce((s#>>'{usd,buyer,remaining}')::boolean, false);
        v_sr boolean := coalesce((s#>>'{usd,seller,remaining}')::boolean, false);
        v_bt text; v_st text; v_n numeric;
        fmt_pct text; fmt_usd text;
      BEGIN
        IF v_mode = 'PCT' THEN
          -- normalise: if only one side given, the other is 100 - it
          IF v_bp IS NOT NULL AND v_sp IS NULL THEN v_sp := (100 - v_bp::numeric)::text; END IF;
          IF v_sp IS NOT NULL AND v_bp IS NULL THEN v_bp := (100 - v_sp::numeric)::text; END IF;
          IF v_bp IS NULL AND v_sp IS NULL THEN v_out := needs(coalesce(p_label,'allocation'));
          ELSIF coalesce(v_bp,'0')::numeric = 100 THEN v_out := party_label('BUYER');
          ELSIF coalesce(v_sp,'0')::numeric = 100 THEN v_out := party_label('SELLER');
          ELSIF coalesce(v_bp,'0')::numeric = 0 THEN v_out := party_label('SELLER');
          ELSIF coalesce(v_sp,'0')::numeric = 0 THEN v_out := party_label('BUYER');
          ELSE
            -- format each % without mangling whole numbers: trim_scale drops only the
            -- insignificant decimal zeros (60.0 -> 60, 60.50 -> 60.5, 60 -> 60).
            fmt_pct := trim_scale(v_sp::numeric)::text;
            fmt_usd := trim_scale(v_bp::numeric)::text;
            v_out := party_label('SELLER') || ' as to ' || fmt_pct || '% and '
                  || party_label('BUYER')  || ' as to ' || fmt_usd || '%';
          END IF;
        ELSIF v_mode = 'USD' THEN
          -- compose each side's phrase: a dollar figure, or "the remaining cost"
          IF v_br THEN v_bt := 'the remaining cost';
          ELSIF v_bu IS NOT NULL THEN v_n := money_numeric(v_bu); v_bt := CASE WHEN v_n IS NOT NULL THEN fmt_money(v_n) ELSE '$'||v_bu END; END IF;
          IF v_sr THEN v_st := 'the remaining cost';
          ELSIF v_su IS NOT NULL THEN v_n := money_numeric(v_su); v_st := CASE WHEN v_n IS NOT NULL THEN fmt_money(v_n) ELSE '$'||v_su END; END IF;
          IF v_bt IS NULL AND v_st IS NULL THEN v_out := needs(coalesce(p_label,'allocation'));
          ELSIF v_bt IS NOT NULL AND v_st IS NULL THEN v_out := party_label('BUYER') || ' as to ' || v_bt;
          ELSIF v_st IS NOT NULL AND v_bt IS NULL THEN v_out := party_label('SELLER') || ' as to ' || v_st;
          ELSE v_out := party_label('SELLER') || ' as to ' || v_st || ' and ' || party_label('BUYER') || ' as to ' || v_bt;
          END IF;
        ELSE
          v_out := needs(coalesce(p_label,'allocation'));
        END IF;
      END;
$block$;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc
    WHERE proname='compose_field_prose' AND pronamespace='public'::regnamespace;
  IF position(v_anchor IN v_def) = 0 THEN
    RAISE EXCEPTION 'compose_field_prose ELSE anchor not found — body changed';
  END IF;
  v_def := replace(v_def, v_anchor, v_block || v_anchor);
  EXECUTE v_def;
END $cr126_prose$;
