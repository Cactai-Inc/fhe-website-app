-- TASK-ARCHIVE §3 — THE DELETED-ACCOUNTS VIEW.
--
-- Owner, 2026-08-22: "…its only visible to me in the deleted accounts view
-- which probably needs to be built."
--
-- THE ONE PLACE `deleted_at IS NOT NULL` ROWS ARE MEANT TO SURFACE. Everything
-- else in §2 went the other way; this is the counterweight that makes archiving
-- safe to do at all — an owner who hides an account has somewhere to go and
-- find it again, with the reason it was hidden and everything it is still
-- attached to.
--
-- Admin-gated (`has_staff_access() AND is_admin()`), matching the control that
-- archives in the first place and admin_account_action beside it. Both owners
-- carry ADMIN, so D26's Business Operations emphasis is a matter of where the
-- surface is filed, not of a narrower grant.

CREATE OR REPLACE FUNCTION public.archived_contacts()
 RETURNS TABLE(
   contact_id uuid, display_code text, first_name text, last_name text,
   email text, phone text, contact_type text, is_company boolean,
   archived_at timestamp with time zone, archived_by uuid, archived_by_name text,
   reason text, had_login boolean, login_suspended boolean,
   document_count bigint, executed_document_count bigint, signature_count bigint,
   party_document_count bigint, order_count bigint, horse_count bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id, c.display_code, c.first_name, c.last_name,
         c.email, c.phone, c.contact_type, coalesce(c.is_company, false),
         c.deleted_at, c.deleted_by,
         (SELECT nullif(btrim(coalesce(bp.first_name,'') || ' ' || coalesce(bp.last_name,'')), '')
            FROM profiles bp WHERE bp.user_id = c.deleted_by),
         c.deleted_reason,
         EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id),
         coalesce((SELECT bool_or(p.is_suspended) FROM profiles p WHERE p.contact_id = c.id), false),
         -- the footprint. These are counts of what SURVIVED the archive, which
         -- is the whole claim the feature makes; they are deliberately NOT
         -- filtered by contacts.deleted_at anywhere.
         (SELECT count(*) FROM documents d WHERE d.contact_id = c.id AND d.deleted_at IS NULL),
         (SELECT count(*) FROM documents d WHERE d.contact_id = c.id AND d.deleted_at IS NULL
                                             AND d.status = 'EXECUTED'),
         (SELECT count(*) FROM signatures s WHERE s.signer_contact_id = c.id),
         (SELECT count(DISTINCT dp.document_id) FROM document_parties dp WHERE dp.contact_id = c.id),
         (SELECT count(*) FROM purchases pu WHERE pu.buyer_contact_id = c.id AND pu.deleted_at IS NULL),
         (SELECT count(*) FROM horses h WHERE h.deleted_at IS NULL
            AND (h.current_owner_contact_id = c.id OR h.lessee_contact_id = c.id))
    FROM contacts c
   WHERE c.org_id = current_org()
     AND c.deleted_at IS NOT NULL
     AND coalesce(has_staff_access() AND is_admin(), false)
   ORDER BY c.deleted_at DESC
$function$;

COMMENT ON FUNCTION public.archived_contacts() IS
  'The deleted-accounts view (D11/D32, owner 2026-08-22). Who was archived, when, by whom and why — plus counts of the documents, signatures, orders and horses that are STILL THERE, because archiving destroys nothing. The only listing in the codebase that returns deleted_at IS NOT NULL rows.';

REVOKE ALL ON FUNCTION public.archived_contacts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archived_contacts() TO authenticated, service_role;

-- ── contact_dossier admits an archived contact ──────────────────────────────
-- §3: "Clicking through shows the full record exactly as it stood — documents,
-- signatures, contracts, purchases — nothing hidden from this specific view."
-- The dossier IS that record and already exists; a second one is not built.
-- Its existence gate refused archived rows outright, so the view had nothing to
-- click through to. The gate keeps its staff check and its org scope; only the
-- `deleted_at IS NULL` clause goes, and the caller is told the row is archived
-- via contact.deleted_at, which to_jsonb(c) already returns.
--
-- update_contact_record is deliberately NOT widened the same way: an archived
-- record is shown, not edited. The modal reads deleted_at and freezes itself.
DO $do$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'contact_dossier';
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'contact_dossier not found';
  END IF;
  IF position('WHERE id = p_contact_id AND org_id = v_org AND deleted_at IS NULL' in v_def) = 0 THEN
    IF position('WHERE id = p_contact_id AND org_id = v_org)' in v_def) > 0 THEN
      RAISE NOTICE 'contact_dossier already admits archived contacts — skipping';
      RETURN;
    END IF;
    RAISE EXCEPTION 'contact_dossier existence gate changed shape — re-derive this patch';
  END IF;
  v_def := replace(v_def,
    'WHERE id = p_contact_id AND org_id = v_org AND deleted_at IS NULL',
    'WHERE id = p_contact_id AND org_id = v_org');
  EXECUTE v_def;
END
$do$;
