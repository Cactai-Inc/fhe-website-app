/*
  # redeem_invitation — the missing last step of invite-only signup

  Registration created the auth user + profile but NOTHING granted membership
  or consumed the invitation, so requireMember bounced invited users to the
  profile screen forever (owner-reported). Redemption, atomically:
    - validates the token (sent, unexpired) and that its email matches the
      SIGNED-IN user's email (the invitation is the credential);
    - grants/reactivates the community membership (memberships UNIQUE(user_id));
    - marks the invitation accepted.
  SECURITY DEFINER, authenticated-only.
*/
CREATE OR REPLACE FUNCTION redeem_invitation(p_token text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv   invitations%ROWTYPE;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in before redeeming an invitation';
  END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_inv FROM invitations
   WHERE token = p_token AND status = 'sent' AND expires_at > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation is not valid or has expired';
  END IF;
  IF lower(v_inv.email) IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION 'this invitation was issued to a different email address';
  END IF;

  INSERT INTO memberships (user_id, tier, status)
  VALUES (auth.uid(), 'community', 'active')
  ON CONFLICT (user_id) DO UPDATE SET status = 'active';

  UPDATE invitations SET status = 'accepted' WHERE id = v_inv.id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION redeem_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION redeem_invitation(text) TO authenticated;
