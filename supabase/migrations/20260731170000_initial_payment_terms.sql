-- ─────────────────────────────────────────────────────────────────────────────
-- LEASE FEE: the initial payment gets an AMOUNT and its own TERMS (2026-07-31)
--
-- The initial-payment row was a single free-text box, sized by its own
-- placeholder, so it rendered at an arbitrary width that matched nothing around
-- it. It is now shaped like the fee options directly below: a $-prefixed amount
-- plus a terms field.
--
-- `initial_due` KEEPS holding the amount rather than being renamed, so existing
-- records and every other reader of s->>'initial_due' keep working. The new
-- `initial_terms` sits beside it.
--
-- The composer previously emitted the raw string:
--     'Initial payment due: ' || (s->>'initial_due') || '.'
-- which for an amount of "250" produced "Initial payment due: 250." — no
-- currency mark. It now prefixes $ when the value is numeric (leaving any value
-- the user typed with its own symbol alone) and appends the terms when present.
-- ─────────────────────────────────────────────────────────────────────────────

DO $do$
DECLARE
  v_def text;
  v_old text := '        v_parts := v_parts || (''Initial payment due: '' || (s->>''initial_due'') || ''.'');';
  v_new text :=
      '        DECLARE v_init text := btrim(s->>''initial_due'');' || E'\n'
   || '        BEGIN' || E'\n'
   || '          -- Numeric values get a currency mark; anything the user typed with' || E'\n'
   || '          -- its own symbol or wording is left exactly as written.' || E'\n'
   || '          IF v_init ~ ''^[0-9]+(\.[0-9]+)?$'' THEN v_init := ''$'' || v_init; END IF;' || E'\n'
   || '          IF coalesce(nullif(btrim(s->>''initial_terms''),''''),'''') <> '''' THEN' || E'\n'
   || '            v_parts := v_parts || (''Initial payment due: '' || v_init || '' — '' || btrim(s->>''initial_terms'') || ''.'');' || E'\n'
   || '          ELSE' || E'\n'
   || '            v_parts := v_parts || (''Initial payment due: '' || v_init || ''.'');' || E'\n'
   || '          END IF;' || E'\n'
   || '        END;';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'compose_field_prose';
  IF v_def IS NULL THEN RAISE EXCEPTION 'compose_field_prose not found'; END IF;

  IF position('initial_terms' in v_def) > 0 THEN
    RAISE NOTICE 'compose_field_prose already handles initial_terms — skipping';
  ELSIF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'compose_field_prose body changed shape — re-derive the patch';
  ELSE
    EXECUTE replace(v_def, v_old, v_new);
    RAISE NOTICE 'compose_field_prose now renders the initial payment amount + terms';
  END IF;
END
$do$;
