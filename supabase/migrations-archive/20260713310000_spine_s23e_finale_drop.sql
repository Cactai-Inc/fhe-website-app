/*
  # Spine Refactor — Slice 2.3e FINALE: drop the engagement family

  The whole app is off engagements/transactions/billing/service_assignments/
  client_purchases in both SQL and TS. This migration repoints the last six KEPT
  functions that still read those tables, drops the dead deal-wizard / billing /
  onboarding-horse functions + the 2-arg generate_document shim, drops the FK
  columns + the engagement-based storage policy, and DROPS the seven legacy
  tables. All data is test-only.

  A repoint kept fns · B drop dead fns · C drop policy + FK columns · D drop
  tables · E drop the now-orphan caller_owns_engagement.
*/

-- ── A. repoint the last six kept functions ───────────────────────────────────

-- 1. my_purchase_categories: the caller's purchased segments off purchases
CREATE OR REPLACE FUNCTION public.my_purchase_categories()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(DISTINCT cat ORDER BY cat), ARRAY[]::text[])
  FROM (
    SELECT CASE o.segment
             WHEN 'rider'   THEN 'riding'
             WHEN 'support' THEN 'deal'
             WHEN 'horse'   THEN 'care'
             ELSE o.segment
           END AS cat
    FROM purchases pu
    JOIN purchase_items pi ON pi.purchase_id = pu.id
    JOIN offerings o ON o.id = pi.offering_id
    WHERE pu.buyer_contact_id = (SELECT cl.contact_id FROM clients cl WHERE cl.id = current_client_id())
      AND pu.deleted_at IS NULL
      AND o.segment IS NOT NULL
  ) s
$function$;

-- 2. admin_oversight: "open engagements" tile now counts open CONTRACTS
CREATE OR REPLACE FUNCTION public.admin_oversight()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
  v_usage jsonb;
  v_activity jsonb;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'admin access required';
  END IF;

  SELECT jsonb_build_object(
    'members',          (SELECT count(*) FROM profiles WHERE org_id = v_org),
    'open_engagements', (SELECT count(*) FROM contracts
                          WHERE org_id = v_org AND deleted_at IS NULL
                            AND status NOT IN ('executed','void','declined')),
    'open_support',     (SELECT count(*) FROM support_requests WHERE org_id = v_org AND status <> 'resolved'),
    'feed_posts',       (SELECT count(*) FROM feed_posts WHERE org_id = v_org AND pulled_down = false),
    'flagged_posts',    (SELECT count(*) FROM feed_posts WHERE org_id = v_org AND scan_state <> 'clean')
  ) INTO v_usage;

  SELECT COALESCE(jsonb_agg(a ORDER BY a.occurred_at DESC), '[]'::jsonb) INTO v_activity
  FROM (
    SELECT occurred_at, action, table_name, actor_user_id
    FROM audit_logs
    ORDER BY occurred_at DESC
    LIMIT 50
  ) a;

  RETURN jsonb_build_object('usage', v_usage, 'activity', v_activity);
END;
$function$;

-- 3. platform_tenant_detail: usage 'engagements' now counts CONTRACTS
CREATE OR REPLACE FUNCTION public.platform_tenant_detail(p_org_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
BEGIN
  IF app_role() <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'platform operator only';
  END IF;

  SELECT jsonb_build_object(
    'org', (SELECT jsonb_build_object(
        'id', o.id, 'name', o.name, 'slug', o.slug, 'status', o.status,
        'display_code', o.display_code, 'created_at', o.created_at)
      FROM organizations o WHERE o.id = p_org_id),
    'modules', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'module_key', m.module_key, 'name', m.name, 'description', m.description,
        'is_core', m.is_core,
        'enabled', coalesce(om.enabled, m.is_core),
        'source', om.source) ORDER BY m.is_core DESC, m.module_key), '[]'::jsonb)
      FROM modules m
      LEFT JOIN org_modules om ON om.module_key = m.module_key AND om.org_id = p_org_id
      WHERE m.active),
    'admins', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'user_id', p.user_id, 'email', p.email,
        'name', trim(concat_ws(' ', p.first_name, p.last_name)),
        'role', p.role) ORDER BY p.role, p.email), '[]'::jsonb)
      FROM profiles p
      WHERE p.org_id = p_org_id AND p.role IN ('ADMIN','MANAGER','EMPLOYEE')),
    'usage', jsonb_build_object(
      'members',     (SELECT count(*) FROM profiles WHERE org_id = p_org_id),
      'contacts',    (SELECT count(*) FROM contacts WHERE org_id = p_org_id),
      'engagements', (SELECT count(*) FROM contracts WHERE org_id = p_org_id AND deleted_at IS NULL),
      'horses',      (SELECT count(*) FROM horses WHERE org_id = p_org_id AND deleted_at IS NULL),
      'documents',   (SELECT count(*) FROM documents WHERE org_id = p_org_id AND deleted_at IS NULL))
  ) INTO v;
  RETURN v;
END;
$function$;

-- 4. admin_client_items: documents only (the engagements array retires)
CREATE OR REPLACE FUNCTION public.admin_client_items(p_client_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN NOT is_admin() THEN NULL ELSE jsonb_build_object(
    'documents', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', d.id, 'title', d.title, 'workflow_state', d.workflow_state,
        'status', d.status, 'created_at', d.created_at
      ) ORDER BY d.created_at DESC), '[]'::jsonb)
      FROM documents d
      WHERE d.contact_id = (SELECT contact_id FROM clients WHERE id = p_client_id)
        AND d.deleted_at IS NULL
    )
  ) END
$function$;

-- 5. staff_contact_directory: engagement_count retired (0); party_roles +
--    document_count already read document_parties (S2.3e-1)
CREATE OR REPLACE FUNCTION public.staff_contact_directory()
RETURNS TABLE(id uuid, display_code text, first_name text, last_name text, email text, phone text, tags text[], notes text, created_at timestamptz, linked_user_id uuid, linked_role text, is_client boolean, party_roles text[], horses_owned bigint, horses_leased bigint, engagement_count bigint, document_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id, c.display_code, c.first_name, c.last_name,
         c.email, c.phone, c.tags, c.notes, c.created_at,
         p.user_id, p.role,
         EXISTS (SELECT 1 FROM clients cl
                  WHERE cl.contact_id = c.id AND cl.deleted_at IS NULL),
         (SELECT coalesce(array_agg(DISTINCT dp.party_role), '{}')
            FROM document_parties dp WHERE dp.contact_id = c.id),
         (SELECT count(*) FROM horses h
           WHERE h.current_owner_contact_id = c.id AND h.deleted_at IS NULL),
         (SELECT count(*) FROM horses h
           WHERE h.lessee_contact_id = c.id AND h.deleted_at IS NULL),
         0::bigint,
         (SELECT count(DISTINCT d.id)
            FROM documents d
           WHERE d.deleted_at IS NULL
             AND (d.contact_id = c.id
                  OR EXISTS (SELECT 1 FROM document_parties dp
                              WHERE dp.document_id = d.id AND dp.contact_id = c.id)))
  FROM contacts c
  LEFT JOIN profiles p ON p.contact_id = c.id
  WHERE c.org_id = current_org()
    AND c.deleted_at IS NULL
    AND has_staff_access()
  ORDER BY c.last_name NULLS LAST, c.first_name
$function$;

-- 6. feed_seed_welcome: the tailored purchase card off purchases (was client_purchases)
CREATE OR REPLACE FUNCTION public.feed_seed_welcome()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid := current_org();
  v_pu  purchases%ROWTYPE;
  v_has boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT EXISTS (SELECT 1 FROM feed_account_items WHERE user_id = v_uid AND kind = 'welcome') INTO v_has;
  IF v_has THEN RETURN; END IF;

  INSERT INTO feed_account_items (org_id, user_id, kind, title, body, payload)
    VALUES (v_org, v_uid, 'welcome', 'Welcome to your feed',
      'This is your home — new horses, gear, and moments from the barn land here. Choose how you''d like to see it; you can change it anytime.',
      jsonb_build_object('chooser', true));

  INSERT INTO feed_account_items (org_id, user_id, kind, title, body, payload)
    VALUES (v_org, v_uid, 'orientation', 'Getting around',
      'Tap the horse to Ask about it, Share a post with another rider, or start a service. Your library, schedule, and account live in the menu under your avatar.',
      '{}'::jsonb);

  -- tailored purchase card from the caller's latest spine purchase
  SELECT pu.* INTO v_pu
    FROM purchases pu
    JOIN profiles p ON p.contact_id = pu.buyer_contact_id
   WHERE p.user_id = v_uid AND pu.deleted_at IS NULL
   ORDER BY pu.created_at DESC LIMIT 1;
  IF FOUND THEN
    INSERT INTO feed_account_items (org_id, user_id, kind, title, body, payload)
      VALUES (v_org, v_uid, 'purchase_card',
        coalesce((SELECT pi.label FROM purchase_items pi WHERE pi.purchase_id = v_pu.id ORDER BY pi.created_at DESC LIMIT 1), 'Your booking'),
        CASE WHEN v_pu.payment_status = 'paid' THEN 'You''re all set. Here''s what to know before your first session.'
             ELSE 'Almost there — complete payment to confirm. Here''s what to know before your first session.' END,
        jsonb_build_object('purchase_id', v_pu.id, 'paid', v_pu.payment_status = 'paid'));
  END IF;
END;
$function$;

-- 7. advance_document_workflow: stop SELECTing the (dropping) documents.engagement_id
--    (e-2 left v_eng selected-but-unused; the notify block already reads document_parties)
CREATE OR REPLACE FUNCTION public.advance_document_workflow(p_document_id uuid, p_to text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org       uuid;
  v_from      text;
  v_recip     boolean;
  v_is_staff  boolean;
  v_is_orig   boolean;
  v_is_party  boolean;
  v_open      int;
  v_missing   int;
  v_title     text;
  v_horse_confirmed timestamptz;
  v_needs_horse boolean;
  v_signed    boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, workflow_state, recipient_editing,
         coalesce(title, 'A contract'), horse_section_confirmed_at
    INTO v_org, v_from, v_recip, v_title, v_horse_confirmed
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  IF p_to = 'executed' THEN
    RAISE EXCEPTION 'workflow_state ''executed'' is reached only by signing (record_signature), not manually';
  END IF;
  IF p_to NOT IN ('editable','editing','in_review','locked','void') THEN
    RAISE EXCEPTION 'unknown target workflow_state: %', p_to;
  END IF;

  v_is_staff := has_staff_access() AND v_org = current_org();
  v_is_orig  := contract_caller_is_originator(p_document_id);
  v_is_party := caller_is_document_party(p_document_id);

  IF NOT (v_is_staff OR v_is_party) THEN
    RAISE EXCEPTION 'not authorized to advance document %', p_document_id;
  END IF;

  IF v_from = p_to THEN
    RETURN v_from;
  END IF;

  IF v_from = 'executed' THEN
    RAISE EXCEPTION 'document is executed and cannot change workflow_state';
  END IF;

  IF p_to = 'void' THEN
    IF NOT v_is_staff THEN
      RAISE EXCEPTION 'only staff may void a document';
    END IF;

  ELSIF p_to = 'editing' THEN
    IF v_from NOT IN ('editable') THEN
      RAISE EXCEPTION 'illegal transition %→editing', v_from;
    END IF;
    IF NOT v_is_staff AND NOT v_is_orig AND NOT v_recip THEN
      RAISE EXCEPTION 'the counterparty may open editing only when recipient editing is enabled';
    END IF;

  ELSIF p_to = 'editable' THEN
    IF v_from NOT IN ('editing','in_review') THEN
      RAISE EXCEPTION 'illegal transition %→editable', v_from;
    END IF;

  ELSIF p_to = 'in_review' THEN
    IF v_from NOT IN ('editable','editing') THEN
      RAISE EXCEPTION 'illegal transition %→in_review', v_from;
    END IF;

  ELSIF p_to = 'locked' THEN
    IF v_from NOT IN ('in_review','editable','editing') THEN
      RAISE EXCEPTION 'illegal transition %→locked', v_from;
    END IF;
    SELECT count(*) INTO v_open FROM document_change_requests
      WHERE document_id = p_document_id AND status = 'open';
    IF v_open > 0 THEN
      RAISE EXCEPTION 'cannot lock: % open change request(s) remain', v_open;
    END IF;
    SELECT count(*) INTO v_missing FROM contract_fields
      WHERE document_id = p_document_id AND required
        AND nullif(trim(coalesce(value, '')), '') IS NULL;
    IF v_missing > 0 THEN
      RAISE EXCEPTION 'cannot lock: % required field(s) still empty', v_missing;
    END IF;
    v_needs_horse := EXISTS (
      SELECT 1 FROM contract_fields
      WHERE document_id = p_document_id
        AND owner_role = 'LESSOR' AND field_key LIKE 'HORSE.%');
    IF v_needs_horse AND v_horse_confirmed IS NULL THEN
      RAISE EXCEPTION 'cannot lock: the horse information has not been confirmed by the Lessor';
    END IF;
  END IF;

  UPDATE documents SET workflow_state = p_to WHERE id = p_document_id;

  IF p_to = 'locked' THEN
    SELECT EXISTS (SELECT 1 FROM signatures
                   WHERE document_id = p_document_id AND deleted_at IS NULL
                     AND signed_at IS NOT NULL) INTO v_signed;
    IF NOT v_signed THEN
      PERFORM remerge_contract_from_fields(p_document_id);
    END IF;
  END IF;

  IF p_to IN ('in_review','locked') THEN
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      SELECT DISTINCT v_org, pr.user_id,
        CASE p_to WHEN 'in_review' THEN 'contract_in_review' ELSE 'contract_locked' END,
        v_title || (CASE p_to WHEN 'in_review' THEN ' is ready for your review'
                              ELSE ' is ready to sign' END),
        '/app/contracts/' || p_document_id::text
      FROM document_parties dp
      JOIN profiles pr ON pr.contact_id = dp.contact_id
      WHERE dp.document_id = p_document_id
        AND pr.user_id IS NOT NULL
        AND pr.user_id <> auth.uid();
  END IF;

  RETURN p_to;
END;
$function$;

-- ── B. drop dead functions (deal wizard / billing / onboarding-horse / shim) ──
DROP FUNCTION IF EXISTS approve_line_item(uuid, date, boolean, text);   -- dead inbound provisioner (0 callers, stale)
DROP FUNCTION IF EXISTS create_purchase_engagement(uuid, uuid, uuid, numeric, numeric);
DROP FUNCTION IF EXISTS create_search_engagement(uuid, text, text, uuid);
DROP FUNCTION IF EXISTS create_lease_engagement(uuid, text, uuid, uuid);
DROP FUNCTION IF EXISTS create_service_engagement(uuid, text, uuid, date, text);
DROP FUNCTION IF EXISTS create_purchase_from_engagement(uuid);
DROP FUNCTION IF EXISTS create_billing_schedule(uuid, text, numeric, date, text, uuid, boolean, boolean);
DROP FUNCTION IF EXISTS set_billing_reminders(uuid, boolean);
DROP FUNCTION IF EXISTS billing_due_reminders(date);
DROP FUNCTION IF EXISTS settle_billable_lines(uuid, tstzrange);
DROP FUNCTION IF EXISTS my_onboarding_horse_step(uuid);
DROP FUNCTION IF EXISTS my_onboarding_attach_horse(uuid, uuid);
DROP FUNCTION IF EXISTS generate_document(uuid, text);   -- the 2-arg engagement shim

-- ── C. drop the engagement-based storage policy + the FK columns ─────────────
DROP POLICY IF EXISTS storage_client_read_engagement ON storage.objects;

-- the public-insert policy's WITH CHECK asserts converted_engagement_id IS NULL;
-- recreate it without that clause before the column drops (intake_submissions
-- itself stays — inbound is rebuilt on the spine in S2.5).
DROP POLICY IF EXISTS intake_submissions_public_insert ON intake_submissions;
CREATE POLICY intake_submissions_public_insert ON intake_submissions
  FOR INSERT TO anon
  WITH CHECK (
    status = 'NEW'
    AND reviewed_at IS NULL AND reviewed_by IS NULL
    AND length(payload::text) <= 20000
    AND (contact_name IS NULL OR length(contact_name) <= 200)
    AND (contact_email IS NULL OR (length(contact_email) <= 320 AND position('@' IN contact_email) > 1))
    AND EXISTS (SELECT 1 FROM form_definitions fd
                 WHERE fd.form_key = intake_submissions.form_key AND fd.active AND fd.audience = 'CLIENT')
  );

ALTER TABLE documents           DROP COLUMN IF EXISTS engagement_id;
ALTER TABLE request_selections  DROP COLUMN IF EXISTS engagement_id;
ALTER TABLE intake_submissions  DROP COLUMN IF EXISTS converted_engagement_id;
ALTER TABLE billable_lines      DROP COLUMN IF EXISTS transaction_id;

-- ── D. drop the seven legacy tables ──────────────────────────────────────────
DROP TABLE IF EXISTS engagement_parties  CASCADE;
DROP TABLE IF EXISTS engagement_stages   CASCADE;
DROP TABLE IF EXISTS service_assignments CASCADE;
DROP TABLE IF EXISTS billing_schedules   CASCADE;
DROP TABLE IF EXISTS client_purchases    CASCADE;
DROP TABLE IF EXISTS transactions        CASCADE;
DROP TABLE IF EXISTS engagements         CASCADE;

-- ── E. drop the now-orphan RLS helper ────────────────────────────────────────
DROP FUNCTION IF EXISTS caller_owns_engagement(uuid);
