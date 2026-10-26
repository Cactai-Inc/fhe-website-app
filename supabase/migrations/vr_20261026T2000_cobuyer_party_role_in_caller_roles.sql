-- VALIDATION ROUND — the co-buyer could not initial their own COBUYER lines.
--
-- A co-buyer is seated as a SECOND BUYER party row (set_document_co_buyer inserts
-- party_role='BUYER' with the next signer_order — there is no COBUYER party_role in
-- the document_parties CHECK). The convention, already used by record_signature and
-- contract_lock_blockers, is: among the BUYER parties ordered by
-- (signer_order NULLS LAST, id), rn=1 is the BUYER namespace and any later one is the
-- COBUYER namespace.
--
-- caller_party_roles did NOT apply that translation — it returned the raw party_role,
-- so the co-buyer's caller role came back as 'BUYER'. set_contract_field authorizes a
-- per-person initials field (format_type='initials') by an EXACT owner_role match
-- (the BUYER/COBUYER cross-edit branch is deliberately excluded for initials and
-- signer fields). So a COBUYER-owned initials field (e.g. ACK.DELIVERY_BOARD_COBUYER,
-- the F1 co-buyer delivery/board acknowledgment) could never be written by the
-- co-buyer: r='BUYER' never equals owner_role='COBUYER', and the cross-branch is off
-- for initials. The co-buyer's own signature-adjacent acknowledgments were unreachable.
--
-- Fix: caller_party_roles translates the caller's BUYER party_role to COBUYER when the
-- caller is not the lowest-ordered BUYER on the document — the same rn>1 rule the rest
-- of the engine already uses. It is a REPLACEMENT, not an addition: the co-buyer now
-- returns COBUYER (not BUYER), so they own their COBUYER initials AND are correctly
-- refused the primary buyer's BUYER initials; the primary buyer still returns BUYER.
-- The deterministic ORDER BY also stabilizes comment_author_identity's LIMIT 1.
--
-- Beneficiaries beyond set_contract_field, all through the same v_owns_role pattern or
-- role-set aggregation: set_field_structured (identical latent bug), and the role-set
-- readers contract_document_detail / contract_intake_requirements / log_contract_change
-- (the co-buyer's COBUYER controls and fields now resolve). The LESSOR-only checks in
-- confirm_horse_section / reopen_horse_section are unaffected (they test r='LESSOR').

BEGIN;

CREATE OR REPLACE FUNCTION public.caller_party_roles(p_document_id uuid)
 RETURNS SETOF text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH ranked AS (
    SELECT dp.party_role,
           dp.contact_id,
           CASE WHEN dp.party_role = 'BUYER'
                THEN row_number() OVER (PARTITION BY dp.party_role
                                        ORDER BY dp.signer_order NULLS LAST, dp.id)
                ELSE 1 END AS rn
    FROM documents d
    JOIN document_parties dp ON dp.document_id = d.id
    WHERE d.id = p_document_id
      AND d.deleted_at IS NULL
      AND current_contact_id() IS NOT NULL
  )
  SELECT CASE WHEN party_role = 'BUYER' AND rn > 1 THEN 'COBUYER' ELSE party_role END
  FROM ranked
  WHERE contact_id = current_contact_id()
  ORDER BY 1;
$function$;

COMMIT;
