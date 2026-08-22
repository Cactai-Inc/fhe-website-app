-- DEALAUTO §3 (correction, found by probe) — a finished signing set IS the
-- delivery event.
--
-- WHAT THE PROBE FOUND. With migrations 1-5 in place, a full lease was signed
-- end to end in a rolled-back transaction — lease, vet authorization, care
-- release, company policies, facility rules, five documents, five executions —
-- and `net.http_request_queue` was EMPTY at the end. Not one email. All five
-- documents sat with `delivery_held_at` set, waiting for the hourly sweep.
--
-- The cause is hold rule (a), which predates this task: a contact's executed
-- document is held while that contact has ANY other document not in
-- ('EXECUTED','VOID') — anywhere, on any contract, in any state. The probe's
-- lessee had an unrelated lease sitting at `in_review` on a different contract.
-- Nobody was waiting on it. It held their executed lease anyway, and would have
-- gone on holding it. The 30-minute sweep would eventually have sent one
-- correct email — so this was never going to be visible as a wrong attachment
-- list, only as an email that took an hour to arrive. That is precisely the
-- shape ORCHESTRATOR §3 warns about.
--
-- Rule (a) is NOT loosened here. Loosening it would put the D25 onboarding
-- batch at risk for a gain this task does not need. Instead the event the owner
-- actually named is made a first-class reason to send: when the LAST document
-- of a contract's sequenced set executes, that contract's paperwork is
-- finished, and finished paperwork goes out. The hold rules keep governing
-- every document in the middle of the run — the probe shows all four
-- intermediate executions correctly sending nothing.

-- Vacuously true for a contract with no sequenced set at all, which preserves
-- today's behaviour for every contract that never had one.
CREATE OR REPLACE FUNCTION public.contract_signing_set_complete(p_contract_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p_contract_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM documents d
     WHERE d.contract_id = p_contract_id
       AND d.deleted_at IS NULL
       AND d.sign_sequence IS NOT NULL
       AND d.status NOT IN ('EXECUTED', 'VOID')
       AND coalesce(d.workflow_state, '') <> 'void');
$function$;

CREATE OR REPLACE FUNCTION public.documents_send_executed_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_anchor uuid;
BEGIN
  IF NEW.status = 'EXECUTED' AND OLD.status IS DISTINCT FROM 'EXECUTED'
     AND NEW.executed_email_sent_at IS NULL THEN
    BEGIN
      IF NEW.contract_id IS NOT NULL AND contract_signing_set_complete(NEW.contract_id) THEN
        -- DEALAUTO §3: the deal's paperwork is finished. Contract + bundle go
        -- out together, through the same batching path, as ONE email —
        -- deliver_executed_document_set reaches across the contract for the
        -- documents held under other anchors. Overrides the hold rules on
        -- purpose: there is nothing left to wait for.
        v_anchor := coalesce(NEW.contact_id, (
          SELECT d2.contact_id FROM documents d2
           WHERE d2.contract_id = NEW.contract_id AND d2.deleted_at IS NULL
             AND d2.contact_id IS NOT NULL AND d2.status = 'EXECUTED'
             AND d2.executed_email_sent_at IS NULL
           ORDER BY d2.generated_at, d2.created_at LIMIT 1));
        IF v_anchor IS NOT NULL THEN
          PERFORM deliver_executed_document_set(v_anchor, NEW.id);
        ELSE
          -- a set with no contact anchor anywhere: unchanged single-document path
          PERFORM send_executed_document_email(NEW.id);
        END IF;
      ELSIF document_delivery_is_held(NEW.id) THEN
        -- Mailing now is exactly what produced one email per document. Hold it;
        -- the end of the run flushes the whole set together.
        UPDATE documents SET delivery_held_at = coalesce(delivery_held_at, now())
         WHERE id = NEW.id;
      ELSIF NEW.contact_id IS NULL THEN
        -- No contact anchor (multi-party instruments): unchanged single-document path.
        PERFORM send_executed_document_email(NEW.id);
      ELSE
        PERFORM deliver_executed_document_set(NEW.contact_id, NEW.id);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- never let a mail failure roll back an executed instrument; record it
      UPDATE documents SET executed_email_error = SQLERRM WHERE id = NEW.id;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

-- ── the governing document is step 1 of its own set ────────────────────────
-- `ensure_horse_documents` already forces sign_sequence = 1 onto the lease, but
-- only for a lease with a horse. A sale, or a lease that took no horse
-- documents, reached the bundle generator with the governing document still at
-- sign_sequence NULL — so the bundle would have been numbered 1, 2 and the
-- instrument everything hangs off would have been absent from its own signing
-- set. It also has to carry a sequence for `contract_signing_set_complete` to
-- see it at all.
CREATE OR REPLACE FUNCTION public.ensure_contract_role_documents(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_req      jsonb;
  v_contract uuid;
  v_org      uuid;
  v_seq      int;
  v_out      jsonb := '[]'::jsonb;
  v_doc      uuid;
  v_minor    uuid;
  v_fields   int;
  r          jsonb;
  v_contact  uuid;
  v_key      text;
BEGIN
  SELECT d.contract_id, d.org_id INTO v_contract, v_org
    FROM documents d WHERE d.id = p_document_id AND d.deleted_at IS NULL;
  IF v_contract IS NULL THEN
    RETURN jsonb_build_object('generated', v_out, 'reason', 'no contract');
  END IF;

  -- the governing document leads its own set
  UPDATE documents SET sign_sequence = 1
   WHERE id = p_document_id AND sign_sequence IS NULL;

  -- ONE read of the bundle, up front: contract_role_document_requirements is
  -- STABLE, so re-reading it inside the loop would return the same snapshot
  -- anyway and read as though it were reacting to the inserts.
  v_req := coalesce(contract_role_document_requirements(p_document_id) -> 'requirements', '[]'::jsonb);

  SELECT coalesce(max(d.sign_sequence), 0) INTO v_seq
    FROM documents d WHERE d.contract_id = v_contract AND d.deleted_at IS NULL;

  FOR r IN SELECT e.value FROM jsonb_array_elements(v_req) e LOOP
    v_contact := nullif(r ->> 'contact_id', '')::uuid;
    v_key     := r ->> 'template_key';
    CONTINUE WHEN v_contact IS NULL OR v_key IS NULL;

    -- already on file for this person: nothing is owed (ROLEBUNDLE's own rule)
    CONTINUE WHEN coalesce((r ->> 'satisfied')::boolean, false);
    -- somebody else already owns making this one
    CONTINUE WHEN coalesce(r ->> 'owned_by', 'unassigned') <> 'unassigned';

    -- idempotency, per PERSON: `on_this_contract_document_id` is deliberately
    -- addressee-blind, so it cannot be used here — when both parties owe
    -- Company Policies, one party's copy would suppress the other's. This asks
    -- the only question that matters: does THIS person already have a live copy
    -- of THIS template on THIS contract?
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM documents d2 JOIN contract_templates t2 ON t2.id = d2.template_id
       WHERE d2.contract_id = v_contract AND d2.contact_id = v_contact
         AND t2.template_key = v_key AND d2.deleted_at IS NULL
         AND coalesce(d2.workflow_state, '') <> 'void');

    -- PARTICIPANT: FACILITY_RULES and RELEASE_GENERAL substitute
    -- PARTICIPANT.FULL_NAME / PARTICIPANT.DOB. Same resolution
    -- generate_my_onboarding_documents uses — a guardian-linked minor, else the
    -- person themselves — so the two paths cannot render the same template
    -- differently. A minor never signs.
    SELECT id INTO v_minor FROM contacts
     WHERE guardian_contact_id = v_contact AND deleted_at IS NULL
     ORDER BY created_at LIMIT 1;

    -- horse_id is deliberately NULL: these are obligations between the person
    -- and the company, not documents about the horse. Attaching the deal's
    -- horse would make the copy horse-scoped, and supersession is horse-scoped
    -- (SUPERSEDE, 2026-08-10) — a horse-scoped Company Policies would sit
    -- alongside the person's general one instead of replacing it.
    SELECT gd.document_id INTO v_doc FROM generate_document(
      v_contact, v_key, v_contract, NULL::uuid,
      jsonb_build_array(
        jsonb_build_object('contact_id', v_contact, 'role', 'CLIENT',
                           'is_signer', true, 'signer_order', 1),
        jsonb_build_object('contact_id', coalesce(v_minor, v_contact),
                           'role', 'PARTICIPANT', 'is_signer', false)),
      NULL::text) gd;
    CONTINUE WHEN v_doc IS NULL;

    v_seq := v_seq + 1;
    SELECT count(*) INTO v_fields FROM contract_fields WHERE document_id = v_doc;

    UPDATE documents
       SET status         = 'AWAITING_SIGNATURE',
           sign_sequence  = v_seq,
           -- nothing to author => ready to sign the moment it appears
           workflow_state = CASE WHEN v_fields = 0 THEN 'locked' ELSE workflow_state END
     WHERE id = v_doc;

    v_out := v_out || jsonb_build_object(
      'document_id', v_doc, 'template_key', v_key,
      'contact_id', v_contact, 'party_role', r ->> 'party_role',
      'sign_sequence', v_seq);
    v_doc := NULL; v_minor := NULL;
  END LOOP;

  RETURN jsonb_build_object('contract_id', v_contract, 'generated', v_out);
END;
$function$;

-- ── the backfilled deals settle against their own completion rule ──────────
-- Migration 1 opened a deal over six contracts, two of which carry an already
-- EXECUTED lease. Those deals were born 'pending' beside a finished lease
-- because deal_autocomplete_on_execution had no deal to complete when the
-- execution happened. One-time repair, using the deal layer's own
-- can_complete — no new rule, and nothing that runs again.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM deals WHERE status = 'pending' AND deleted_at IS NULL
  LOOP
    IF (deal_completion_state(r.id) ->> 'can_complete')::boolean THEN
      UPDATE deals SET status = 'complete', completed_at = now() WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
