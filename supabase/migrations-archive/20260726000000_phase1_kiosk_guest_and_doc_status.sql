-- Phase 1 — fan-out foundation (DB): kiosk→Guest default, document status/
-- workflow_state coherence, and provision idempotency.

-- ---------------------------------------------------------------------------
-- 1. Kiosk → Guest default standing category.
--    A release/kiosk signer (sign_release) gets a CLIENT contact_roles row but
--    no standing account category, leaving them "undefined". This trigger gives
--    such a contact GUEST — but ONLY if they have no standing category yet, so
--    an invited Rider/Horse Owner is never downgraded. Covers every path that
--    inserts a CLIENT role, in one uncircumventable place.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.default_guest_on_client_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role_type = 'CLIENT'
     AND NOT EXISTS (
       SELECT 1 FROM contact_roles
        WHERE contact_id = NEW.contact_id
          AND role_type IN ('GUEST','RIDER','HORSE_OWNER')
     )
  THEN
    INSERT INTO contact_roles (contact_id, role_type)
      VALUES (NEW.contact_id, 'GUEST')
      ON CONFLICT (contact_id, role_type) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_default_guest_on_client ON public.contact_roles;
CREATE TRIGGER trg_default_guest_on_client
  AFTER INSERT ON public.contact_roles
  FOR EACH ROW
  WHEN (NEW.role_type = 'CLIENT')
  EXECUTE FUNCTION public.default_guest_on_client_role();

-- Backfill: existing CLIENT contacts with no standing category → GUEST
-- (Serena and other stranded kiosk walk-ins).
INSERT INTO contact_roles (contact_id, role_type)
SELECT DISTINCT cr.contact_id, 'GUEST'
FROM contact_roles cr
WHERE cr.role_type = 'CLIENT'
  AND NOT EXISTS (
    SELECT 1 FROM contact_roles x
     WHERE x.contact_id = cr.contact_id
       AND x.role_type IN ('GUEST','RIDER','HORSE_OWNER'))
ON CONFLICT (contact_id, role_type) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Document status ↔ workflow_state coherence.
--    UI reads `workflow_state ?? status`. record_signature sets both
--    status='EXECUTED' + workflow_state='executed'; sign_release sets only
--    status, leaving workflow_state='editable' → a signed doc shows "editable".
--    A BEFORE trigger keeps them coherent for EVERY writer (no need to edit the
--    large sign_release RPC): a terminal status forces the matching workflow_state.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.documents_sync_workflow_on_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'EXECUTED' THEN
    NEW.workflow_state := 'executed';
  ELSIF NEW.status = 'VOID' AND NEW.workflow_state NOT IN ('void','executed') THEN
    NEW.workflow_state := 'void';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_documents_sync_workflow ON public.documents;
CREATE TRIGGER trg_documents_sync_workflow
  BEFORE INSERT OR UPDATE OF status, workflow_state ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.documents_sync_workflow_on_status();

-- Backfill the ~25 desynced signed rows (EXECUTED but workflow_state='editable').
UPDATE public.documents
   SET workflow_state = 'executed'
 WHERE status = 'EXECUTED' AND workflow_state <> 'executed' AND deleted_at IS NULL;
UPDATE public.documents
   SET workflow_state = 'void'
 WHERE status = 'VOID' AND workflow_state NOT IN ('void','executed') AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. provision_client_invitation idempotency.
--    Re-inviting an already-signed kiosk contact (convert flow) must not create
--    a DUPLICATE purchase. Skip the purchase helper when a non-void purchase for
--    this contact already covers the SAME offering set. Documents are already
--    safe (apply_category_documents ON CONFLICT; generate preserves EXECUTED).
--    Re-issues the canonical body from 20260725000000 with the guard added.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provision_client_invitation(
  p_email          text,
  p_first_name     text,
  p_last_name      text,
  p_categories     text[],
  p_offering_ids   uuid[]  DEFAULT '{}',
  p_template_keys  text[]  DEFAULT NULL,
  p_mark_paid      boolean DEFAULT false,
  p_payment_method text    DEFAULT NULL,
  p_notes          text    DEFAULT NULL,
  p_request_id     uuid    DEFAULT NULL,
  p_org_id         uuid    DEFAULT NULL,
  p_partial_amount numeric DEFAULT 0
) RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org       uuid;
  v_contact   uuid;
  v_client    uuid;
  v_purchase  uuid;
  v_inv_id    uuid;
  v_token     text;
  v_total     numeric := 0;
  v_labels    text[];
  v_has_off   boolean := (array_length(p_offering_ids, 1) IS NOT NULL);
  v_dup_purchase uuid;
  v_cats      text[];
  v_email     text := lower(trim(p_email));
  v_fn        text := nullif(trim(coalesce(p_first_name, '')), '');
  v_ln        text := nullif(trim(coalesce(p_last_name,  '')), '');
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to provision invitations';
  END IF;
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'email is required'; END IF;

  SELECT array_agg(DISTINCT upper(btrim(c)))
    INTO v_cats
    FROM unnest(coalesce(p_categories, '{}')) c
   WHERE btrim(c) <> '';
  IF v_cats IS NULL OR array_length(v_cats, 1) IS NULL THEN
    RAISE EXCEPTION 'at least one category is required';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_cats) c WHERE c NOT IN ('GUEST','RIDER','HORSE_OWNER')) THEN
    RAISE EXCEPTION 'categories must be a subset of GUEST/RIDER/HORSE_OWNER';
  END IF;

  v_org := p_org_id;
  IF v_org IS NULL AND v_has_off THEN
    SELECT o.org_id INTO v_org FROM offerings o WHERE o.id = p_offering_ids[1];
  END IF;
  v_org := coalesce(v_org, current_org());
  IF v_org IS NULL THEN RAISE EXCEPTION 'could not resolve org for this invitation'; END IF;

  SELECT c.id INTO v_contact FROM contacts c
    WHERE lower(c.email) = v_email AND c.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id AND lower(coalesce(p.email,'')) <> v_email)
    ORDER BY c.created_at LIMIT 1;
  IF v_contact IS NULL THEN
    INSERT INTO contacts (org_id, first_name, last_name, email)
      VALUES (v_org, v_fn, v_ln, v_email)
      RETURNING id INTO v_contact;
  ELSE
    UPDATE contacts SET
        first_name = CASE WHEN v_fn IS NOT NULL AND (NULLIF(trim(coalesce(first_name,'')),'') IS NULL
                            OR lower(trim(first_name)) = lower(coalesce(email,'')))
                          THEN v_fn ELSE first_name END,
        last_name  = CASE WHEN v_ln IS NOT NULL AND NULLIF(trim(coalesce(last_name,'')),'') IS NULL
                          THEN v_ln ELSE last_name END
      WHERE id = v_contact;
  END IF;

  SELECT cl.id INTO v_client FROM clients cl WHERE cl.contact_id = v_contact AND cl.deleted_at IS NULL;
  IF v_client IS NULL THEN
    INSERT INTO clients (org_id, contact_id, source)
      VALUES (v_org, v_contact, 'provisioned invitation')
      RETURNING id INTO v_client;
  END IF;

  INSERT INTO contact_roles (contact_id, role_type)
  SELECT v_contact, c FROM unnest(v_cats) c
  ON CONFLICT ON CONSTRAINT contact_roles_contact_id_role_type_key DO NOTHING;

  IF p_template_keys IS NOT NULL THEN
    DELETE FROM contact_required_documents WHERE contact_id = v_contact;
    INSERT INTO contact_required_documents (contact_id, template_key, org_id)
    SELECT v_contact, k, v_org
      FROM unnest(p_template_keys) k
     WHERE btrim(k) <> ''
    ON CONFLICT DO NOTHING;
  ELSE
    PERFORM apply_category_documents(v_contact);
  END IF;

  IF v_has_off THEN
    -- IDEMPOTENCY: if a live (non-void) purchase for this contact already covers
    -- exactly this offering set, reuse it instead of creating a duplicate.
    SELECT p.id INTO v_dup_purchase
      FROM purchases p
     WHERE p.buyer_contact_id = v_contact
       AND coalesce(p.status,'') <> 'void'
       AND p.deleted_at IS NULL
       AND (SELECT array_agg(DISTINCT pi.offering_id ORDER BY pi.offering_id)
              FROM purchase_items pi WHERE pi.purchase_id = p.id)
           = (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(p_offering_ids) x)
     ORDER BY p.created_at DESC
     LIMIT 1;

    IF v_dup_purchase IS NOT NULL THEN
      v_purchase := v_dup_purchase;
    ELSE
      v_purchase := _provision_purchase_for_offerings(
        v_org, v_contact, v_client, p_offering_ids,
        p_mark_paid, p_payment_method, p_notes, p_partial_amount);
    END IF;

    SELECT coalesce(sum(o.price_amount), 0), array_agg(o.name)
      INTO v_total, v_labels
      FROM offerings o WHERE o.id = ANY(p_offering_ids);
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO invitations (org_id, request_id, email, token, expires_at, status,
                           first_name, last_name, contact_id,
                           categories, offering_ids, template_keys)
    VALUES (v_org, p_request_id, v_email, v_token, now() + interval '14 days', 'sent',
            v_fn, v_ln, v_contact,
            v_cats, nullif(p_offering_ids, '{}'), p_template_keys)
    RETURNING id INTO v_inv_id;

  IF p_request_id IS NOT NULL THEN
    UPDATE requests SET status = 'invited' WHERE id = p_request_id;
  END IF;

  RETURN jsonb_build_object(
    'invitation_id', v_inv_id, 'token', v_token,
    'contact_id', v_contact, 'purchase_id', v_purchase,
    'categories', v_cats, 'amount', coalesce(v_total, 0),
    'labels', coalesce(v_labels, ARRAY[]::text[]),
    'request_id', p_request_id);
END;
$function$;
