-- CR-126 fix — cost_split now has a top-level responsibility choice (the gate the
-- owner asked for): Buyer / Seller / Split. The composer must honour it: BUYER →
-- "the Buyer", SELLER → "the Seller", SPLIT → the existing %/$ allocation. Previously
-- it only read `mode` (PCT/USD) and never the party, so a plain Buyer/Seller choice
-- composed nothing. In-place rewrite of compose_field_prose's cost_split branch.

DO $cr126_costsplit$
DECLARE
  v_def text;
  -- add v_party to the branch's declarations
  v_old_decl text := '        v_bt text; v_st text; v_n numeric;
        fmt_pct text; fmt_usd text;
      BEGIN
        IF v_mode = ''PCT'' THEN';
  v_new_decl text := '        v_bt text; v_st text; v_n numeric;
        fmt_pct text; fmt_usd text;
        v_party text := upper(coalesce(s->>''party'','''' ));
      BEGIN
        -- the GATE: an explicit Buyer / Seller is a single-party allocation; only
        -- Split (or a legacy value with no party but filled split sets) uses the %/$.
        IF v_party = ''BUYER'' THEN v_out := party_label(''BUYER'');
        ELSIF v_party = ''SELLER'' THEN v_out := party_label(''SELLER'');
        ELSIF v_party <> '''' AND v_party <> ''SPLIT'' THEN v_out := needs(coalesce(p_label,''allocation''));
        ELSIF v_mode = ''PCT'' THEN';
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc
    WHERE proname='compose_field_prose' AND pronamespace='public'::regnamespace;
  IF position(v_old_decl IN v_def) = 0 THEN
    RAISE EXCEPTION 'cost_split branch anchor not found — body changed';
  END IF;
  v_def := replace(v_def, v_old_decl, v_new_decl);
  EXECUTE v_def;
END $cr126_costsplit$;
