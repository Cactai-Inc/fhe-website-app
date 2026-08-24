-- TASK-OFFERINGDOCS — the documents arrive when the ORDER OPENS, not when a line
-- is added to a cart.
--
-- Owner, 2026-08-24, correcting the earlier spec: "Auto prompt when a tag lands is
-- not exactly the right spec if implemented literally it means they select
-- something from the catalog and instantly get routed to a set of docs. The docs
-- should just appear as a task when the order is placed... And we can do it based
-- on the actual approval from me or Claire instead of the request. So once we
-- approve the request and their offering is scheduled the docs get triggered and
-- the dashboard notification appears and then when they sign in next time the app
-- asks them to complete the docs."
--
-- 20260824T1200 hung apply_offering_documents off the purchase_items INSERT
-- trigger — the moment a LINE is added, which is cart-building, before anybody has
-- approved anything. A visitor browsing the catalog would collect legal
-- obligations by clicking.
--
-- THE APPROVAL SEAM ALREADY EXISTS AND IS ALREADY USED FOR EXACTLY THIS.
-- `purchases_mint_credits` fires AFTER UPDATE OF status when draft -> anything
-- else: the transition staff perform when they open an order. Credits mint there
-- (D23). Documents now arrive on the same transition, so "what you owe" and "what
-- you got" appear together and cannot disagree about when the order became real.
--
-- The TAG is deliberately left on the item trigger. Tags describe and obligate
-- nothing, so tagging a buyer early is harmless; documents are the half that had
-- to wait for approval.
CREATE OR REPLACE FUNCTION public.promote_buyer_from_offering()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_org     uuid;
  v_kind    text;
BEGIN
  SELECT p.buyer_contact_id, p.org_id INTO v_contact, v_org
    FROM purchases p WHERE p.id = NEW.purchase_id;
  IF v_contact IS NULL OR v_org IS NULL THEN RETURN NEW; END IF;

  SELECT o.config_kind INTO v_kind FROM offerings o WHERE o.id = NEW.offering_id;
  IF v_kind IS NULL OR v_kind = 'inquire' THEN RETURN NEW; END IF;

  -- Tags stay here: they describe the relationship and require nothing.
  PERFORM apply_affiliations(v_contact);

  -- ⚠️ THE DOCUMENTS MOVED to trg_documents_when_order_opens. Assigning them from
  -- here meant a line in a DRAFT cart created the obligation — before staff had
  -- approved anything, and before the client had committed to anything.
  RETURN NEW;
END;
$function$;

-- apply_offering_documents gains the disposition it writes. ON CONFLICT DO
-- NOTHING means a row that already exists keeps whatever strength it was given,
-- so softening here can never downgrade a document somebody was DEMANDED to sign.
CREATE OR REPLACE FUNCTION public.apply_offering_documents(
  p_contact_id uuid, p_disposition text DEFAULT 'AT_LOGIN')
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_n integer;
BEGIN
  IF p_disposition NOT IN ('AT_LOGIN','WITH_CONTRACT','WHEN_READY') THEN
    RAISE EXCEPTION 'unknown disposition %', p_disposition;
  END IF;
  SELECT org_id INTO v_org FROM contacts WHERE id = p_contact_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'contact % not found', p_contact_id; END IF;

  INSERT INTO contact_required_documents (contact_id, template_key, org_id, disposition)
  SELECT DISTINCT p_contact_id, r.template_key, v_org, p_disposition
    FROM purchases p
    JOIN purchase_items pi ON pi.purchase_id = p.id AND pi.voided_at IS NULL
    JOIN offerings o       ON o.id = pi.offering_id
    JOIN service_type_document_requirements r
      ON r.org_id = v_org AND r.service_type = o.service_type AND r.active
   WHERE p.buyer_contact_id = p_contact_id
     -- ⚠️ AND NOT 'draft'. A cart is not an order. This is the same correction as
     -- the trigger move: nothing is owed until staff open it.
     AND coalesce(p.status, '') NOT IN ('void', 'draft')
     AND p.deleted_at IS NULL
     AND coalesce(o.config_kind, '') <> 'inquire'
  ON CONFLICT (contact_id, template_key) DO NOTHING;

  SELECT count(*) INTO v_n FROM contact_required_documents WHERE contact_id = p_contact_id;
  RETURN v_n;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.apply_offering_documents(uuid, text) TO service_role;

-- ── THE ORDER OPENS: the paperwork becomes a task, and they are told ─────────
CREATE OR REPLACE FUNCTION public.trg_documents_when_order_opens()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid; v_user uuid; v_titles text[]; v_n int;
BEGIN
  IF coalesce(OLD.status, '') <> 'draft' OR coalesce(NEW.status, '') = 'draft' THEN
    RETURN NULL;
  END IF;
  v_contact := NEW.buyer_contact_id;
  IF v_contact IS NULL THEN RETURN NULL; END IF;

  -- What they will owe that they do not owe already — captured BEFORE the write,
  -- so the notification names the new work rather than everything on file.
  SELECT array_agg(DISTINCT coalesce(ct.title, r.template_key)), count(DISTINCT r.template_key)
    INTO v_titles, v_n
    FROM purchase_items pi
    JOIN offerings o ON o.id = pi.offering_id
    JOIN service_type_document_requirements r
      ON r.org_id = NEW.org_id AND r.service_type = o.service_type AND r.active
    LEFT JOIN contract_templates ct
      ON ct.template_key = r.template_key AND ct.active AND ct.deleted_at IS NULL
   WHERE pi.purchase_id = NEW.id AND pi.voided_at IS NULL
     AND coalesce(o.config_kind, '') <> 'inquire'
     AND NOT EXISTS (SELECT 1 FROM contact_required_documents crd
                      WHERE crd.contact_id = v_contact AND crd.template_key = r.template_key)
     AND NOT contact_document_satisfied(v_contact, r.template_key);

  -- ⚠️ ASKED, NOT DEMANDED. Owner: "when they sign in next time the app asks
  -- them to complete the docs" — asks. WHEN_READY surfaces at every sign-in until
  -- signed and never blocks. A document already DEMANDED of this person keeps
  -- that strength: the insert conflicts and does nothing.
  PERFORM apply_offering_documents(v_contact, 'WHEN_READY');

  -- The dashboard notification. Email rides /api/documents-requested when staff
  -- ask by hand; this automatic path raises the in-app one and the next sign-in
  -- surfaces the documents themselves.
  SELECT p.user_id INTO v_user FROM profiles p WHERE p.contact_id = v_contact;
  IF v_user IS NOT NULL AND coalesce(v_n, 0) > 0 THEN
    PERFORM notify_user(v_user, 'documents_requested',
      CASE WHEN v_n = 1 THEN 'A document needs your signature'
           ELSE v_n || ' documents need your signature' END,
      array_to_string(v_titles, ', '), '/app/onboarding');
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Paperwork must never be able to refuse an order the staff just approved.
  RAISE WARNING 'documents not assigned when order % opened: %', NEW.id, SQLERRM;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS purchases_assign_documents ON purchases;
CREATE TRIGGER purchases_assign_documents
  AFTER UPDATE OF status ON purchases
  FOR EACH ROW EXECUTE FUNCTION trg_documents_when_order_opens();
