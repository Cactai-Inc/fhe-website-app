-- PARTYEMAIL PHASE 2 — the /sign form collects a full address.
--
-- D22 §0 (owner, 2026-08-20): "the form they fill in when they use the link for
-- /sign/deal they enter their full name, phone number, email, and full address."
--
-- The form collected three of the four. `.ADDRESS` is one of the five party tokens
-- fill_party_fields_from_contacts writes, and NO path populated it for a
-- self-service signer — staff had to type it into the CRM by hand, or the contract
-- printed a party with no address on it.
--
-- fill_claimant_details is the existing "write what they typed onto the contact,
-- blanks only, never overwriting staff's record" helper. It gains the five address
-- components and keeps exactly that semantics. api/sign-start.ts calls it on BOTH
-- branches now — the deal claim (as before) and the provisioning paths (new), using
-- the contact_id provision_client_invitation already returns — so one helper writes
-- the address whichever door the person came through.
--
-- contacts.address_composed is a GENERATED column (compose_address of the five
-- parts) and is never written; it recomputes from what is set here.

CREATE OR REPLACE FUNCTION public.fill_claimant_details(
  p_contact_id uuid, p_first_name text, p_last_name text, p_phone text,
  p_address_line1 text DEFAULT NULL::text, p_address_line2 text DEFAULT NULL::text,
  p_city text DEFAULT NULL::text, p_state text DEFAULT NULL::text,
  p_postal_code text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE contacts
     SET first_name = CASE WHEN nullif(btrim(coalesce(first_name,'')),'') IS NULL
                           THEN nullif(btrim(coalesce(p_first_name,'')),'') ELSE first_name END,
         last_name  = CASE WHEN nullif(btrim(coalesce(last_name,'')),'') IS NULL
                           THEN nullif(btrim(coalesce(p_last_name,'')),'') ELSE last_name END,
         phone      = CASE WHEN nullif(btrim(coalesce(phone,'')),'') IS NULL
                           THEN nullif(btrim(coalesce(p_phone,'')),'') ELSE phone END,
         address_line1 = CASE WHEN nullif(btrim(coalesce(address_line1,'')),'') IS NULL
                           THEN nullif(btrim(coalesce(p_address_line1,'')),'') ELSE address_line1 END,
         address_line2 = CASE WHEN nullif(btrim(coalesce(address_line2,'')),'') IS NULL
                           THEN nullif(btrim(coalesce(p_address_line2,'')),'') ELSE address_line2 END,
         city          = CASE WHEN nullif(btrim(coalesce(city,'')),'') IS NULL
                           THEN nullif(btrim(coalesce(p_city,'')),'') ELSE city END,
         state         = CASE WHEN nullif(btrim(coalesce(state,'')),'') IS NULL
                           THEN nullif(btrim(coalesce(p_state,'')),'') ELSE state END,
         postal_code   = CASE WHEN nullif(btrim(coalesce(postal_code,'')),'') IS NULL
                           THEN nullif(btrim(coalesce(p_postal_code,'')),'') ELSE postal_code END,
         -- the person told us their own name: it no longer needs confirming, and
         -- the stub an email-only party was created as stops being a stub.
         name_needs_confirmation = CASE
           WHEN nullif(btrim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')), '') IS NOT NULL
             OR nullif(btrim(coalesce(p_first_name,'') || ' ' || coalesce(p_last_name,'')), '') IS NOT NULL
           THEN false ELSE name_needs_confirmation END
   WHERE id = p_contact_id;
END;
$function$;

-- The 4-argument signature is REPLACED, not kept alongside: PostgREST resolves an
-- RPC by the argument names in the request body, and two overloads differing only
-- by defaulted arguments make that ambiguous ("could not choose the best candidate
-- function"). api/sign-start.ts is the only caller and moves in the same commit.
DROP FUNCTION IF EXISTS public.fill_claimant_details(uuid, text, text, text);

REVOKE EXECUTE ON FUNCTION public.fill_claimant_details(uuid, text, text, text, text, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fill_claimant_details(uuid, text, text, text, text, text, text, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.fill_claimant_details(uuid, text, text, text, text, text, text, text, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.fill_claimant_details(uuid, text, text, text, text, text, text, text, text) TO service_role;
