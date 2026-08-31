-- TASK-FIX1 §E — Evan LaBuzetta's four executed documents are SUPERSEDED and
-- re-issued. Owner ruling, 2026-08-31.
--
-- ⚠️ THESE ARE EXECUTED LEGAL DOCUMENTS BELONGING TO A REAL FAMILY. Every
-- statement below was rehearsed in BEGIN; … ROLLBACK; against production first.
--
-- WHAT IS WRONG WITH THEM. All four print "Aubrey LaBuzetta" — his daughter — in
-- the CLIENT slot and on the signature line, because the front door captured one
-- name and he gave it hers (AR7 F1, fixed in §A). He typed exactly what the app
-- instructed: contacts.first_name was "Aubrey" from 20:37:59 until 20:45:41, and
-- profiles.first_name follows it through sync_profile_name_from_contact_trg, so
-- Onboarding.tsx printed "Type your name exactly as printed — Aubrey LaBuzetta"
-- and its gate demanded that string. ⚠️ THE SIGNER DID NOTHING WRONG.
--
-- WHY NOT EDIT THEM IN PLACE. The owner asked. They cannot be, and the reason is
-- load-bearing: block_signed_signature_update raises on any change to
-- typed_name, signed_at or ip_address once signed_at is set — "use
-- void-and-reissue, not a direct update". That trigger is WHY an executed
-- document in this system is worth anything. It is not weakened, not bypassed,
-- and not disabled for four rows.
--
-- WHY SUPERSEDE AND NOT VOID. D32: supersession retains, voiding does not. These
-- four are the only evidence that a guardian was walked through this flow and
-- what he was shown. They are also not wrong about the facts they record — Evan
-- did consent, on that date, to those four agreements, on behalf of that minor.
-- Only the printed name is wrong. Voiding would also leave a period in which he
-- was on the property with no executed release at all.
--
-- ALL FOUR, not only the two that look worst. The participant release and the
-- emergency medical authorisation are the two that matter legally, and a set
-- where two documents name one adult and two name another is worse than either.
--
-- ── PART 1 — the reason becomes a parameter ────────────────────────────────
-- require_resign_from IS the engine for "supersede the executed copies and
-- demand a re-signature". It exists, it is correct, and it is what the staff UI
-- calls. D18 forbids writing a second one beside it, so it is widened rather
-- than worked around: the hardcoded reason string becomes an optional argument
-- and keeps its old value as the default.
--
-- ⚠️ Adding a DEFAULTed parameter cannot be done with CREATE OR REPLACE — the
-- signature changes, so a 2-arg and a 3-arg overload would coexist and every
-- existing 2-arg call would become ambiguous. The old one must be dropped, and
-- ⚠️ A DROP RESETS THE FUNCTION'S ACLs (TASK-ORIGIN, 2026-08-27). The grants are
-- therefore re-applied explicitly below, reproducing exactly what was there
-- before — captured first: anon, authenticated, postgres, service_role, all
-- EXECUTE. (The anon grant is pre-existing and harmless — the body's first act
-- is has_staff_access() — but it is flagged in the report, not silently changed
-- here, because changing it is not this task's scope.)

DROP FUNCTION IF EXISTS public.require_resign_from(text, uuid[]);

CREATE OR REPLACE FUNCTION public.require_resign_from(p_template_key text, p_contact_ids uuid[], p_reason text DEFAULT NULL)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
  v_n int := 0;
  r   record;
  dr  record;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM contract_templates
                  WHERE template_key = p_template_key AND active AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'no active template with key %', p_template_key;
  END IF;

  -- Only contacts in this org, and only the ones actually named.
  FOR r IN
    SELECT c.id FROM contacts c
     WHERE c.id = ANY(coalesce(p_contact_ids, '{}'::uuid[]))
       AND c.org_id = v_org AND c.deleted_at IS NULL
  LOOP
    -- 1. The obligation must exist.
    INSERT INTO contact_required_documents (contact_id, template_key, org_id)
    VALUES (r.id, p_template_key, v_org)
    ON CONFLICT DO NOTHING;

    -- 2. Supersede the executed copies that would otherwise satisfy it. This is
    --    what actually creates the demand — same mechanism as
    --    staff_assign_documents(). Evidence is retained, not deleted, and
    --    signed_template_version is left exactly as signed.
    --    Only EXECUTED documents are touched: anything mid-negotiation
    --    (AWAITING_SIGNATURE, DRAFT, …) is never written by this path.
    FOR dr IN
      SELECT d.id FROM documents d
      JOIN contract_templates ct ON ct.id = d.template_id
      WHERE d.contact_id = r.id AND d.deleted_at IS NULL
        AND d.status = 'EXECUTED'
        AND coalesce(d.current_status, '') <> 'superseded'
        AND ct.template_key = p_template_key
    LOOP
      UPDATE documents SET current_status = 'superseded' WHERE id = dr.id;
      -- FIX1 §E — THE REASON IS A PARAMETER NOW. It was a single hardcoded
      -- string, "a template version change", which is one reason among several
      -- and was simply untrue for the 2026-08-28 re-issue: that was an
      -- application defect at the front door, not a template edit and emphatically
      -- not a signer error. A superseded legal document that misstates why it was
      -- superseded is worse than one with no note at all. The old string remains
      -- the default, so every existing caller is unchanged.
      PERFORM log_status_event('document', dr.id, 'superseded',
        coalesce(nullif(btrim(coalesce(p_reason, '')), ''),
                 'Re-signature required by staff decision on a template version change'),
        v_org);
    END LOOP;

    -- Count people who genuinely owe the document now, so people_required on the
    -- resolved event is the truth rather than a count of fresh INSERTs.
    IF NOT contact_document_satisfied(r.id, p_template_key) THEN
      v_n := v_n + 1;
    END IF;
  END LOOP;

  RETURN v_n;
END
$function$

;

REVOKE ALL ON FUNCTION public.require_resign_from(text, uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.require_resign_from(text, uuid[], text) TO anon;
GRANT EXECUTE ON FUNCTION public.require_resign_from(text, uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.require_resign_from(text, uuid[], text) TO postgres;
GRANT EXECUTE ON FUNCTION public.require_resign_from(text, uuid[], text) TO service_role;

-- ── PART 2 — the four documents ────────────────────────────────────────────
-- Run as Claire Bourdon's admin account, because this IS a staff decision and
-- require_resign_from is a staff RPC: same function, same auth gate, same audit
-- trail as clicking it in the app would produce. Nothing here reaches around it.
DO $do$
DECLARE
  v_evan uuid := 'be678bba-9b03-473a-b53c-ea313fbccf7e';
  v_key  text;
  v_n    int;
  v_reason text :=
    'Superseded and re-issued because of an application defect, NOT a signer error. '
    'The /sign/rider form captured a single name with no indication whose it should be, '
    'so the account was created in the minor rider''s name; the printed CLIENT slot and '
    'signature line on this document therefore read "Aubrey LaBuzetta" instead of the '
    'guardian, "Evan LaBuzetta". The signer typed exactly the name the application '
    'displayed to him and the name gate accepted it. This document is retained in full '
    'as the record of what happened (D32). See TASK-AR7 §6 and TASK-FIX1 §E.';
BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub":"fdbdfe89-76d7-486b-b734-8e23b09e0353","role":"authenticated"}', true);

  FOREACH v_key IN ARRAY ARRAY['COMPANY_POLICIES','FACILITY_RULES',
                               'RELEASE_PARTICIPANT','HUMAN_EMERGENCY_MEDICAL']
  LOOP
    v_n := require_resign_from(v_key, ARRAY[v_evan], v_reason);
    RAISE NOTICE 'FIX1 §E: % -> % contact(s) now owe this document', v_key, v_n;
  END LOOP;
END
$do$;
