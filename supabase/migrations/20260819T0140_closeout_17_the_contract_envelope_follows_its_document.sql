-- CLOSEOUT §1.7 (CONTRACTWALK B3) — deal_autocomplete_on_execution was dead for
-- every lease.
--
-- Measured 2026-08-19: prod has 0 deals rows and 0 contracts rows. create_deal
-- (the DealsPage flow) is the ONLY writer of deals; start_lease_contract_v2 /
-- start_sale_contract / start_bill_of_sale_standalone create a contracts row
-- but never a deal. So for every contract started from New Contract, this
-- trigger found no deal and returned — and contracts.status stayed 'draft'
-- beside an EXECUTED governing document, forever.
--
-- The trigger is NOT retired: it is the completing half of the reachable
-- DealsPage flow, and its deal logic is correct. The fix is the missing half:
-- when the GOVERNING document (lease / sale / standalone bill of sale — the
-- same predicate apply_contract_execution_effects uses) executes, the contract
-- envelope itself advances to 'executed', deal or no deal. The deal, when one
-- exists, still completes only by its own stricter rules (parties named,
-- governing document signed by all).
--
-- Attachment documents (HORSE_EMERGENCY_VET, RELEASE_HORSE_CARE) share the
-- lease's contract_id but are NOT governing — executing one of those alone
-- must not mark the contract executed; the template predicate excludes them.

CREATE OR REPLACE FUNCTION public.deal_autocomplete_on_execution()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal deals%ROWTYPE;
  v_key  text;
  v_kind text;
BEGIN
  IF NOT coalesce(NEW.workflow_state = 'executed' AND OLD.workflow_state IS DISTINCT FROM 'executed', false) THEN
    RETURN NEW;
  END IF;
  IF NEW.contract_id IS NULL THEN RETURN NEW; END IF;

  -- CLOSEOUT §1.7: the envelope follows its governing document.
  SELECT template_key, contract_kind INTO v_key, v_kind
    FROM contract_templates WHERE id = NEW.template_id;
  IF is_horse_lease_template(v_key)
     OR v_key = 'HORSE_PURCHASE_SALE'
     OR coalesce(v_kind, '') IN ('HORSE_SALE', 'HORSE_BILL_OF_SALE') THEN
    UPDATE contracts
       SET status = 'executed', signed_at = coalesce(signed_at, now())
     WHERE id = NEW.contract_id AND status <> 'executed';
  END IF;

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
