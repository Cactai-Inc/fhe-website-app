/*
  # The deal is a blank named container (owner correction, 2026-08-04)

  The first build captured WHAT EACH SIDE GIVES at the deal level. That was the
  mistake: a deal knows nothing on its own — everything it reports comes from the
  documents inside it. The consideration layer is therefore dead and is dropped
  here rather than left as unused residue.

  What a deal now holds: a NAME the user gives it, its type, its parties, its
  horse, and its documents. Everything else is derived.

  Also here:
    deals.title              — the user's own name for the deal.
    deals.reference prefix   — FHE- (tenant-wide standard), replacing DEA-.
    deal_status(deal)        — the derived badge: created / editable /
                               signed n-of-m / complete, following the GOVERNING
                               document (the bill of sale for a sale, the lease
                               agreement for a lease). Optional add-ons never
                               change the badge and never gate completion.
    deal_activity(deal)      — who did what, when, and to what outcome.
*/

-- ── the consideration layer goes ────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.add_deal_consideration(uuid, text, text, uuid, numeric, text);
DROP FUNCTION IF EXISTS public.remove_deal_consideration(uuid);
DROP TABLE IF EXISTS public.deal_consideration;

-- ── the user's own name for the deal ────────────────────────────────────────
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS title text;

COMMENT ON COLUMN public.deals.title IS
  'The name the user gives this deal. A deal is a blank named container — what '
  'it reports comes from the documents inside it, not from fields on the deal.';

-- ── FHE- reference prefix (tenant-wide standard) ────────────────────────────
DROP TRIGGER IF EXISTS deals_assign_code ON public.deals;
CREATE TRIGGER deals_assign_code BEFORE INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.assign_display_code('FHE-', 'deal_code_seq');

-- existing DEA- codes are re-stamped: nothing external references them yet
UPDATE public.deals SET display_code = 'FHE-' || split_part(display_code, '-', 2)
 WHERE display_code LIKE 'DEA-%';

-- ── the governing document, and the deal's derived status ───────────────────
-- The BOS governs a sale; the lease agreement governs a lease. An optional
-- agreement or affidavit is an add-on: it never changes the badge and never
-- blocks completion (owner ruling — do not overbuild for the edge case where a
-- party attaches a document they then decline to sign).
CREATE OR REPLACE FUNCTION public.deal_governing_template(p_deal_type text)
 RETURNS text
 LANGUAGE sql IMMUTABLE
AS $function$
  SELECT CASE p_deal_type
           WHEN 'SALE'  THEN 'HORSE_BILL_OF_SALE'
           WHEN 'LEASE' THEN 'HORSE_LEASE_V2'
         END;
$function$;

/* The badge vocabulary (owner, 2026-08-04):
     created   — the deal exists; its documents have not been opened for editing
     editable  — being worked on
     signed    — at least one signature captured, shown as n/m
     complete  — every required signature captured on the governing document
   "Sent" is deliberately NOT a status: notifying someone is an ACTIVITY, and it
   belongs in the activity log, not on a badge. */
CREATE OR REPLACE FUNCTION public.deal_status(p_deal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal   deals%ROWTYPE;
  v_tmpl   text;
  v_doc    record;
  v_need   int;
  v_have   int;
BEGIN
  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;

  IF v_deal.status = 'void' THEN
    RETURN jsonb_build_object('code', 'void', 'label', 'Void');
  END IF;

  v_tmpl := deal_governing_template(v_deal.deal_type);

  SELECT d.id, d.workflow_state, d.status INTO v_doc
    FROM documents d JOIN contract_templates t ON t.id = d.template_id
   WHERE d.contract_id = v_deal.contract_id AND d.deleted_at IS NULL
     AND coalesce(d.workflow_state,'') <> 'void' AND t.template_key = v_tmpl
   ORDER BY d.created_at DESC LIMIT 1;

  -- no governing document yet: the deal exists, nothing has been opened
  IF NOT FOUND THEN
    RETURN jsonb_build_object('code', 'created', 'label', 'Created');
  END IF;

  SELECT count(*) FILTER (WHERE dp.is_signer) INTO v_need
    FROM document_parties dp WHERE dp.document_id = v_doc.id;
  SELECT count(*) INTO v_have
    FROM signatures s
   WHERE s.document_id = v_doc.id AND s.signed_at IS NOT NULL AND s.deleted_at IS NULL;

  IF v_doc.workflow_state = 'executed' OR (v_need > 0 AND v_have >= v_need) THEN
    RETURN jsonb_build_object('code', 'complete', 'label', 'Complete',
                              'signed', v_have, 'required', v_need);
  END IF;

  IF v_have > 0 THEN
    RETURN jsonb_build_object('code', 'signed',
                              'label', 'Signed ' || v_have || '/' || greatest(v_need, v_have),
                              'signed', v_have, 'required', greatest(v_need, v_have));
  END IF;

  RETURN jsonb_build_object('code', 'editable', 'label', 'Editable');
END;
$function$;

-- ── activity log: who did what, when, to what outcome ───────────────────────
-- Composed from records the system already keeps, so nothing new has to be
-- written at action time: document lifecycle, the contract change log (which
-- carries signature removals and permission requests), and signatures.
CREATE OR REPLACE FUNCTION public.deal_activity(p_deal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_deal deals%ROWTYPE;
BEGIN
  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;

  IF NOT (has_staff_access() AND v_deal.org_id = current_org())
     AND NOT EXISTS (SELECT 1 FROM contract_parties cp
                      WHERE cp.contract_id = v_deal.contract_id
                        AND cp.contact_id = current_contact_id()) THEN
    RAISE EXCEPTION 'not authorized for this deal';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(x ORDER BY (x ->> 'at') DESC)
    FROM (
      -- the deal itself
      SELECT jsonb_build_object(
        'at', v_deal.created_at, 'who', coalesce(nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''), 'Staff'),
        'what', 'Deal created', 'detail', v_deal.title, 'document_id', NULL) AS x
        FROM contacts c WHERE c.id = v_deal.created_by_contact_id
      UNION ALL
      -- a document was added
      SELECT jsonb_build_object(
        'at', d.created_at, 'who', coalesce(nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''), 'Staff'),
        'what', 'Document added', 'detail', coalesce(d.title, t.template_key), 'document_id', d.id)
        FROM documents d
        JOIN contract_templates t ON t.id = d.template_id
        LEFT JOIN contacts c ON c.id = d.originator_contact_id
       WHERE d.contract_id = v_deal.contract_id AND d.deleted_at IS NULL
      UNION ALL
      -- signatures given
      SELECT jsonb_build_object(
        'at', s.signed_at, 'who', s.typed_name,
        'what', 'Signed', 'detail', coalesce(d.title, t.template_key), 'document_id', d.id)
        FROM signatures s
        JOIN documents d ON d.id = s.document_id
        JOIN contract_templates t ON t.id = d.template_id
       WHERE d.contract_id = v_deal.contract_id AND s.signed_at IS NOT NULL AND s.deleted_at IS NULL
      UNION ALL
      -- everything the change log already records (signature removals,
      -- permission requests, review requests, field edits)
      SELECT jsonb_build_object(
        'at', l.created_at, 'who', coalesce(l.actor_label, 'Someone'),
        'what', CASE l.change_kind
                  WHEN 'signature_removed'          THEN 'Signature removed'
                  WHEN 'edit_permission_requested'  THEN 'Asked to edit'
                  WHEN 'review_requested'           THEN 'Asked for review'
                  WHEN 'field_value'                THEN 'Changed ' || coalesce(l.field_label, l.field_key)
                  ELSE initcap(replace(l.change_kind, '_', ' ')) END,
        'detail', coalesce(d.title, t.template_key), 'document_id', d.id)
        FROM contract_change_log l
        JOIN documents d ON d.id = l.document_id
        JOIN contract_templates t ON t.id = d.template_id
       WHERE d.contract_id = v_deal.contract_id
         AND l.change_kind <> 'field_value'   -- field noise stays in the document's own history
    ) t), '[]'::jsonb);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.deal_governing_template(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deal_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deal_activity(uuid) TO authenticated;
