-- TASK WALLSYNC / Bug B — one satisfaction predicate, version-blind.
--
-- FOUR places answered "has this contact satisfied this required document?" and
-- one of them answered differently:
--
--   contact_document_wall_state()        version-AWARE  (signed_v >= current version)
--   my_onboarding_state()   docs loop    version-blind
--   my_onboarding_state()   horse_needed version-blind
--   generate_my_onboarding_documents()   version-blind
--
-- The wall is the outlier, and it traps: it blocks every route except
-- /app/onboarding, while the onboarding page — computing satisfaction the other
-- way — reports nothing to do. Madeline Do is in that state in production today.
--
-- WHY THE WALL IS THE HALF THAT IS WRONG (owner correction, 2026-08-07).
-- contact_required_documents is (contact_id, template_key, org_id): there is NO
-- version column. An assignment records "this person needs HUMAN_EMERGENCY_MEDICAL",
-- never "needs version 2". The wall then compared that assignment against the
-- template's CURRENT version, so the instant anyone edited a template body and
-- bumped it, every prior signer was silently re-papered — no email, no notice, no
-- staff decision. All 9 active wall-gating templates were bumped on 2026-08-02 by
-- the contract sprint; that is the origin of this incident.
--
-- The system already has a deliberate path for this decision and the wall was
-- pre-empting it: record_template_version_bump() logs each bump to
-- template_version_events, pending_version_decisions() puts it in front of staff,
-- and resolve_version_decision(event, ALL|SELECTED|NONE) records the answer. All 6
-- events from the sprint are still UNRESOLVED. Nobody has decided that anyone must
-- re-sign, yet the wall was enforcing it anyway.
--
-- Deciding to re-paper a client is a business and legal judgement. The system must
-- never make it as a side effect of editing text. So satisfaction becomes
-- VERSION-BLIND: any EXECUTED, non-superseded document for an assigned template_key
-- satisfies it. That conforms the wall to the other three, which is also the only
-- self-consistent direction — generate_my_onboarding_documents() refuses to
-- generate a replacement while an executed non-superseded copy exists, so a
-- version-aware onboarding page would have listed documents that could never be
-- produced to sign.
--
-- signed_template_version is NOT rewritten by this migration. It is evidence of what
-- each person actually signed; this changes what the GATE asks of it. Making a
-- re-signature an explicit act is the separate follow-on migration.

BEGIN;

-- ── The one predicate ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contact_document_satisfied(
  p_contact_id uuid, p_template_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  -- Version-BLIND by design. A valid executed signature is not invalidated by a
  -- later edit to the template body; only an explicit, deliberate staff decision
  -- may demand a re-signature (see the resign-floor migration).
  SELECT p_contact_id IS NOT NULL AND EXISTS (
    SELECT 1
      FROM documents d
      JOIN contract_templates ct ON ct.id = d.template_id
     WHERE d.contact_id = p_contact_id
       AND d.deleted_at IS NULL
       AND d.status = 'EXECUTED'
       AND coalesce(d.current_status, '') <> 'superseded'
       AND ct.template_key = p_template_key);
$$;

COMMENT ON FUNCTION public.contact_document_satisfied(uuid, text) IS
  'THE satisfaction rule for an assigned document. Called by contact_document_wall_state(), my_onboarding_state() and generate_my_onboarding_documents() so the signing wall and the onboarding page cannot disagree and deadlock a member. Version-blind: see 20260807T1500.';

-- ── Caller 1: the wall ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contact_document_wall_state(p_contact_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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
     -- ONE predicate, shared with my_onboarding_state(). The wall must never ask
     -- for something the onboarding page will not offer: that is the deadlock.
     AND NOT contact_document_satisfied(p_contact_id, crd.template_key);

  RETURN jsonb_build_object(
    'pending', coalesce(v_pending, 0),
    'gating',  coalesce(v_gating, 0),
    'titles',  to_jsonb(coalesce(v_titles, ARRAY[]::text[])));
END;
$function$;

-- ── Caller 2: the onboarding page ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_onboarding_state()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  -- Same shared predicate: this used to carry its own inline copy of the rule.
  IF NOT v_horse_needed THEN
    v_horse_needed := EXISTS (
      SELECT 1 FROM contact_required_documents crd
      WHERE crd.contact_id = v_contact
        AND crd.template_key IN ('HORSE_EMERGENCY_VET','RELEASE_HORSE_CARE')
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

-- ── Caller 3: the generator that must produce something to sign ────────────────
-- Only the satisfaction test changes; the horse/party/regeneration logic is intact.
CREATE OR REPLACE FUNCTION public.generate_my_onboarding_documents()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  v_keep_horses uuid[];   -- the member's bound horse set for this template
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
    -- Shared predicate: whatever the wall and the onboarding page consider
    -- unsatisfied, this MUST be willing to generate — otherwise the page lists a
    -- document that can never be produced, which is the deadlock in another form.
    v_doc := NULL; v_status := NULL; v_title := NULL;
    IF contact_document_satisfied(v_contact, req.template_key) THEN
      SELECT d.id, d.status, d.title INTO v_doc, v_status, v_title
        FROM documents d
        JOIN contract_templates t ON t.id = d.template_id
        WHERE d.contact_id = v_contact AND t.template_key = req.template_key
          AND d.deleted_at IS NULL
          AND d.status = 'EXECUTED'
          AND coalesce(d.current_status, '') <> 'superseded'
        ORDER BY d.created_at DESC
        LIMIT 1;
    END IF;

    IF v_doc IS NULL THEN
      -- carry the member's multi-horse choice across regeneration
      SELECT dh.horses INTO v_keep_horses FROM (
        SELECT array_agg(x.horse_id ORDER BY x.position) AS horses
          FROM documents d2
          JOIN contract_templates t2 ON t2.id = d2.template_id
          JOIN document_horses x ON x.document_id = d2.id
         WHERE d2.contact_id = v_contact AND t2.template_key = req.template_key
           AND d2.deleted_at IS NULL AND d2.status <> 'EXECUTED'
      ) dh;

      UPDATE documents d SET deleted_at = now()
        FROM contract_templates t
        WHERE d.template_id = t.id AND d.contact_id = v_contact
          AND t.template_key = req.template_key
          AND d.status <> 'EXECUTED' AND d.deleted_at IS NULL;
      SELECT g.document_id INTO v_doc
        FROM generate_document(v_contact, req.template_key, NULL::uuid,
             coalesce(v_keep_horses[1], v_horse), v_parties, NULL::text,
             v_keep_horses) g;
      SELECT d.status, d.title INTO v_status, v_title FROM documents d WHERE d.id = v_doc;
    END IF;

    v_out := v_out || jsonb_build_object(
      'document_id', v_doc, 'template_key', req.template_key,
      'title', v_title, 'status', v_status);
    v_doc := NULL; v_status := NULL; v_title := NULL; v_keep_horses := NULL;
  END LOOP;

  RETURN v_out;
END;
$function$;

-- ── The invariant, as a standing check ─────────────────────────────────────────
-- "If the wall blocks, the onboarding page must show at least one actionable item."
-- With one shared predicate this is true by construction: the wall's set is a
-- SUBSET of the onboarding page's set (same crd rows, further filtered to active
-- wall-gating templates) and both apply the same test. This function makes that
-- checkable rather than merely argued, for EVERY contact.
CREATE OR REPLACE FUNCTION public.wall_onboarding_invariant_violations()
RETURNS TABLE(contact_id uuid, person text, wall_gating int, onboarding_actionable int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT v.id, v.person, v.gating, v.actionable
    FROM (
      SELECT c.id,
             coalesce(nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''),
                      c.email, c.id::text) AS person,
             (contact_document_wall_state(c.id)->>'gating')::int AS gating,
             (SELECT count(*)::int FROM contact_required_documents crd
               WHERE crd.contact_id = c.id
                 AND NOT contact_document_satisfied(c.id, crd.template_key)) AS actionable
        FROM contacts c
       WHERE c.deleted_at IS NULL) v
   WHERE v.gating > 0 AND v.actionable = 0;
$$;

COMMENT ON FUNCTION public.wall_onboarding_invariant_violations() IS
  'Must always return zero rows. A row means a contact is walled with nothing to sign — the WALLSYNC deadlock. Checked by the migration that introduced the shared predicate.';

-- Fail the migration rather than ship the deadlock.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM wall_onboarding_invariant_violations();
  IF n > 0 THEN
    RAISE EXCEPTION 'WALLSYNC: invariant violated for % contact(s) — walled with no actionable document', n;
  END IF;
END $$;

COMMIT;
