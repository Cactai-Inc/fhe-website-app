-- Fix round 3, item 4 — contract staging and the party's first login.
--
-- Two DB changes; the rest of item 4 is UI (NewContractPage seat gate,
-- PartiesHorseCard empty-seat rendering) and already-built mechanisms (the RPCs
-- accept a NULL counterparty/horse; send_contract_to_party and contract-invite
-- refuse an empty seat; staff attach a party/horse from the contract page).
--
-- 1. document_parties_summary reports the EXPECTED party roles for the contract's
--    template kind, so the Parties & Horse card can render an empty counterparty
--    seat (with its attach affordance) even when no party row exists yet — the
--    case a staged contract created with one seat empty leaves behind.
--
-- 2. set_my_onboarding_horses attaches the member's primary horse to every STAGED
--    CONTRACT where their seat is filled and the contract has no horse yet, then
--    the existing attach_horse_to_document sync fills the HORSE.* fields. So when
--    an invited party completes their horse at first login, the contract they land
--    on already carries that horse.

BEGIN;

-- ── 1. expected_roles on the parties summary ────────────────────────────────
CREATE OR REPLACE FUNCTION public.document_parties_summary(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_horse uuid; v_kind text; v_expected text[];
BEGIN
  SELECT d.org_id, d.horse_id, ct.contract_kind
    INTO v_org, v_horse, v_kind
    FROM documents d
    LEFT JOIN contract_templates ct ON ct.id = d.template_id
   WHERE d.id = p_document_id AND d.deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT ((coalesce(has_staff_access() AND v_org = current_org(), false)) OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- The two signing seats this contract kind expects. A staged contract may have
  -- only one filled; the card renders the other as an attachable empty seat.
  v_expected := CASE
    WHEN v_kind = 'HORSE_LEASE' THEN ARRAY['LESSOR','LESSEE']
    WHEN v_kind IN ('HORSE_SALE','HORSE_BILL_OF_SALE','HORSE_PURCHASE_SALE') THEN ARRAY['SELLER','BUYER']
    ELSE ARRAY[]::text[]
  END;

  RETURN jsonb_build_object(
    'parties', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'party_role', dp.party_role,
          'contact_id', dp.contact_id,
          'name',  nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''),
          'email', nullif(btrim(coalesce(c.email,'')), ''),
          'phone', nullif(btrim(coalesce(c.phone,'')), ''),
          'address', nullif(btrim(coalesce(
                       nullif(btrim(coalesce(c.address_composed,'')),''),
                       compose_address(c.address_line1, c.address_line2, c.city, c.state, c.postal_code)
                     ,'')), ''),
          'address_line1', c.address_line1, 'address_line2', c.address_line2,
          'city', c.city, 'state', c.state, 'postal_code', c.postal_code,
          'first_name', c.first_name, 'last_name', c.last_name,
          'awaiting_details', coalesce(c.name_needs_confirmation, false),
          'missing', (
            SELECT coalesce(jsonb_agg(m), '[]'::jsonb) FROM (
              SELECT 'name'    AS m WHERE nullif(btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')),'') IS NULL
              UNION ALL SELECT 'email'   WHERE nullif(btrim(coalesce(c.email,'')),'') IS NULL
              UNION ALL SELECT 'phone'   WHERE nullif(btrim(coalesce(c.phone,'')),'') IS NULL
              UNION ALL SELECT 'address' WHERE nullif(btrim(coalesce(
                         nullif(btrim(coalesce(c.address_composed,'')),''),
                         compose_address(c.address_line1,c.address_line2,c.city,c.state,c.postal_code)
                       ,'')),'') IS NULL
            ) q
          ))
        ORDER BY dp.party_role, dp.signer_order NULLS LAST, dp.id)
      FROM document_parties dp
      LEFT JOIN contacts c ON c.id = dp.contact_id
      WHERE dp.document_id = p_document_id
        AND dp.party_role IN ('LESSEE','LESSOR','BUYER','SELLER')), '[]'::jsonb),
    -- the roles this contract kind expects, so the card can show an empty seat
    'expected_roles', to_jsonb(v_expected),
    'horse_id', v_horse,
    'horse_name', (SELECT coalesce(nullif(registered_name,''), nickname) FROM horses WHERE id = v_horse),
    'horse_missing', CASE WHEN v_horse IS NULL THEN jsonb_build_array('horse')
      ELSE coalesce((SELECT jsonb_agg(m) FROM (
        SELECT 'identity' AS m FROM horses h WHERE h.id = v_horse
         AND nullif(btrim(coalesce(h.registered_name,'')),'') IS NULL
         AND nullif(btrim(coalesce(h.nickname,'')),'') IS NULL
      ) q), '[]'::jsonb) END
  );
END;
$function$;

-- ── 2. first-login horse attaches to the member's staged contracts ───────────
-- Append the staged-contract attach to set_my_onboarding_horses, read from the
-- live body so the rest of the function is untouched. The anchor is the comment
-- that introduces the purchase horse-id carry; the new block runs just before it.
DO $mig$
DECLARE
  v_src text := pg_get_functiondef('public.set_my_onboarding_horses(uuid[],uuid[])'::regprocedure);
  v_anchor text := '  -- the purchase keeps carrying the PRIMARY horse (unchanged behaviour)';
  v_insert text := '  -- FIX ROUND 3, item 4: the member''s primary horse attaches to every STAGED
  -- CONTRACT where their seat is filled and the contract has no horse yet. The
  -- party who activates and completes their horse lands on the contract with the
  -- horse''s fields already filled (attach_horse_to_document does the sync).
  IF coalesce(array_length(p_horse_ids, 1), 0) > 0 THEN
    FOR v_doc IN
      SELECT d.id
        FROM documents d
       WHERE d.deleted_at IS NULL
         AND d.contract_id IS NOT NULL
         AND d.horse_id IS NULL
         AND d.status <> ''EXECUTED''
         AND d.workflow_state IN (''editable'',''editing'',''in_review'')
         AND EXISTS (SELECT 1 FROM document_parties dp
                      WHERE dp.document_id = d.id AND dp.contact_id = v_contact)
    LOOP
      BEGIN
        PERFORM attach_horse_to_document(v_doc.id, p_horse_ids[1]);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING ''set_my_onboarding_horses: staged-contract attach failed for %: %'', v_doc.id, SQLERRM;
      END;
    END LOOP;
  END IF;

';
BEGIN
  IF position(v_anchor in v_src) = 0 THEN RAISE EXCEPTION 'set_my_onboarding_horses anchor not found'; END IF;
  v_src := replace(v_src, v_anchor, v_insert || v_anchor);
  EXECUTE v_src;
END $mig$;

COMMIT;
