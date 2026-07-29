-- ASSIGNMENT VISIBILITY + RE-SIGN SEMANTICS (owner-reported, 2026-07-28).
--
-- Mechanism found: template versions are bumped IN PLACE (one contract_templates
-- row per key), so an executed document always joins back to the CURRENT
-- version. The pending-set queries (my_wall_state / my_documents /
-- admin_client_documents) treat "executed at version >= current" as satisfied —
-- which an in-place bump can never invalidate. staff_assign_documents therefore
-- only upserted contact_required_documents rows that already existed
-- (ON CONFLICT DO NOTHING) and NOTHING became pending anywhere: no admin
-- confirmation, no ops change, no member change. Exactly the reported symptom.
--
-- Fix: assigning a document to a person who already has a satisfying executed
-- copy IS the re-sign intent. staff_assign_documents now marks that executed
-- document current_status='superseded' (kept as evidence — the same state
-- apply_document_supersession uses when a newer version executes) and logs a
-- status event. Every downstream surface already understands 'superseded':
--   - my_wall_state: the requirement counts as pending again → signing wall;
--   - my_documents: the requirement surfaces as kind='assigned' on the member's
--     Documents page;
--   - the onboarding flow regenerates + re-collects the signature.
-- The RPC now returns a jsonb summary so the UI can confirm explicitly.

DROP FUNCTION IF EXISTS public.staff_assign_documents(uuid, text[]);

CREATE FUNCTION public.staff_assign_documents(p_contact_id uuid, p_template_keys text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid;
  v_assigned text[] := '{}';
  v_resign   text[] := '{}';
  k          text;
  r          record;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  SELECT org_id INTO v_org FROM contacts WHERE id = p_contact_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'contact not found'; END IF;

  FOREACH k IN ARRAY coalesce(p_template_keys, '{}') LOOP
    IF NOT EXISTS (SELECT 1 FROM staff_assignable_templates(p_contact_id) t WHERE t.template_key = k) THEN
      RAISE EXCEPTION 'template % is not assignable (inactive, clause-engine, or not the current version)', k;
    END IF;

    INSERT INTO contact_required_documents (contact_id, template_key, org_id)
    VALUES (p_contact_id, k, v_org)
    ON CONFLICT DO NOTHING;
    v_assigned := v_assigned || k;

    -- Re-sign: every executed, non-superseded copy that would still satisfy the
    -- requirement is superseded (retained as evidence), so the assignment
    -- ALWAYS produces a pending requirement.
    FOR r IN
      SELECT d.id FROM documents d
      JOIN contract_templates ct ON ct.id = d.template_id
      WHERE d.contact_id = p_contact_id AND d.deleted_at IS NULL
        AND d.status = 'EXECUTED'
        AND coalesce(d.current_status, '') <> 'superseded'
        AND ct.template_key = k
    LOOP
      UPDATE documents SET current_status = 'superseded' WHERE id = r.id;
      PERFORM log_status_event('document', r.id, 'superseded',
        'Re-assigned for signature by staff', v_org);
      IF NOT (k = ANY (v_resign)) THEN v_resign := v_resign || k; END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'assigned', to_jsonb(v_assigned),
    'resign',   to_jsonb(v_resign));
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_assign_documents(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_assign_documents(uuid, text[]) TO authenticated, service_role;

-- ── admin_client_documents: pending requirements are VISIBLE and distinct ────
-- A required template whose only executed copies are superseded (a staff
-- re-assign) now shows as ASSIGNED / awaiting signature, distinct from both the
-- executed evidence rows and the zero-history NOT_STARTED state.
CREATE OR REPLACE FUNCTION public.admin_client_documents(p_user_id uuid)
 RETURNS TABLE(id uuid, title text, status text, workflow_state text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- generated documents (the real instances)
  SELECT d.id, d.title, d.status, d.workflow_state, d.created_at
  FROM documents d
  JOIN profiles p ON p.contact_id = d.contact_id
  WHERE is_admin() AND p.user_id = p_user_id AND d.deleted_at IS NULL

  UNION ALL

  -- required templates with no document that satisfies them and none in
  -- progress → a pending requirement row:
  --   NOT_STARTED  when the person has no history for the template at all,
  --   ASSIGNED     when prior executed copies exist but are superseded
  --                (staff re-assigned it for signature).
  SELECT
    -- deterministic pseudo-id from the template key (stable list key; not a
    -- real doc). NOTE: the prior version concatenated 16 hex chars into the
    -- final uuid group and blew up the moment a row actually materialized —
    -- which it never did before this fix made requirements visible.
    ('00000000-0000-0000-0000-' || substr(md5(ct.template_key), 1, 12))::uuid AS id,
    t.title,
    CASE WHEN EXISTS (
      SELECT 1 FROM documents d JOIN contract_templates t2 ON t2.id = d.template_id
      WHERE t2.template_key = ct.template_key
        AND d.contact_id = p.contact_id AND d.deleted_at IS NULL
    ) THEN 'ASSIGNED' ELSE 'NOT_STARTED' END AS status,
    'awaiting_signature'::text AS workflow_state,
    NULL::timestamptz AS created_at
  FROM profiles p
  JOIN required_templates_for_contact(p.contact_id) ct ON true
  JOIN contract_templates t ON t.template_key = ct.template_key AND t.deleted_at IS NULL
  WHERE is_admin() AND p.user_id = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM documents d
      JOIN contract_templates t2 ON t2.id = d.template_id
      WHERE t2.template_key = ct.template_key
        AND d.contact_id = p.contact_id AND d.deleted_at IS NULL
        AND (d.status <> 'EXECUTED'                      -- in progress (pending signature)
          OR (d.status = 'EXECUTED'
              AND coalesce(d.current_status,'') <> 'superseded'))  -- satisfied
    )

  ORDER BY created_at DESC NULLS LAST
$function$;

-- ── my_onboarding_state: the horse step also serves REVIEW ──────────────────
-- horse_needed was purchase-driven only. A member with UNSATISFIED horse-doc
-- requirements (HORSE_EMERGENCY_VET / RELEASE_HORSE_CARE pending, e.g. a staff
-- re-assign) must also pass the horse step, so they review/complete the horse
-- record the paperwork will merge from — even with no purchase in play.
CREATE OR REPLACE FUNCTION public.my_onboarding_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact  uuid;
  v_c        contacts%ROWTYPE;
  v_docs     jsonb := '[]'::jsonb;
  v_purchase jsonb;
  v_minor    jsonb;
  v_prefill  jsonb;
  v_needed   boolean := false;
  v_profile  boolean := false;
  v_pid      uuid;
  v_phorse   uuid;
  v_horse_needed boolean := false;
  req        record;
  v_doc      uuid;
  v_status   text;
  v_title    text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  PERFORM ensure_my_membership();
  v_contact := coalesce(current_contact_id(), ensure_contact_for_profile(auth.uid()));
  IF v_contact IS NULL THEN
    RETURN jsonb_build_object('needed', false, 'profile_complete', false,
                              'documents', '[]'::jsonb, 'purchase', NULL, 'minor', NULL,
                              'horse_needed', false, 'prefill', NULL);
  END IF;

  SELECT * INTO v_c FROM contacts WHERE id = v_contact;
  v_profile := v_c.phone IS NOT NULL AND v_c.date_of_birth IS NOT NULL
           AND v_c.emergency_contact_1_name IS NOT NULL
           AND v_c.emergency_contact_1_phone IS NOT NULL;

  -- Everything the contact record already knows about the person, so the
  -- details form prefills instead of asking again (re-invited members).
  v_prefill := jsonb_build_object(
    'first_name', v_c.first_name, 'last_name', v_c.last_name,
    'phone', v_c.phone,
    'date_of_birth', to_char(v_c.date_of_birth, 'YYYY-MM-DD'),
    'address_street', v_c.address_line1, 'address_city', v_c.city,
    'address_state', v_c.state, 'address_zip', v_c.postal_code,
    'emergency_contact_1_name', v_c.emergency_contact_1_name,
    'emergency_contact_1_relationship', v_c.emergency_contact_1_relationship,
    'emergency_contact_1_phone', v_c.emergency_contact_1_phone,
    'emergency_contact_2_name', v_c.emergency_contact_2_name,
    'emergency_contact_2_relationship', v_c.emergency_contact_2_relationship,
    'emergency_contact_2_phone', v_c.emergency_contact_2_phone,
    'riding_experience_years', v_c.riding_experience_years,
    'jump_experience', v_c.jump_experience,
    'riding_background', v_c.riding_background);

  -- the contact's latest purchase (spine)
  SELECT pu.id, pu.horse_id INTO v_pid, v_phorse
    FROM purchases pu
    WHERE pu.buyer_contact_id = v_contact AND pu.deleted_at IS NULL
    ORDER BY pu.created_at DESC LIMIT 1;
  IF v_pid IS NOT NULL THEN
    SELECT jsonb_build_object(
        'purchase_id', pu.id, 'horse_id', pu.horse_id,
        'tier_label', (SELECT pi.label FROM purchase_items pi WHERE pi.purchase_id = pu.id ORDER BY pi.created_at DESC LIMIT 1),
        'amount', pu.amount, 'lessons_included', NULL, 'cadence', NULL,
        'paid', (pu.payment_status = 'paid'), 'payment_method', pu.payment_method)
      INTO v_purchase
      FROM purchases pu WHERE pu.id = v_pid;

    -- horse intake is needed when this purchase uses the rider's OWN horse and
    -- none is attached yet: any segment='horse' item, or a "(With your horse)"
    -- rider lesson (horse_included = false).
    v_horse_needed := v_phorse IS NULL AND EXISTS (
      SELECT 1 FROM purchase_items pi
      JOIN offerings o ON o.id = pi.offering_id
      WHERE pi.purchase_id = v_pid
        AND (o.segment = 'horse' OR (o.segment = 'rider' AND o.horse_included = false))
    );
  END IF;

  -- The horse step ALSO runs as a review whenever a horse document is required
  -- and not yet satisfied — the member confirms/completes the horse record the
  -- paperwork merges from before signing (staff re-assign, no purchase needed).
  IF NOT v_horse_needed THEN
    v_horse_needed := EXISTS (
      SELECT 1 FROM contact_required_documents crd
      WHERE crd.contact_id = v_contact
        AND crd.template_key IN ('HORSE_EMERGENCY_VET','RELEASE_HORSE_CARE')
        AND NOT EXISTS (
          SELECT 1 FROM documents d
          JOIN contract_templates ct2 ON ct2.id = d.template_id
          WHERE d.contact_id = v_contact AND d.deleted_at IS NULL
            AND d.status = 'EXECUTED'
            AND coalesce(d.current_status,'') <> 'superseded'
            AND ct2.template_key = crd.template_key)
    );
  END IF;

  -- a guardian-linked minor, if any
  SELECT jsonb_build_object('first_name', mc.first_name, 'last_name', mc.last_name,
      'dob', to_char(mc.date_of_birth, 'YYYY-MM-DD'))
    INTO v_minor
    FROM contacts mc
    WHERE mc.guardian_contact_id = v_contact AND mc.deleted_at IS NULL
    ORDER BY mc.created_at LIMIT 1;

  FOR req IN
    SELECT ct.template_key FROM required_templates_for_contact(v_contact) ct
    ORDER BY coalesce(array_position(
      ARRAY['COMPANY_POLICIES','FACILITY_RULES','RELEASE_PARTICIPANT',
            'RELEASE_HORSE_CARE','RELEASE_HORSE_EXERCISE','RELEASE_GENERAL',
            'HUMAN_EMERGENCY_MEDICAL','HORSE_EMERGENCY_VET','MEDIA_RELEASE'],
      ct.template_key), 99), ct.template_key
  LOOP
    SELECT d.id, d.status, coalesce(d.title, t.title) INTO v_doc, v_status, v_title
      FROM documents d
      JOIN contract_templates t ON t.id = d.template_id
      WHERE d.contact_id = v_contact AND t.template_key = req.template_key
        AND d.deleted_at IS NULL
        -- a superseded executed copy no longer satisfies (staff re-assign):
        -- prefer a live pending/current doc over superseded evidence.
      ORDER BY (d.status = 'EXECUTED' AND coalesce(d.current_status,'') <> 'superseded') DESC,
               (d.status <> 'EXECUTED') DESC,
               d.created_at DESC
      LIMIT 1;
    IF v_doc IS NOT NULL AND v_status = 'EXECUTED' THEN
      -- if that executed copy is superseded, it does not satisfy the requirement
      IF EXISTS (SELECT 1 FROM documents dx WHERE dx.id = v_doc AND coalesce(dx.current_status,'') = 'superseded') THEN
        v_status := 'SUPERSEDED';
      END IF;
    END IF;
    IF v_doc IS NULL THEN
      SELECT title INTO v_title FROM contract_templates WHERE template_key = req.template_key;
      v_status := 'MISSING';
    END IF;
    IF v_status IS DISTINCT FROM 'EXECUTED' THEN v_needed := true; END IF;
    v_docs := v_docs || jsonb_build_object(
      'document_id', v_doc, 'template_key', req.template_key,
      'title', v_title, 'status', coalesce(v_status, 'MISSING'));
    v_doc := NULL; v_status := NULL; v_title := NULL;
  END LOOP;

  RETURN jsonb_build_object('needed', v_needed, 'profile_complete', v_profile,
                            'documents', v_docs, 'purchase', v_purchase, 'minor', v_minor,
                            'horse_needed', v_horse_needed, 'prefill', v_prefill);
END;
$function$;

REVOKE ALL ON FUNCTION public.my_onboarding_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_onboarding_state() TO authenticated, service_role;

-- ── generate_my_onboarding_documents: a superseded copy never satisfies ─────
-- Same rule here: only an executed, NON-superseded document satisfies a
-- requirement; anything else (missing, draft, superseded evidence) triggers a
-- fresh generation so the member can sign the current version.
CREATE OR REPLACE FUNCTION public.generate_my_onboarding_documents()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_out     jsonb := '[]'::jsonb;
  v_horse   uuid;
  v_cnt     integer;
  v_hid     text;
  v_minor   uuid;
  v_parties jsonb;
  req       record;
  v_doc     uuid;
  v_status  text;
  v_title   text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  v_contact := coalesce(current_contact_id(), ensure_contact_for_profile(auth.uid()));
  IF v_contact IS NULL THEN RAISE EXCEPTION 'no contact record for this account'; END IF;
  IF NOT EXISTS (SELECT 1 FROM required_templates_for_contact(v_contact)) THEN
    RETURN v_out;
  END IF;

  -- The horse this paperwork is about — NEVER guessed:
  --   1) the horse attached to the latest purchase (the member chose it, or the
  --      horse-intake step attached it),
  --   2) else the contact's SOLE owned/leased horse (unambiguous),
  --   3) else NULL: documents generate without a horse identity rather than
  --      silently binding to an arbitrary record. All documents in this batch
  --      share the one v_horse, so the horse releases can never split.
  SELECT pu.horse_id INTO v_horse
    FROM purchases pu
    WHERE pu.buyer_contact_id = v_contact AND pu.deleted_at IS NULL
    ORDER BY pu.created_at DESC LIMIT 1;
  IF v_horse IS NULL THEN
    SELECT count(*), max(h.id::text) INTO v_cnt, v_hid
      FROM horses h
      WHERE h.deleted_at IS NULL
        AND (h.current_owner_contact_id = v_contact OR h.lessee_contact_id = v_contact);
    IF v_cnt = 1 THEN v_horse := v_hid::uuid; END IF;
  END IF;

  -- PARTICIPANT = a guardian-linked minor, else the client themselves
  SELECT id INTO v_minor FROM contacts
   WHERE guardian_contact_id = v_contact AND deleted_at IS NULL
   ORDER BY created_at LIMIT 1;

  v_parties := jsonb_build_array(
    jsonb_build_object('contact_id', v_contact, 'role', 'CLIENT', 'is_signer', true),
    jsonb_build_object('contact_id', coalesce(v_minor, v_contact), 'role', 'PARTICIPANT', 'is_signer', false));

  FOR req IN
    SELECT ct.template_key FROM required_templates_for_contact(v_contact) ct
    ORDER BY coalesce(array_position(
      ARRAY['COMPANY_POLICIES','FACILITY_RULES','RELEASE_PARTICIPANT',
            'RELEASE_HORSE_CARE','RELEASE_HORSE_EXERCISE','RELEASE_GENERAL',
            'HUMAN_EMERGENCY_MEDICAL','HORSE_EMERGENCY_VET','MEDIA_RELEASE'],
      ct.template_key), 99), ct.template_key
  LOOP
    -- only an executed, NON-superseded copy satisfies the requirement
    SELECT d.id, d.status, d.title INTO v_doc, v_status, v_title
      FROM documents d
      JOIN contract_templates t ON t.id = d.template_id
      WHERE d.contact_id = v_contact AND t.template_key = req.template_key
        AND d.deleted_at IS NULL
        AND d.status = 'EXECUTED'
        AND coalesce(d.current_status,'') <> 'superseded'
      ORDER BY d.created_at DESC
      LIMIT 1;

    IF v_doc IS NULL THEN
      UPDATE documents d SET deleted_at = now()
        FROM contract_templates t
        WHERE d.template_id = t.id AND d.contact_id = v_contact
          AND t.template_key = req.template_key
          AND d.status <> 'EXECUTED' AND d.deleted_at IS NULL;
      SELECT g.document_id INTO v_doc
        FROM generate_document(v_contact, req.template_key, NULL::uuid, v_horse, v_parties, NULL::text) g;
      SELECT d.status, d.title INTO v_status, v_title FROM documents d WHERE d.id = v_doc;
    END IF;

    v_out := v_out || jsonb_build_object(
      'document_id', v_doc, 'template_key', req.template_key,
      'title', v_title, 'status', v_status);
    v_doc := NULL; v_status := NULL; v_title := NULL;
  END LOOP;

  RETURN v_out;
END;
$function$;

REVOKE ALL ON FUNCTION public.generate_my_onboarding_documents() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_my_onboarding_documents() TO authenticated, service_role;
