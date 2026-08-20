-- CLOSEOUT §1.6 — the Lessor's documents: default ON, skippable, removable.
-- Owner ruling 2026-08-17:
--   "the lessor is categorized as horse owner and by default they should be
--    assigned the documents, but they can be skipped or removed outright
--    (skipping is a fallback in case removal is overlooked on provisioning)."
--
-- REMOVE already exists twice over and is untouched here: the provisioning
-- form's per-document checkboxes (template_keys override, proven by
-- CONTRACTWALK W1b) and the PaperworkEditor's uncheck-and-save
-- (set_contact_required_documents). What was missing is SKIP: a standing
-- requirement that stops blocking WITHOUT being deleted and WITHOUT ever
-- reading as signed, carrying who skipped it, when, and why.
--
-- Semantics:
--   · a skipped requirement clears the WALL (contact_document_wall_state) and
--     therefore the LOCK GATE (contract_lock_blockers' onboarding_documents
--     check reads the wall) — otherwise skip is decorative;
--   · it disappears from the member's onboarding ask (required_templates_for_
--     contact feeds my_onboarding_state AND generate_my_onboarding_documents);
--   · it is NOT satisfaction: contact_document_satisfied is untouched, no
--     document row is created or altered, nothing ever reads as executed;
--   · an EXECUTED requirement can never be skipped (standing rule 2026-07-29 —
--     there is nothing to skip; the requirement is satisfied evidence);
--   · a deliberate staff re-assign (staff_assign_documents) CLEARS the skip —
--     assigning something you skipped is the explicit way of saying you want
--     it back;
--   · the PaperworkEditor's replace-save now preserves rows (and their skip
--     marks) instead of deleting and re-inserting the whole set.

-- ── 1. the skip mark ─────────────────────────────────────────────────────────
ALTER TABLE contact_required_documents
  ADD COLUMN IF NOT EXISTS skipped_at  timestamptz,
  ADD COLUMN IF NOT EXISTS skipped_by  uuid,
  ADD COLUMN IF NOT EXISTS skip_reason text;

-- ── 2. the ACTIVE-requirements view of the world excludes skipped rows ──────
-- (feeds my_onboarding_state's document loop and generate_my_onboarding_documents)
CREATE OR REPLACE FUNCTION public.required_templates_for_contact(p_contact_id uuid)
 RETURNS TABLE(template_key text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT crd.template_key FROM contact_required_documents crd
  WHERE crd.contact_id = p_contact_id
    AND crd.skipped_at IS NULL   -- CLOSEOUT §1.6: skipped = not asked for
$function$;

-- ── 3. the WALL excludes skipped rows ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contact_document_wall_state(p_contact_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pending int; v_gating int; v_titles text[];
BEGIN
  IF p_contact_id IS NULL THEN
    RETURN jsonb_build_object('pending', 0, 'gating', 0, 'titles', '[]'::jsonb);
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE ct.wall_gating),
         array_agg(coalesce(ct.title, ct.template_key)
                   ORDER BY coalesce(ct.title, ct.template_key))
           FILTER (WHERE ct.wall_gating)
    INTO v_pending, v_gating, v_titles
    FROM contact_required_documents crd
    JOIN contract_templates ct ON ct.template_key = crd.template_key
     AND ct.active AND ct.deleted_at IS NULL
     AND ct.version = (SELECT max(x.version) FROM contract_templates x
                        WHERE x.template_key = ct.template_key
                          AND x.active AND x.deleted_at IS NULL)
   WHERE crd.contact_id = p_contact_id
     -- CLOSEOUT §1.6: a skipped requirement stops blocking. Skip must clear the
     -- wall and the lock gate (which reads this function), or it is decorative.
     AND crd.skipped_at IS NULL
     -- ONE predicate, shared with my_onboarding_state(). The wall must never ask
     -- for something the onboarding page will not offer: that is the deadlock.
     AND NOT contact_document_satisfied(p_contact_id, crd.template_key);

  RETURN jsonb_build_object(
    'pending', coalesce(v_pending, 0),
    'gating',  coalesce(v_gating, 0),
    'titles',  to_jsonb(coalesce(v_titles, ARRAY[]::text[])));
END;
$function$;

-- ── 4. the invariant checker counts the same way ─────────────────────────────
CREATE OR REPLACE FUNCTION public.wall_onboarding_invariant_violations()
 RETURNS TABLE(contact_id uuid, person text, wall_gating integer, onboarding_actionable integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT v.id, v.person, v.gating, v.actionable
    FROM (
      SELECT c.id,
             coalesce(nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''),
                      c.email, c.id::text) AS person,
             (contact_document_wall_state(c.id)->>'gating')::int AS gating,
             (SELECT count(*)::int FROM contact_required_documents crd
               WHERE crd.contact_id = c.id
                 AND crd.skipped_at IS NULL   -- CLOSEOUT §1.6
                 AND NOT contact_document_satisfied(c.id, crd.template_key)) AS actionable
        FROM contacts c
       WHERE c.deleted_at IS NULL) v
   WHERE v.gating > 0 AND v.actionable = 0;
$function$;

-- ── 5. the horse-review branch of my_onboarding_state honours skip ───────────
-- Reissued from the live prod body (pg_get_functiondef, 2026-08-19); the ONLY
-- change is `AND crd.skipped_at IS NULL` in the horse_needed EXISTS.
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
  v_ok       boolean;
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
  v_profile := contact_profile_complete(v_contact);

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
  -- Same shared predicate: this used to carry its own inline copy of the rule.
  IF NOT v_horse_needed THEN
    v_horse_needed := EXISTS (
      SELECT 1 FROM contact_required_documents crd
      WHERE crd.contact_id = v_contact
        AND crd.template_key IN ('HORSE_EMERGENCY_VET','RELEASE_HORSE_CARE')
        AND crd.skipped_at IS NULL   -- CLOSEOUT §1.6
        AND NOT contact_document_satisfied(v_contact, crd.template_key)
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
    -- Satisfaction is decided by the shared predicate, NOT by reading a status off
    -- whichever row sorts first. The row lookup below only chooses what to DISPLAY.
    v_ok := contact_document_satisfied(v_contact, req.template_key);

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

    IF v_ok THEN
      v_status := 'EXECUTED';
    ELSIF v_doc IS NULL THEN
      SELECT title INTO v_title FROM contract_templates WHERE template_key = req.template_key;
      v_status := 'MISSING';
    ELSIF v_status = 'EXECUTED' THEN
      -- executed but not satisfying: superseded evidence, or (once the resign-floor
      -- migration lands) an explicit staff demand for a newer version. Either way
      -- the member must act, so it must NOT read as 'EXECUTED'. The UI treats every
      -- non-EXECUTED status as actionable.
      v_status := 'RESIGN_REQUIRED';
    END IF;

    IF NOT v_ok THEN v_needed := true; END IF;
    v_docs := v_docs || jsonb_build_object(
      'document_id', v_doc, 'template_key', req.template_key,
      'title', v_title, 'status', coalesce(v_status, 'MISSING'));
    v_doc := NULL; v_status := NULL; v_title := NULL; v_ok := NULL;
  END LOOP;

  RETURN jsonb_build_object('needed', v_needed, 'profile_complete', v_profile,
                            'documents', v_docs, 'purchase', v_purchase, 'minor', v_minor,
                            'horse_needed', v_horse_needed, 'prefill', v_prefill);
END;
$function$;

-- ── 6. the editor's replace-save PRESERVES surviving rows and their marks ───
CREATE OR REPLACE FUNCTION public.set_contact_required_documents(p_contact_id uuid, p_template_keys text[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_n integer;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  SELECT org_id INTO v_org FROM contacts WHERE id = p_contact_id AND deleted_at IS NULL;
  IF v_org IS NULL OR v_org <> current_org() THEN
    RAISE EXCEPTION 'contact not found in this org';
  END IF;
  -- CLOSEOUT §1.6: delete only what left the set and insert only what joined
  -- it. The old delete-all-reinsert wiped skip marks on every editor save.
  DELETE FROM contact_required_documents
   WHERE contact_id = p_contact_id
     AND template_key <> ALL (coalesce(p_template_keys, '{}'));
  INSERT INTO contact_required_documents (contact_id, template_key, org_id)
  SELECT p_contact_id, k, v_org FROM unnest(coalesce(p_template_keys, '{}')) k
  ON CONFLICT DO NOTHING;
  SELECT count(*) INTO v_n
    FROM contact_required_documents WHERE contact_id = p_contact_id;
  RETURN v_n;
END;
$function$;

-- ── 7. a deliberate staff re-assign clears the skip ──────────────────────────
CREATE OR REPLACE FUNCTION public.staff_assign_documents(p_contact_id uuid, p_template_keys text[])
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

    -- CLOSEOUT §1.6: assigning a template that was skipped is the explicit way
    -- of saying you want it back — the skip mark is cleared.
    INSERT INTO contact_required_documents (contact_id, template_key, org_id)
    VALUES (p_contact_id, k, v_org)
    ON CONFLICT (contact_id, template_key) DO UPDATE
      SET skipped_at = NULL, skipped_by = NULL, skip_reason = NULL
      WHERE contact_required_documents.skipped_at IS NOT NULL;
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

-- ── 8. SKIP and RESTORE, with the audit the owner requires ───────────────────
CREATE OR REPLACE FUNCTION public.skip_required_document(
  p_contact_id uuid, p_template_key text, p_reason text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_row contact_required_documents%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  SELECT org_id INTO v_org FROM contacts WHERE id = p_contact_id AND deleted_at IS NULL;
  IF v_org IS NULL OR v_org <> current_org() THEN
    RAISE EXCEPTION 'contact not found in this org';
  END IF;

  SELECT * INTO v_row FROM contact_required_documents
   WHERE contact_id = p_contact_id AND template_key = p_template_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no % requirement on this contact to skip', p_template_key;
  END IF;
  IF v_row.skipped_at IS NOT NULL THEN
    RETURN jsonb_build_object('skipped', true, 'skipped_at', v_row.skipped_at,
                              'already', true);
  END IF;

  -- Standing rule 2026-07-29: an EXECUTED document is never skipped or removed.
  -- A satisfied requirement is evidence, not a blocker — there is nothing here
  -- to skip, and marking it skipped would misstate the record.
  IF contact_document_satisfied(p_contact_id, p_template_key) THEN
    RAISE EXCEPTION 'this requirement is satisfied by an executed document and cannot be skipped';
  END IF;

  UPDATE contact_required_documents
     SET skipped_at = now(), skipped_by = auth.uid(),
         skip_reason = nullif(btrim(coalesce(p_reason, '')), '')
   WHERE contact_id = p_contact_id AND template_key = p_template_key;

  -- Skipping is not signing: the audit shows WHO skipped it and WHEN, and the
  -- requirement row itself carries the mark. No document row is touched.
  INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value, new_value)
  VALUES (auth.uid(), 'UPDATE', 'contact_required_documents', p_contact_id,
          jsonb_build_object('template_key', p_template_key, 'skipped_at', NULL),
          jsonb_build_object('event', 'requirement_skipped',
                             'template_key', p_template_key,
                             'skipped_at', now(),
                             'skipped_by', auth.uid(),
                             'reason', nullif(btrim(coalesce(p_reason, '')), '')));

  RETURN jsonb_build_object('skipped', true, 'skipped_at', now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.unskip_required_document(
  p_contact_id uuid, p_template_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_row contact_required_documents%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  SELECT org_id INTO v_org FROM contacts WHERE id = p_contact_id AND deleted_at IS NULL;
  IF v_org IS NULL OR v_org <> current_org() THEN
    RAISE EXCEPTION 'contact not found in this org';
  END IF;

  SELECT * INTO v_row FROM contact_required_documents
   WHERE contact_id = p_contact_id AND template_key = p_template_key;
  IF NOT FOUND OR v_row.skipped_at IS NULL THEN
    RETURN jsonb_build_object('restored', false);
  END IF;

  UPDATE contact_required_documents
     SET skipped_at = NULL, skipped_by = NULL, skip_reason = NULL
   WHERE contact_id = p_contact_id AND template_key = p_template_key;

  INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value, new_value)
  VALUES (auth.uid(), 'UPDATE', 'contact_required_documents', p_contact_id,
          jsonb_build_object('template_key', p_template_key,
                             'skipped_at', v_row.skipped_at,
                             'skipped_by', v_row.skipped_by,
                             'reason', v_row.skip_reason),
          jsonb_build_object('event', 'requirement_skip_restored',
                             'template_key', p_template_key));

  RETURN jsonb_build_object('restored', true);
END;
$function$;

-- ── 9. what the editor renders: the full set WITH skip state ─────────────────
CREATE OR REPLACE FUNCTION public.contact_required_documents_state(p_contact_id uuid)
 RETURNS TABLE(template_key text, skipped_at timestamptz, skipped_by_name text,
               skip_reason text, satisfied boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT crd.template_key, crd.skipped_at,
         (SELECT nullif(trim(concat_ws(' ', pr.first_name, pr.last_name)), '')
            FROM profiles pr WHERE pr.user_id = crd.skipped_by),
         crd.skip_reason,
         contact_document_satisfied(p_contact_id, crd.template_key)
    FROM contact_required_documents crd
   WHERE crd.contact_id = p_contact_id
     AND has_staff_access()
   ORDER BY crd.template_key
$function$;

REVOKE ALL ON FUNCTION public.skip_required_document(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.skip_required_document(uuid, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.unskip_required_document(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unskip_required_document(uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.contact_required_documents_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_required_documents_state(uuid) TO authenticated, service_role;
