/*
  # Deal completion (deal plan L1 — "PENDING until its requirements are met,
  # then COMPLETE")

  A deal's requirements are already knowable: deal_document_status(deal) reports,
  per deal type, which documents are REQUIRED and which are EXECUTED. Completion
  is therefore a DERIVED fact, not a button someone has to remember to press —
  so it settles itself the moment the last required document is signed by all
  parties.

    SALE  — the bill of sale is required (it is the dual-signed instrument of
            record under CA Bus. & Prof. Code §19525). The sale agreement is
            optional and does not gate completion; but if one IS present, it
            must also be executed — a half-signed agreement sitting beside a
            signed bill of sale is not a finished deal.
    LEASE — the lease agreement is required and is the only document.

  Three entry points, one rule:
    deal_completion_state(deal) — what is outstanding, for the UI.
    complete_deal(deal)         — settle it now; refuses while anything is
                                  outstanding, so it can never mark a deal
                                  finished that is not.
    trigger on documents        — when a document reaches 'executed', its deal
                                  completes itself if nothing else is left.

  Completion LOCKS the deal: deals.status='complete' already blocks member,
  consideration and document changes in the Stage 2/3 RPCs, so a settled deal
  stops being editable without any new guard.

  reopen_deal(deal) exists for the case a completed deal must be touched again
  (a document voided, a correction). Staff-only, and it is logged.

  NOTE on reopening: completion is DERIVED, so reopening a deal whose documents
  are all still signed only makes it editable until something actually changes —
  the next execution event settles it again. To keep a deal open you must first
  change what made it complete (void or reopen a document). reopen_deal returns
  that fact rather than pretending the deal will stay pending.
*/

-- ── what remains before this deal is finished ───────────────────────────────
CREATE OR REPLACE FUNCTION public.deal_completion_state(p_deal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal    deals%ROWTYPE;
  v_roles   text[];
  v_missing text[] := '{}';
  r         record;
BEGIN
  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;

  v_roles := deal_party_roles(v_deal.deal_type);

  -- configuration must be complete (the same L3 threshold documents need)
  IF NOT EXISTS (SELECT 1 FROM contract_parties WHERE contract_id = v_deal.contract_id AND party_role = v_roles[1]) THEN
    v_missing := v_missing || ('No ' || lower(coalesce(initcap(v_roles[1]), v_roles[1])) || ' named');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM contract_parties WHERE contract_id = v_deal.contract_id AND party_role = v_roles[2]) THEN
    v_missing := v_missing || ('No ' || lower(coalesce(initcap(v_roles[2]), v_roles[2])) || ' named');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM deal_consideration WHERE deal_id = p_deal_id AND party_role = v_roles[1]) THEN
    v_missing := v_missing || (initcap(v_roles[1]) || ' has given nothing');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM deal_consideration WHERE deal_id = p_deal_id AND party_role = v_roles[2]) THEN
    v_missing := v_missing || (initcap(v_roles[2]) || ' has given nothing');
  END IF;

  -- every REQUIRED document must exist and be executed; an OPTIONAL document
  -- that is present must be executed too (a half-signed agreement beside a
  -- signed bill of sale is not a finished deal)
  FOR r IN SELECT * FROM jsonb_to_recordset(deal_document_status(p_deal_id))
             AS x(template_key text, title text, required boolean, present boolean, executed boolean)
  LOOP
    IF r.required AND NOT r.present THEN
      v_missing := v_missing || (r.title || ' has not been prepared');
    ELSIF r.present AND NOT r.executed THEN
      v_missing := v_missing || (r.title || ' is not signed by all parties');
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'deal_id', p_deal_id,
    'status', v_deal.status,
    'completed_at', v_deal.completed_at,
    'can_complete', (v_deal.status = 'pending' AND coalesce(array_length(v_missing, 1), 0) = 0),
    'outstanding', to_jsonb(v_missing));
END;
$function$;

-- ── settle the deal ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_deal(p_deal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal  deals%ROWTYPE;
  v_state jsonb;
  v_out   text;
BEGIN
  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;

  IF v_deal.status = 'complete' THEN
    RETURN jsonb_build_object('completed', false, 'message', 'this deal is already complete');
  END IF;
  IF v_deal.status <> 'pending' THEN
    RAISE EXCEPTION 'this deal is % and cannot be completed', v_deal.status;
  END IF;

  v_state := deal_completion_state(p_deal_id);
  IF NOT (v_state ->> 'can_complete')::boolean THEN
    SELECT string_agg(value, '; ') INTO v_out
      FROM jsonb_array_elements_text(v_state -> 'outstanding');
    RAISE EXCEPTION 'this deal is not finished — %', coalesce(v_out, 'requirements outstanding');
  END IF;

  UPDATE deals SET status = 'complete', completed_at = now() WHERE id = p_deal_id;
  UPDATE contracts SET status = 'executed' WHERE id = v_deal.contract_id AND status <> 'executed';

  RETURN jsonb_build_object('completed', true, 'completed_at', now());
END;
$function$;

-- ── reopen a settled deal (staff, logged) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.reopen_deal(p_deal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_deal deals%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to reopen a deal'; END IF;

  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;
  IF v_deal.status <> 'complete' THEN
    RETURN jsonb_build_object('reopened', false, 'message', 'this deal is not complete');
  END IF;

  UPDATE deals SET status = 'pending', completed_at = NULL WHERE id = p_deal_id;
  UPDATE contracts SET status = 'draft' WHERE id = v_deal.contract_id;

  INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value, new_value)
  VALUES (auth.uid(), 'UPDATE', 'deals', p_deal_id,
          jsonb_build_object('status', 'complete', 'completed_at', v_deal.completed_at),
          jsonb_build_object('status', 'pending', 'reason', 'reopened_by_staff'));

  -- completion is DERIVED: if every document is still signed, this deal already
  -- satisfies its requirements again and the next execution event will settle
  -- it. Say so, rather than implying it will stay open.
  RETURN jsonb_build_object(
    'reopened', true,
    'still_satisfied', (deal_completion_state(p_deal_id) ->> 'can_complete')::boolean,
    'message', CASE WHEN (deal_completion_state(p_deal_id) ->> 'can_complete')::boolean
      THEN 'Reopened, but every requirement is still met — void or reopen a document to keep this deal open.'
      ELSE 'Reopened.' END);
END;
$function$;

-- ── a deal settles itself when its last required document executes ──────────
CREATE OR REPLACE FUNCTION public.deal_autocomplete_on_execution()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal deals%ROWTYPE;
BEGIN
  IF NOT (NEW.workflow_state = 'executed' AND OLD.workflow_state IS DISTINCT FROM 'executed') THEN
    RETURN NEW;
  END IF;
  IF NEW.contract_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_deal FROM deals
   WHERE contract_id = NEW.contract_id AND deleted_at IS NULL AND status = 'pending';
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- only settle when nothing at all is outstanding; otherwise leave it pending
  IF (deal_completion_state(v_deal.id) ->> 'can_complete')::boolean THEN
    UPDATE deals SET status = 'complete', completed_at = now() WHERE id = v_deal.id;
    UPDATE contracts SET status = 'executed' WHERE id = v_deal.contract_id AND status <> 'executed';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS deal_autocomplete_trg ON public.documents;
CREATE TRIGGER deal_autocomplete_trg
  AFTER UPDATE OF workflow_state ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.deal_autocomplete_on_execution();

GRANT EXECUTE ON FUNCTION public.deal_completion_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_deal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_deal(uuid) TO authenticated;
