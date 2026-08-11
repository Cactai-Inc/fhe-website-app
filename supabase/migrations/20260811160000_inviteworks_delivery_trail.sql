-- TASK INVITEWORKS — the invitation send path must not erase its own outcome.
--
-- Today an invitation row is written whether or not the activation email left
-- the building. `sendInvitationEmail` returned a bare boolean the handler threw
-- away, so "provisioned but never delivered" and "delivered" are indistinguish-
-- able five minutes later, and the operator's only signal ("Invitation sent")
-- was printed before anyone knew whether it had been.
--
-- This records the delivery attempt on the EXISTING status spine
-- (status_events + status_events_vocab, entity_type 'account') rather than
-- adding columns: the invitation StatusLog already renders on the client page,
-- so a failed send shows up where staff are already looking.
--
-- Two sub-status codes (is_true_status = false — the invitation's TRUE status
-- stays 'invited' until it is redeemed/revoked/expired):
--   email_sent    the transport accepted it
--   email_failed  it did not, with the transport's own reason in `detail`
--
-- NOTE: no self-contained COMMIT in this file — it runs inside the dry-run
-- BEGIN/ROLLBACK wrapper first, then for real.

INSERT INTO status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order)
VALUES
  ('account', 'email_sent',   'Invitation email sent',   false, false, 13),
  ('account', 'email_failed', 'Invitation email failed', false, false, 14)
ON CONFLICT (entity_type, code) DO NOTHING;

-- Record one delivery attempt against an invitation. Called by the two senders
-- (admin-send-invitation, sign-start) immediately after the transport returns.
-- SECURITY DEFINER + an explicit caller check: the senders run service-role;
-- staff may also record (a future manual resend) but nobody else can write a
-- delivery claim about someone else's invitation.
CREATE OR REPLACE FUNCTION public.record_invitation_delivery(
  p_invitation_id uuid,
  p_ok            boolean,
  p_error         text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid;
  v_code text;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR coalesce(has_staff_access(), false)) THEN
    RAISE EXCEPTION 'not authorized to record invitation delivery';
  END IF;

  SELECT org_id INTO v_org FROM invitations WHERE id = p_invitation_id;
  IF v_org IS NULL THEN RETURN false; END IF;   -- unknown invitation: nothing to record against

  v_code := CASE WHEN p_ok THEN 'email_sent' ELSE 'email_failed' END;

  INSERT INTO status_events (org_id, entity_type, entity_id, status, detail, actor_user_id)
  VALUES (v_org, 'account', p_invitation_id, v_code,
          CASE WHEN p_ok THEN NULL ELSE left(coalesce(p_error, 'no reason reported'), 500) END,
          auth.uid());

  -- A person who was told "we've emailed you" and was not emailed is an ops
  -- problem, not a log line. Surface it where staff already look.
  IF NOT p_ok THEN
    PERFORM notify_staff(v_org, 'invitation_email_failed',
      'An invitation was created but the email did not send', '/app/admin');
  END IF;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_invitation_delivery(uuid, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.record_invitation_delivery(uuid, boolean, text) TO authenticated, service_role;
