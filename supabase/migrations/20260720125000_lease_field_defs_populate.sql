/*
  # Phase 4c (M-8, step 1/2) — populate contract_field_defs for HORSE_LEASE

  Makes contract_field_defs the single source of truth for the lease field set by
  extracting the CURRENT inline seed from start_lease_contract — faithfully and
  entirely server-side (no shell round-trip, no auth-gated seed call). The seed is
  the jsonb_build_array(...) argument to seed_contract_fields inside the live
  function; we parse it to jsonb via a temp function and expand it into rows.

  INSERT-only into an empty table; start_lease_contract is NOT changed in this
  step. Step 2 (separate migration, validated) switches the function to read here.
*/

DO $migrate$
DECLARE
  v_def   text;
  v_arr   text;
  v_count int;
BEGIN
  IF EXISTS (SELECT 1 FROM contract_field_defs WHERE template_key = 'HORSE_LEASE') THEN
    RAISE NOTICE 'HORSE_LEASE defs already present — skipping';
    RETURN;
  END IF;

  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc WHERE proname = 'start_lease_contract';
  v_arr := (regexp_match(v_def,
    'seed_contract_fields\(v_doc,\s*(jsonb_build_array\(.*?\))\s*\);', 'ns'))[1];
  IF v_arr IS NULL THEN RAISE EXCEPTION 'could not locate lease seed array'; END IF;

  -- temp function returns the array as jsonb (server-side eval, no auth gate)
  EXECUTE 'CREATE OR REPLACE FUNCTION pg_temp._lease_seed() RETURNS jsonb LANGUAGE sql AS $f$ SELECT '
          || v_arr || ' $f$';

  INSERT INTO contract_field_defs (
    template_key, field_key, parent_field_key, label, section, owner_role,
    input_kind, value_type, options, conditional_on, guidance, required,
    is_optional, responsibility, sort_order, format_type)
  SELECT
    'HORSE_LEASE',
    e->>'field_key',
    e->>'parent_field_key',
    e->>'label',
    e->>'section',
    e->>'owner_role',
    -- derive input_kind exactly as seed_contract_fields does when the seed omits it
    CASE
      WHEN coalesce(e->>'input_kind','') <> '' THEN e->>'input_kind'
      WHEN (e->>'value_type') = 'longtext' THEN 'longtext'
      WHEN (e->>'value_type') = 'currency' THEN 'currency'
      WHEN (e->>'value_type') = 'date'     THEN 'date'
      WHEN (e->>'value_type') = 'select'   THEN 'select'
      WHEN (e->>'value_type') = 'checkbox' THEN 'buttons'
      ELSE 'text'
    END,
    coalesce(nullif(e->>'value_type',''), 'text'),
    CASE WHEN e ? 'options'        THEN e->'options'        ELSE NULL END,
    CASE WHEN e ? 'conditional_on' THEN e->'conditional_on' ELSE NULL END,
    e->>'guidance',
    coalesce((e->>'required')::boolean, false),
    coalesce((e->>'is_optional')::boolean, false),
    CASE WHEN e ? 'responsibility' THEN e->'responsibility' ELSE NULL END,
    (e->>'sort_order')::int,
    e->>'format_type'
  FROM jsonb_array_elements(pg_temp._lease_seed()) e;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'populated % HORSE_LEASE field defs', v_count;
  IF v_count < 50 THEN
    RAISE EXCEPTION 'too few defs extracted (%) — aborting', v_count;
  END IF;
END
$migrate$;
