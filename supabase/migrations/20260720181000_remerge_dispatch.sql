/*
  # Remerge dispatcher — clause composer for clause templates, flat for legacy

  remerge_contract_body(doc) tries the clause composer first; if the document's
  template has clause defs it composes the numbered clause body and returns it,
  otherwise it falls back to the legacy flat remerge. This lets clause templates
  (HORSE_LEASE_V2) and legacy flat templates (HORSE_LEASE) coexist during cutover.

  We repoint the ASCII-safe field writer (set_field_structured) at the dispatcher.
  The remaining legacy callers keep using the flat remerge directly — harmless,
  since those functions run on legacy docs; when a clause doc reaches them the
  clause path has already produced the body and the flat remerge is a no-op on a
  template whose tokens the flat logic can't find (it just re-substitutes from the
  same fields). To be safe we ALSO have remerge_contract_from_clauses win by
  running last in set_field_structured.
*/

CREATE OR REPLACE FUNCTION public.remerge_contract_body(p_document_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_body text;
BEGIN
  v_body := remerge_contract_from_clauses(p_document_id);   -- NULL if no clause defs
  IF v_body IS NOT NULL THEN
    RETURN v_body;
  END IF;
  RETURN remerge_contract_from_fields(p_document_id);
END;
$fn$;
REVOKE ALL ON FUNCTION remerge_contract_body(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION remerge_contract_body(uuid) TO authenticated, service_role;


-- Repoint set_field_structured's final remerge at the dispatcher (ASCII-safe fn).
DO $patch$
DECLARE v_def text; v_new text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc WHERE proname='set_field_structured';
  v_new := replace(v_def,
    E'PERFORM remerge_contract_from_fields(p_document_id);',
    E'PERFORM remerge_contract_body(p_document_id);');
  IF v_new = v_def THEN RAISE EXCEPTION 'remerge call not found in set_field_structured'; END IF;
  EXECUTE v_new;
END $patch$;

-- Repoint set_contract_field too if it calls the flat remerge (ASCII-safe).
DO $patch2$
DECLARE v_def text; v_new text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc WHERE proname='set_contract_field';
  IF position('remerge_contract_from_fields' in v_def) > 0 THEN
    v_new := replace(v_def,
      E'remerge_contract_from_fields(p_document_id)',
      E'remerge_contract_body(p_document_id)');
    EXECUTE v_new;
  END IF;
END $patch2$;
