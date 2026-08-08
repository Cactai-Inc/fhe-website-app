-- TASK WALLSYNC / Bug B, part 2 — make the DELIBERATE re-sign path actually work.
--
-- The shared predicate (20260807T1500) is version-blind, so a valid executed
-- signature is no longer invalidated by an edit to the template body. That closes
-- the deadlock, but it leaves a hole: require_resign_from() created an obligation
-- by inserting a contact_required_documents row and then RELYING ON THE WALL'S
-- VERSION COMPARISON to turn it into a demand. Its own comment said so:
--
--   "Adding the obligation is the whole mechanism: the wall compares versions and
--    routes them through the normal signing flow at next sign-in."
--
-- With the comparison gone that is a no-op. It was already a partial no-op before:
-- the INSERT is ON CONFLICT DO NOTHING, so for anyone who ALREADY held the
-- assignment — which is everyone the onboarding flow has ever touched, Madeline Do
-- included — it wrote nothing and demanded nothing. resolve_version_decision()
-- would report N people required and create N obligations that did not exist.
--
-- The correct mechanism already exists and is already the one staff use.
-- staff_assign_documents() forces a re-signature by SUPERSEDING the executed copy:
--
--   "every executed, non-superseded copy that would still satisfy the requirement
--    is superseded (retained as evidence), so the assignment ALWAYS produces a
--    pending requirement."
--
-- That is exactly right under a version-blind gate, and it is the owner's standing
-- rule about executed documents: re-signing supersedes and RETAINS. The superseded
-- row stays as evidence of what the person signed and when; signed_template_version
-- is never rewritten. All three callers of the shared predicate then agree — the
-- wall blocks, the onboarding page lists the document, and
-- generate_my_onboarding_documents() produces a fresh copy to sign.
--
-- So require_resign_from() stops inventing a second, weaker mechanism and uses the
-- one that works. No schema change, no new marker concept: forcing a re-signature
-- is an explicit act by a human either way —
--
--   * staff re-assigning on the client record  -> staff_assign_documents()
--   * staff answering a version prompt ALL/SELECTED -> resolve_version_decision()
--                                                      -> require_resign_from()
--
-- and NEVER an inference from a template edit.
--
-- THIS MIGRATION DEMANDS NOTHING OF ANYONE. It changes what require_resign_from()
-- would do when next invoked. The 6 template_version_events from the 2026-08-02
-- contract sprint remain UNRESOLVED and untouched: whether those body changes were
-- material enough to require a re-signature is the owner's call, not this thread's.

BEGIN;

CREATE OR REPLACE FUNCTION public.require_resign_from(
  p_template_key text, p_contact_ids uuid[])
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
      PERFORM log_status_event('document', dr.id, 'superseded',
        'Re-signature required by staff decision on a template version change', v_org);
    END LOOP;

    -- Count people who genuinely owe the document now, so people_required on the
    -- resolved event is the truth rather than a count of fresh INSERTs.
    IF NOT contact_document_satisfied(r.id, p_template_key) THEN
      v_n := v_n + 1;
    END IF;
  END LOOP;

  RETURN v_n;
END
$function$;

COMMENT ON FUNCTION public.require_resign_from(text, uuid[]) IS
  'Explicit, staff-initiated re-signature demand for named contacts. Creates the obligation by superseding the executed copy (evidence retained, signed_template_version untouched) — the same mechanism as staff_assign_documents. Never inferred from a template version bump; see 20260807T1510.';

-- template_past_signers.already_required meant "an obligation row exists", which
-- is true for every member the onboarding flow ever touched and so told staff
-- nothing about whether a re-signature had actually been demanded. Under the shared
-- predicate the honest answer is simply: do they owe this document right now.
CREATE OR REPLACE FUNCTION public.template_past_signers(p_template_key text)
RETURNS TABLE(contact_id uuid, name text, email text, signed_version integer,
              signed_at timestamp with time zone, already_required boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id,
         coalesce(nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''),
                  c.email, 'Unnamed'),
         c.email,
         max(coalesce(d.signed_template_version, ct.version))::int,
         max(d.generated_at),
         NOT contact_document_satisfied(c.id, p_template_key)
    FROM documents d
    JOIN contract_templates ct ON ct.id = d.template_id
    JOIN contacts c ON c.id = d.contact_id AND c.deleted_at IS NULL
   WHERE ct.template_key = p_template_key
     AND d.status = 'EXECUTED' AND d.deleted_at IS NULL
     AND c.org_id = current_org()
     AND has_staff_access()
   GROUP BY c.id, c.first_name, c.last_name, c.email
  HAVING max(coalesce(d.signed_template_version, ct.version))
         < (SELECT max(version) FROM contract_templates
             WHERE template_key = p_template_key AND active AND deleted_at IS NULL)
   ORDER BY max(d.generated_at) DESC
$function$;

-- The invariant still holds after touching this family.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM wall_onboarding_invariant_violations();
  IF n > 0 THEN
    RAISE EXCEPTION 'WALLSYNC: invariant violated for % contact(s)', n;
  END IF;
END $$;

COMMIT;
