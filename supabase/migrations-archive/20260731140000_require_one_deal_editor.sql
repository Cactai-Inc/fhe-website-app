-- ─────────────────────────────────────────────────────────────────────────────
-- AT LEAST ONE PARTY MUST BE ABLE TO EDIT DEAL TERMS (2026-07-31, owner)
--
-- THE PROBLEM. can_edit_deal is per party and both can be off at once. In that
-- state nobody on either side can change a term: the parties can at most SUGGEST
-- (and only if can_suggest is on), which leaves staff acting on their behalf as
-- the sole route to any edit. The owner does not want to build the tooling that
-- would make that workable, so the configuration that requires it should not be
-- reachable in the first place.
--
-- Enforced HERE rather than in the UI because the UI is not the only writer —
-- set_party_controls is a staff RPC that anything could call. A rule that
-- protects a document's editability belongs next to the data.
--
-- The check is deliberately narrow: it fires only when the change would leave
-- EVERY signing party unable to edit. Turning one party off while the other is
-- on is normal and stays allowed.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_party_controls(
  p_document_id uuid, p_role text,
  p_can_fill boolean, p_can_edit_deal boolean,
  p_can_suggest boolean, p_can_add_clause boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_role text := upper(p_role);
  v_others int;
BEGIN
  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT (has_staff_access() AND v_org = current_org()) THEN
    RAISE EXCEPTION 'staff access required';
  END IF;

  -- Turning this party OFF is refused when no OTHER party is left holding it.
  -- Counted over the parties that actually sign, so the company's own role
  -- cannot be mistaken for a counterparty that could carry the permission.
  IF NOT p_can_edit_deal THEN
    SELECT count(*) INTO v_others
      FROM document_party_controls c
      JOIN document_parties dp
        ON dp.document_id = c.document_id AND dp.party_role = c.party_role
     WHERE c.document_id = p_document_id
       AND c.party_role <> v_role
       AND c.can_edit_deal
       AND dp.is_signer
       AND dp.party_role NOT IN ('FHE', 'COMPANY');

    IF v_others = 0 THEN
      RAISE EXCEPTION 'at least one party must be able to edit deal terms — '
        'otherwise no party can change a term and every edit has to go through staff';
    END IF;
  END IF;

  INSERT INTO document_party_controls (document_id, party_role, can_fill, can_edit_deal, can_suggest, can_add_clause, org_id)
  VALUES (p_document_id, v_role, p_can_fill, p_can_edit_deal, p_can_suggest, p_can_add_clause, v_org)
  ON CONFLICT (document_id, party_role)
  DO UPDATE SET can_fill = excluded.can_fill,
                can_edit_deal = excluded.can_edit_deal,
                can_suggest = excluded.can_suggest,
                can_add_clause = excluded.can_add_clause;
END;
$function$;

COMMENT ON FUNCTION public.set_party_controls(uuid, text, boolean, boolean, boolean, boolean) IS
  'Sets one party''s document controls. REFUSES a change that would leave no '
  'signing party able to edit deal terms: in that state the parties can at most '
  'suggest, and every actual edit has to be made by staff on their behalf. '
  'Turning one party off while another holds the permission is unaffected.';
