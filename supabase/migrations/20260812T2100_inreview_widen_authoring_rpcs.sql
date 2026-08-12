-- INREVIEW — widen five authoring RPCs to accept workflow_state 'in_review'.
--
-- WHY. D14 (CLAUDE.md): signability is gated by field completeness, not by
-- workflow state. The safeguard against an authored change going unnoticed is the
-- review flow (seen-on-signature-click = approved), not a lock on the document
-- while it is out with the counterparty. The lock was blocking exactly the case it
-- exists to protect: adding a clause while `in_review`. `executed` and `void` are
-- unaffected — an executed document changes only by supersession (D14 §5).
--
-- METHOD. Guard-only, exact-substring rewrite of each function's existing state
-- check — never a re-typed body — so it is structurally impossible for this
-- migration to touch anything but the state list. Every replacement asserts its
-- expected occurrence count first and re-checks the catalog afterwards, so a
-- silent no-op cannot pass as success.

DO $migration$
DECLARE
  -- fn signature | old fragment | new fragment | expected occurrences
  v_edits text[][] := ARRAY[
    ['public.add_contract_composition(uuid,jsonb)',
     E'IF v_state NOT IN (\'editable\',\'editing\') THEN RAISE EXCEPTION \'document is not editable\'; END IF;',
     E'IF v_state NOT IN (\'editable\',\'editing\',\'in_review\') THEN RAISE EXCEPTION \'document is not editable\'; END IF;', '1'],
    ['public.remove_contract_composition(uuid,text)',
     E'IF v_state NOT IN (\'editable\',\'editing\') THEN RAISE EXCEPTION \'document is not editable\'; END IF;',
     E'IF v_state NOT IN (\'editable\',\'editing\',\'in_review\') THEN RAISE EXCEPTION \'document is not editable\'; END IF;', '1'],
    ['public.add_contract_element(uuid,text,text,text,integer,text,text,jsonb,text)',
     E'IF v_state NOT IN (\'editable\',\'editing\') THEN RAISE EXCEPTION \'document is not editable\'; END IF;',
     E'IF v_state NOT IN (\'editable\',\'editing\',\'in_review\') THEN RAISE EXCEPTION \'document is not editable\'; END IF;', '1'],
    ['public.propose_clause(uuid,text)',
     E'IF v_state NOT IN (\'editable\',\'editing\') THEN RAISE EXCEPTION \'the document is not open for changes\'; END IF;',
     E'IF v_state NOT IN (\'editable\',\'editing\',\'in_review\') THEN RAISE EXCEPTION \'the document is not open for changes\'; END IF;', '1'],
    ['public.set_field_included(uuid,text,boolean)',
     E'IF v_state NOT IN (\'editable\',\'editing\') THEN RAISE EXCEPTION \'document is not editable\'; END IF;',
     E'IF v_state NOT IN (\'editable\',\'editing\',\'in_review\') THEN RAISE EXCEPTION \'document is not editable\'; END IF;', '1']
  ];
  v_sig text; v_old text; v_new text; v_want int;
  v_oid oid; v_def text; v_seen int;
  i int;
BEGIN
  FOR i IN 1 .. array_length(v_edits, 1) LOOP
    v_sig  := v_edits[i][1];
    v_old  := v_edits[i][2];
    v_new  := v_edits[i][3];
    v_want := v_edits[i][4]::int;

    v_oid := v_sig::regprocedure::oid;
    v_def := pg_get_functiondef(v_oid);

    v_seen := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    IF v_seen <> v_want THEN
      RAISE EXCEPTION 'INREVIEW %: expected % occurrence(s) of the state-check fragment, found %. Refusing.',
        v_sig, v_want, v_seen;
    END IF;

    v_def := replace(v_def, v_old, v_new);
    EXECUTE v_def;

    -- re-read from the catalog: prove the new text actually landed and nothing else moved
    v_def := pg_get_functiondef(v_sig::regprocedure::oid);
    IF position(v_new in v_def) = 0 THEN
      RAISE EXCEPTION 'INREVIEW %: post-write verify failed, new state check not present.', v_sig;
    END IF;
    IF position(v_old in v_def) > 0 THEN
      RAISE EXCEPTION 'INREVIEW %: post-write verify failed, old state check still present.', v_sig;
    END IF;

    RAISE NOTICE 'INREVIEW ok: %', v_sig;
  END LOOP;
END
$migration$;
