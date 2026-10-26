-- Fix round 3, item 4 — clearer refusal when sending a staged contract to an
-- empty seat. send_contract_to_party already refuses an empty seat ("that party
-- has no contact to send to"); reword it to name the seat and point staff at the
-- attach affordance, matching the API-layer message.
--
-- Read the live body and swap only the one RAISE so the rest of the function
-- (horse-missing check, role-bundle generation, notifications) is untouched.

BEGIN;

DO $mig$
DECLARE
  v_src text := pg_get_functiondef('public.send_contract_to_party(uuid,text)'::regprocedure);
  v_old text := 'IF v_target IS NULL THEN RAISE EXCEPTION ''that party has no contact to send to''; END IF;';
  v_new text := 'IF v_target IS NULL THEN RAISE EXCEPTION ''The % seat is empty — attach the % on the contract page before sending it.'', lower(p_party_role), lower(p_party_role); END IF;';
BEGIN
  IF position(v_old in v_src) = 0 THEN RAISE EXCEPTION 'send_contract_to_party empty-seat RAISE not found'; END IF;
  v_src := replace(v_src, v_old, v_new);
  EXECUTE v_src;
END $mig$;

COMMIT;
