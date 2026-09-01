-- Stage 3 Gate-0 + 3d hardening (verification dispositions 2026-07-28):
--
-- 1. Closed-ness becomes DATA: contract_field_defs.closed — when true, the
--    contract UI appends NO synthetic "Other (specify)…" to that select.
--    Backfilled true for the genuinely exhaustive sets (sex, party type,
--    lease type/term, and the party/mode election selects); open-world sets
--    (breed, color, purpose, the owner-designed multi-selects) stay open.
--    contract_fields inherits the flag at instantiation; existing rows
--    backfilled from their defs; contract_document_detail emits it.
--    (PartyPicker's allocation Other is UNTOUCHED — the spec'd ELS escape.)
--
-- 2. horse_page_detail: org_id filter added for parity with can_list_horse
--    (defense-in-depth on the multi-tenant claim).

-- ── 1a. The flag on defs + instantiated fields ──────────────────────────────
ALTER TABLE contract_field_defs ADD COLUMN closed boolean NOT NULL DEFAULT false;
ALTER TABLE contract_fields     ADD COLUMN closed boolean NOT NULL DEFAULT false;

UPDATE contract_field_defs SET closed = true
 WHERE input_kind = 'select'
   AND (field_key IN ('HORSE.SEX','LESSEE.PARTY_TYPE','TXN.LEASE_TYPE','TXN.LEASE_TERM_TYPE',
                      'TXN.OFFSITE_TRANSPORT','TXN.COMPETITION_EXPENSES','TXN.COMPETITION_WINNINGS')
     OR field_key ~ '(_RESP|_RESP_MODE|_PREM_RESP|_EXCESS_RESP|_ARRANGE|_COST_PARTY|_POSTURE|_COVERAGE|_ENABLED|_FEE_MODE|_UNIT|_CHOICE)$');

UPDATE contract_fields cf SET closed = fd.closed
  FROM contract_field_defs fd
 WHERE fd.field_key = cf.field_key AND fd.closed
   AND EXISTS (SELECT 1 FROM documents d JOIN contract_templates ct ON ct.id = d.template_id
                WHERE d.id = cf.document_id AND ct.template_key = fd.template_key);

-- ── 1b. Instantiation carries the flag forward ──────────────────────────────
-- start_lease_contract_v2 (or whichever starter copies defs → fields) copies
-- the column list; find every function inserting contract_fields from defs and
-- extend the column list.
DO $$
DECLARE r record; v_src text; v_changed int := 0;
BEGIN
  FOR r IN SELECT p.oid, proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname='public' AND prosrc ILIKE '%INSERT INTO contract_fields%'
              AND prosrc ILIKE '%contract_field_defs%'
  LOOP
    v_src := pg_get_functiondef(r.oid);
    IF v_src ILIKE '%closed%' THEN CONTINUE; END IF;
    -- the two def-copier shapes in this repo (verified against live prosrc):
    v_src := replace(v_src,
      'value_type, input_kind, format_type, options, conditional_on, guidance,',
      'value_type, input_kind, format_type, options, conditional_on, closed, guidance,');
    v_src := replace(v_src,
      'd.value_type, nullif(d.input_kind,''''), d.format_type, d.options, d.conditional_on, d.guidance,',
      'd.value_type, nullif(d.input_kind,''''), d.format_type, d.options, d.conditional_on, d.closed, d.guidance,');
    v_src := replace(v_src,
      'required, sort_order, parent_field_key, input_kind, options, conditional_on,',
      'required, sort_order, parent_field_key, input_kind, options, conditional_on, closed,');
    v_src := replace(v_src,
      'cd.value_type, cd.required, cd.sort_order, cd.parent_field_key, cd.input_kind,
          cd.options, cd.conditional_on, cd.guidance, cd.is_optional,',
      'cd.value_type, cd.required, cd.sort_order, cd.parent_field_key, cd.input_kind,
          cd.options, cd.conditional_on, cd.closed, cd.guidance, cd.is_optional,');
    IF v_src ILIKE '%closed%' THEN
      EXECUTE v_src;
      v_changed := v_changed + 1;
      RAISE NOTICE 'closed-flag propagated into %', r.proname;
    ELSE
      RAISE NOTICE 'SKIPPED % — column list shape not recognized (flag defaults false there)', r.proname;
    END IF;
  END LOOP;
END $$;

-- ── 1c. Emission: contract_document_detail includes the flag ────────────────
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='contract_document_detail';
  v_src := replace(v_src,
    $o$'options', cf.options, 'conditional_on', cf.conditional_on, 'guidance', cf.guidance,$o$,
    $n$'options', cf.options, 'conditional_on', cf.conditional_on, 'guidance', cf.guidance,
           'closed', coalesce(cf.closed, false),$n$);
  IF v_src NOT ILIKE '%''closed''%' THEN
    RAISE EXCEPTION 'contract_document_detail closed-flag emission incomplete';
  END IF;
  EXECUTE v_src;
END $$;

-- ── 2. horse_page_detail org boundary ───────────────────────────────────────
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='horse_page_detail';
  v_src := replace(v_src,
    'SELECT * INTO v_h FROM horses WHERE id = p_horse_id AND deleted_at IS NULL;',
    'SELECT * INTO v_h FROM horses WHERE id = p_horse_id AND org_id = current_org() AND deleted_at IS NULL;');
  IF v_src NOT ILIKE '%org_id = current_org()%' THEN
    RAISE EXCEPTION 'horse_page_detail org-filter rewrite incomplete';
  END IF;
  EXECUTE v_src;
END $$;
