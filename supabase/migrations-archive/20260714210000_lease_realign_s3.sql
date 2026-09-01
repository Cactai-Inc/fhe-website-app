/*
  # Lease realign · Slice 3 — sublease governed by the contract; lease reference

  Sublease permission is the LESSOR's sole discretion, set on the lease CONTRACT
  (TXN.SUBLEASE_ALLOWED), not the horse record. Listing eligibility now reads it
  from the horse's executed lease document. Non-owners remain blocked from
  listing for sale (unchanged). Plus a small reader so the horse record can link
  to the active lease document.

  A. lease_sublease_allowed(horse) — reads the executed lease's SUBLEASE_ALLOWED.
  B. can_list_horse rewritten to use it.
  C. horse_active_lease_doc(horse) — {document_id, display_code} for the record.

  NOTE: horses.sublease_allowed is now deprecated (no longer read or shown); the
  physical column drop is deferred (several intake functions still write it
  harmlessly) — tracked for a cleanup pass.
*/

-- ── A. sublease permission from the executed lease contract ───────────────────
CREATE OR REPLACE FUNCTION lease_sublease_allowed(p_horse_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT coalesce(lower(btrim(cf.value)) IN ('true','yes','1','checked','on'), false)
  FROM documents dc
  JOIN contract_templates t ON t.id = dc.template_id
  JOIN contract_fields cf ON cf.document_id = dc.id AND cf.field_key = 'TXN.SUBLEASE_ALLOWED'
  WHERE dc.horse_id = p_horse_id AND t.template_key = 'HORSE_LEASE'
    AND dc.status = 'EXECUTED' AND dc.deleted_at IS NULL
  ORDER BY dc.effective_date DESC NULLS LAST, dc.created_at DESC
  LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION lease_sublease_allowed(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION lease_sublease_allowed(uuid) TO authenticated, service_role;

-- ── B. listing eligibility — sublease from the contract ──────────────────────
CREATE OR REPLACE FUNCTION can_list_horse(p_horse_id uuid, p_intent text DEFAULT 'sale')
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_h horses%ROWTYPE;
  v_me uuid := current_contact_id();
  v_leased boolean;
BEGIN
  SELECT * INTO v_h FROM horses
   WHERE id = p_horse_id AND org_id = current_org() AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN false; END IF;
  IF has_staff_access() THEN RETURN true; END IF;

  v_leased := v_h.lessee_contact_id IS NOT NULL
              AND (v_h.lease_end IS NULL OR v_h.lease_end >= current_date);

  -- the OWNER may always list for sale; may list for lease only when not already leased
  IF v_h.current_owner_contact_id = v_me THEN
    IF p_intent = 'lease' THEN RETURN NOT v_leased; END IF;
    RETURN true;
  END IF;
  -- the LESSEE may list for sublease only when the executed lease permits it
  IF v_h.lessee_contact_id = v_me AND v_leased THEN
    RETURN p_intent = 'lease' AND lease_sublease_allowed(p_horse_id);
  END IF;
  RETURN false;   -- non-owner/non-lessee: never (incl. never for sale)
END;
$fn$;

-- ── C. the active lease document for a horse (for the record reference) ──────
CREATE OR REPLACE FUNCTION horse_active_lease_doc(p_horse_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT jsonb_build_object('document_id', dc.id, 'display_code', dc.display_code,
                            'effective_date', dc.effective_date)
  FROM documents dc
  JOIN contract_templates t ON t.id = dc.template_id
  WHERE dc.horse_id = p_horse_id AND t.template_key = 'HORSE_LEASE'
    AND dc.status = 'EXECUTED' AND dc.deleted_at IS NULL
    AND dc.org_id = current_org()
  ORDER BY dc.effective_date DESC NULLS LAST, dc.created_at DESC
  LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION horse_active_lease_doc(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION horse_active_lease_doc(uuid) TO authenticated, service_role;
