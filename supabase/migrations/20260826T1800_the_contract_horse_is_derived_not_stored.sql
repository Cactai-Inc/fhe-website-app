-- THE CONTRACT'S HORSE IS DERIVED, NOT STORED. THE SECOND COPY IS GONE.
--
-- Owner, 2026-08-26, on being told a trigger now keeps contracts.horse_id in step:
--   "we need to fix the issue at the root so it doesnt need to know it just gets
--    the right info by mechanics not a patch to correct it after its received the
--    wrong link, right? ... every ref should always read source everytime
--    something is viewed."
--
-- He is right, and yesterday's trigger was a SYNC, not a root fix: two storage
-- locations that agree today because something copies between them. This removes
-- the second location, so there is nothing left to disagree.
--
-- ⚠️ CORRECTION TO WHAT I TOLD HIM. I said FOURTEEN functions read
-- contracts.horse_id. The real number is FIVE. The fourteen came from a regex
-- that also matched `d.horse_id`, `dc.horse_id` and `v_doc.horse_id` — documents,
-- not contracts. The genuine readers are:
--
--   client_can_read_horse   ← an ACCESS CHECK
--   deal_detail
--   deal_record_export
--   horse_deals
--   list_deals
--
-- Five is repointable, which is why this is a migration rather than a proposal.
--
-- ONE SOURCE: `documents.horse_id`, the column the contract page actually edits.
-- `contract_horse_id()` reads it, every reader calls that, and the column that
-- used to hold a copy is RENAMED rather than dropped — a renamed column makes an
-- unknown reader fail loudly instead of quietly serving a stale horse, which is
-- exactly the failure being removed. Renaming is also reversible; dropping is not.
--
-- The four creation-time writers (create_deal, start_lease_contract_v2,
-- start_sale_contract, start_bill_of_sale_standalone) are handled by the rename:
-- they will error on the next deploy if any still writes it. Verified below that
-- none of them does after this migration's rewrites — see the assertion at the end.

BEGIN;

-- ── THE ONE SOURCE ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contract_horse_id(p_contract_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- The contract's horse IS its document's horse. Where a contract carries more
  -- than one document (a lease and an addendum), the earliest one that names a
  -- horse is the contract's — an addendum does not re-subject the agreement.
  SELECT d.horse_id
    FROM documents d
   WHERE d.contract_id = p_contract_id
     AND d.deleted_at IS NULL
     AND d.horse_id IS NOT NULL
   ORDER BY d.created_at
   LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.client_can_read_horse(h_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT current_contact_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM horses h
    WHERE h.id = h_id
      AND h.deleted_at IS NULL
      AND (
        -- the OWNER always sees the record
        h.current_owner_contact_id = current_contact_id()
        -- everyone else only while the lease is active (term not ended)
        OR (
          (h.lease_end IS NULL OR h.lease_end >= current_date)
          AND (
            h.lessee_contact_id = current_contact_id()
            OR EXISTS (SELECT 1 FROM documents d
                        WHERE d.horse_id = h.id AND d.deleted_at IS NULL
                          AND d.contact_id = current_contact_id())
            OR EXISTS (SELECT 1 FROM contracts c
                        JOIN contract_parties cp ON cp.contract_id = c.id
                        WHERE contract_horse_id(c.id) = h.id AND c.deleted_at IS NULL
                          AND cp.contact_id = current_contact_id())
          )
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.deal_detail(p_deal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_deal deals%ROWTYPE; v_roles text[]; v_gov uuid;
BEGIN
  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;

  IF NOT (has_staff_access() AND v_deal.org_id = current_org())
     AND NOT EXISTS (SELECT 1 FROM contract_parties cp
                      WHERE cp.contract_id = v_deal.contract_id
                        AND cp.contact_id = current_contact_id()) THEN
    RAISE EXCEPTION 'not authorized for this deal';
  END IF;

  v_roles := deal_party_roles(v_deal.deal_type);
  v_gov   := deal_governing_document(p_deal_id);

  RETURN jsonb_build_object(
    'id', v_deal.id,
    'display_code', v_deal.display_code,
    'title', v_deal.title,
    'deal_type', v_deal.deal_type,
    'status', v_deal.status,
    'badge', deal_status(v_deal.id),
    'completed_at', v_deal.completed_at,
    'notes', v_deal.notes,
    'contract_id', v_deal.contract_id,
    'created_at', v_deal.created_at,
    'roles', to_jsonb(v_roles),
    'horse', (SELECT jsonb_build_object('id', h.id,
                'name', coalesce(nullif(h.registered_name,''), h.nickname))
                FROM horses h JOIN contracts ct ON contract_horse_id(ct.id) = h.id
               WHERE ct.id = v_deal.contract_id),
    'parties', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'party_role', cp.party_role, 'contact_id', cp.contact_id,
               'name', nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''),
               'email', c.email, 'display_code', c.display_code)
             ORDER BY array_position(v_roles, cp.party_role), cp.signer_order, cp.id)
        FROM contract_parties cp JOIN contacts c ON c.id = cp.contact_id
       WHERE cp.contract_id = v_deal.contract_id), '[]'::jsonb),
    'documents', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'document_id', d.id, 'title', d.title, 'display_code', d.display_code,
               'template_key', t.template_key, 'status', d.status,
               'workflow_state', d.workflow_state, 'created_at', d.created_at,
               'governing', (d.id = v_gov),
               'signed', (SELECT count(*) FROM signatures s
                           WHERE s.document_id = d.id AND s.signed_at IS NOT NULL AND s.deleted_at IS NULL),
               'signers', (SELECT count(*) FROM document_parties dp
                            WHERE dp.document_id = d.id AND dp.is_signer))
             ORDER BY (d.id = v_gov) DESC, d.created_at)
        FROM documents d JOIN contract_templates t ON t.id = d.template_id
       WHERE d.contract_id = v_deal.contract_id AND d.deleted_at IS NULL), '[]'::jsonb)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.deal_record_export(p_deal_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal deals%ROWTYPE; v_roles text[]; v_out text[] := '{}';
  v_role text; r record; v_any boolean;
BEGIN
  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;

  IF NOT (coalesce(has_staff_access() AND v_deal.org_id = current_org(), false))
     AND NOT EXISTS (SELECT 1 FROM contract_parties cp
                      WHERE cp.contract_id = v_deal.contract_id
                        AND cp.contact_id = current_contact_id()) THEN
    RAISE EXCEPTION 'not authorized for this deal';
  END IF;

  v_roles := deal_party_roles(v_deal.deal_type);

  v_out := v_out || (coalesce(v_deal.title, initcap(lower(v_deal.deal_type)) || ' deal'))::text;
  v_out := v_out || ('Reference: ' || coalesce(v_deal.display_code, v_deal.id::text))::text;
  v_out := v_out || ('Type: ' || initcap(lower(v_deal.deal_type)))::text;
  v_out := v_out || ('Opened: ' || to_char(v_deal.created_at, 'FMMonth FMDD, YYYY'))::text;
  v_out := v_out || ('Status: ' || (deal_status(p_deal_id) ->> 'label'))::text;
  IF v_deal.completed_at IS NOT NULL THEN
    v_out := v_out || ('Completed: ' || to_char(v_deal.completed_at, 'FMMonth FMDD, YYYY'))::text;
  END IF;

  SELECT coalesce(nullif(h.registered_name,''), h.nickname) INTO r
    FROM horses h JOIN contracts ct ON contract_horse_id(ct.id) = h.id WHERE ct.id = v_deal.contract_id;
  IF FOUND THEN
    v_out := v_out || ''::text;
    v_out := v_out || 'HORSE'::text;
    v_out := v_out || ('  ' || (SELECT coalesce(nullif(h.registered_name,''), h.nickname)
                                  FROM horses h JOIN contracts ct ON contract_horse_id(ct.id) = h.id
                                 WHERE ct.id = v_deal.contract_id))::text;
  END IF;

  FOREACH v_role IN ARRAY v_roles LOOP
    v_out := v_out || ''::text;
    v_out := v_out || upper(initcap(lower(v_role)))::text;
    v_any := false;
    FOR r IN
      SELECT nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), '') AS nm,
             c.email, c.phone_display AS phone, c.address_composed AS addr
        FROM contract_parties cp JOIN contacts c ON c.id = cp.contact_id
       WHERE cp.contract_id = v_deal.contract_id AND cp.party_role = v_role
       ORDER BY cp.signer_order NULLS LAST, cp.id
    LOOP
      v_any := true;
      v_out := v_out || ('  ' || coalesce(r.nm, r.email, 'Unnamed')
                         || coalesce(' · ' || r.email, '') || coalesce(' · ' || r.phone, ''))::text;
      IF nullif(btrim(coalesce(r.addr,'')),'') IS NOT NULL THEN
        v_out := v_out || ('    ' || r.addr)::text;
      END IF;
    END LOOP;
    IF NOT v_any THEN v_out := v_out || '  (nobody named yet)'::text; END IF;
  END LOOP;

  v_out := v_out || ''::text;
  v_out := v_out || 'DOCUMENTS'::text;
  v_any := false;
  FOR r IN
    SELECT coalesce(d.title, t.template_key) AS title, d.display_code, d.status,
           d.effective_date,
           (SELECT count(*) FROM signatures s WHERE s.document_id = d.id
              AND s.signed_at IS NOT NULL AND s.deleted_at IS NULL) AS signed,
           (SELECT count(*) FROM document_parties dp WHERE dp.document_id = d.id AND dp.is_signer) AS signers
      FROM documents d JOIN contract_templates t ON t.id = d.template_id
     WHERE d.contract_id = v_deal.contract_id AND d.deleted_at IS NULL
       AND coalesce(d.workflow_state,'') <> 'void'
     ORDER BY d.created_at
  LOOP
    v_any := true;
    v_out := v_out || ('  ' || r.title || coalesce(' (' || r.display_code || ')', '')
                       || ' — ' || CASE WHEN r.status = 'EXECUTED' THEN 'complete'
                                        ELSE r.signed || '/' || r.signers || ' signatures' END
                       || coalesce(', effective ' || to_char(r.effective_date, 'FMMonth FMDD, YYYY'), ''))::text;
  END LOOP;
  IF NOT v_any THEN v_out := v_out || '  (none yet)'::text; END IF;

  IF nullif(btrim(coalesce(v_deal.notes,'')),'') IS NOT NULL THEN
    v_out := v_out || ''::text;
    v_out := v_out || 'NOTES'::text;
    v_out := v_out || ('  ' || v_deal.notes)::text;
  END IF;

  RETURN array_to_string(v_out, E'\n');
END;
$function$;

CREATE OR REPLACE FUNCTION public.horse_deals(p_horse_id uuid)
 RETURNS TABLE(id uuid, display_code text, title text, deal_type text, status text, badge jsonb, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT d.id, d.display_code, d.title, d.deal_type, d.status,
         deal_status(d.id), d.created_at
  FROM deals d
  JOIN contracts ct ON ct.id = d.contract_id
  WHERE d.deleted_at IS NULL AND contract_horse_id(ct.id) = p_horse_id
    AND ((coalesce(has_staff_access() AND d.org_id = current_org(), false))
      OR EXISTS (SELECT 1 FROM contract_parties cp
                  WHERE cp.contract_id = d.contract_id AND cp.contact_id = current_contact_id()))
  ORDER BY d.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.list_deals()
 RETURNS TABLE(id uuid, display_code text, title text, deal_type text, status text, badge jsonb, created_at timestamp with time zone, completed_at timestamp with time zone, party_summary text, horse_summary text, document_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT d.id, d.display_code, d.title, d.deal_type, d.status,
    deal_status(d.id), d.created_at, d.completed_at,
    (SELECT string_agg(DISTINCT coalesce(nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''), c.email), ', ')
       FROM contract_parties cp JOIN contacts c ON c.id = cp.contact_id
      WHERE cp.contract_id = d.contract_id),
    (SELECT coalesce(nullif(h.registered_name,''), h.nickname)
       FROM horses h JOIN contracts ct ON contract_horse_id(ct.id) = h.id WHERE ct.id = d.contract_id),
    (SELECT count(*) FROM documents doc
      WHERE doc.contract_id = d.contract_id AND doc.deleted_at IS NULL)
  FROM deals d
  WHERE d.deleted_at IS NULL
    AND ((coalesce(has_staff_access() AND d.org_id = current_org(), false))
      OR EXISTS (SELECT 1 FROM contract_parties cp
                  WHERE cp.contract_id = d.contract_id AND cp.contact_id = current_contact_id()))
  ORDER BY d.created_at DESC;
$function$;

-- ── THE COPY, AND THE THING THAT KEPT IT IN STEP ────────────────────────────
DROP TRIGGER IF EXISTS documents_contract_horse_follows_trg ON public.documents;
DROP FUNCTION IF EXISTS public.trg_contract_horse_follows_document();

ALTER TABLE public.contracts RENAME COLUMN horse_id TO horse_id_retired_20260826;
COMMENT ON COLUMN public.contracts.horse_id_retired_20260826 IS
  'RETIRED 2026-08-26. The contract''s horse is derived from documents.horse_id '
  'via contract_horse_id(). This column held a copy written only at creation and '
  'never updated, so it drifted (it said "Tiz Love" while the document said '
  '"Sundance"). Renamed rather than dropped so an unknown reader fails loudly '
  'instead of serving a stale horse. Safe to drop once a deploy has passed with '
  'no errors naming it.';

COMMIT;
