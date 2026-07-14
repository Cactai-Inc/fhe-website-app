/*
  # Phase 2 — onboarding horse intake + horse tied to the purchase

  A purchase that uses the RIDER'S OWN horse (all segment='horse' care, plus the
  "(With your horse)" rider lessons where horse_included=false) needs the horse on
  file. Onboarding gets its horse-intake step back, creating the record through
  the ONE unified create_horse_record path (same record regardless of entry
  point), and stamping the created horse on the purchase.

  A. purchases.horse_id — the horse a horse-service purchase concerns.
  B. my_onboarding_state exposes horse_needed + the purchase's horse_id.
  C. attach_purchase_horse(purchase, horse) — stamp it (caller owns the purchase).
*/

-- ── A. the purchase's horse ──────────────────────────────────────────────────
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS horse_id uuid REFERENCES horses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS purchases_horse_idx ON purchases(horse_id);

-- ── B. my_onboarding_state: + horse_needed, + purchase.horse_id ───────────────
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
                              'horse_needed', false);
  END IF;

  SELECT * INTO v_c FROM contacts WHERE id = v_contact;
  v_profile := v_c.phone IS NOT NULL AND v_c.date_of_birth IS NOT NULL
           AND v_c.emergency_contact_1_name IS NOT NULL
           AND v_c.emergency_contact_1_phone IS NOT NULL;

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
      ORDER BY (d.status = 'EXECUTED') DESC, d.created_at DESC
      LIMIT 1;
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
                            'horse_needed', v_horse_needed);
END;
$function$;

-- ── C. attach a horse to a purchase (caller owns the purchase) ────────────────
CREATE OR REPLACE FUNCTION public.attach_purchase_horse(p_purchase_id uuid, p_horse_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid := current_contact_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  UPDATE purchases
     SET horse_id = p_horse_id
   WHERE id = p_purchase_id
     AND deleted_at IS NULL
     AND (buyer_user_id = auth.uid() OR buyer_contact_id = v_contact OR is_admin());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'purchase not found or not yours';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION attach_purchase_horse(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION attach_purchase_horse(uuid, uuid) TO authenticated, service_role;
