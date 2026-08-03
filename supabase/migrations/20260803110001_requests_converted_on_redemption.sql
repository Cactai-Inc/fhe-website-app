/*
  # requests.status = 'converted' — close the inbound lifecycle (deal plan L11)

  Audit finding: the `requests` status vocabulary declares
  new → contacted → invited → converted (+ expired), but NOTHING ever wrote
  'converted'. provision_client_invitation advances a request to 'invited'; the
  lifecycle then stopped there forever, so the inbound queue could never
  distinguish "invite sent" from "they actually joined".

  The natural completion point is REDEMPTION: the invited person creates their
  account, so the request that produced them is converted. invitations.request_id
  already carries the link (stamped by provision_client_invitation), so this is a
  single guarded UPDATE beside the existing invitation-redeemed write.

  Verified before writing: no other function writes requests.status = 'converted';
  the CHECK constraint already permits the value; the one 'scheduled' write inside
  schedule_lesson_session targets bookings.status, not requests.status.
*/

DO $do$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
    FROM pg_proc WHERE proname = 'redeem_invitation' LIMIT 1;
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'redeem_invitation not found';
  END IF;

  IF position('status = ''converted''' in v_def) > 0 THEN
    RAISE NOTICE 'redeem_invitation already converts its request — nothing to do';
    RETURN;
  END IF;

  IF position($anchor$UPDATE invitations SET status = 'redeemed', redeemed_at = now() WHERE id = v_inv.id;$anchor$ in v_def) = 0 THEN
    RAISE EXCEPTION 'redeem_invitation: redemption anchor not found — inspect manually';
  END IF;

  v_def := replace(v_def,
$anchor$UPDATE invitations SET status = 'redeemed', redeemed_at = now() WHERE id = v_inv.id;$anchor$,
$new$UPDATE invitations SET status = 'redeemed', redeemed_at = now() WHERE id = v_inv.id;

  -- close the inbound lifecycle: the request that produced this invitation is
  -- CONVERTED once the person actually creates their account. Guarded so a
  -- re-redemption or a manually-advanced request is never walked backwards.
  IF v_inv.request_id IS NOT NULL THEN
    UPDATE requests SET status = 'converted'
     WHERE id = v_inv.request_id AND status IS DISTINCT FROM 'converted';
  END IF;$new$);

  EXECUTE v_def;
END $do$;
