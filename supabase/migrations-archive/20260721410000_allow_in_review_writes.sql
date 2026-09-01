-- Allow field writes during 'in_review' (not just editable/editing). What each
-- party may actually change is still governed by their per-party controls
-- (can_fill / can_edit_deal) checked further down in each function; opening the
-- state just lets a party with those controls edit while the doc is in review.
-- Locked/executed stay read-only.
DO $do$
DECLARE fn text; v_def text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['set_contract_field','set_field_structured'] LOOP
    v_def := pg_get_functiondef(fn::regproc);
    v_def := replace(v_def,
      'IF v_state NOT IN (''editable'',''editing'') THEN',
      'IF v_state NOT IN (''editable'',''editing'',''in_review'') THEN');
    EXECUTE v_def;
  END LOOP;
END $do$;

-- The detail RPC computes per-field can_edit gated on the same states; add in_review
-- so the UI shows fields as editable in review (matching the write path).
DO $do$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('contract_document_detail'::regproc);
  v_def := replace(v_def, 'v_state IN (''editable'',''editing'')', 'v_state IN (''editable'',''editing'',''in_review'')');
  EXECUTE v_def;
END $do$;
