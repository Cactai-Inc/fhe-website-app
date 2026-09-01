/*
  # Fix — staff invite acceptance never stamped the role (blank-screen bug)

  redeem_invitation stamped the invited role with
      UPDATE profiles SET role = ... WHERE user_id = auth.uid()
  which silently affects ZERO rows when the redeeming user has no profile row
  yet (the profile upsert failed or lost the race). The invite still flipped to
  'accepted' and a membership was granted, so the account looked "in" — but with
  NO role. A staff invitee then reached /app as a non-operator, the member gate
  bounced them to /app/account (itself member-gated) and the redirect looped into
  a blank white screen.

  Fix: ensure the profile row EXISTS before stamping (INSERT … ON CONFLICT DO
  NOTHING under the same role-guard escape), so the role is always applied.
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

  -- Apply the invited role + tenant FIRST — the membership insert's org
  -- default reads the profile's org (NULL until this stamp). The redeeming
  -- user is not an admin, so open the role-guard escape for this transaction.
  PERFORM set_config('app.allow_profile_link', '1', true);

  -- Ensure a profile row exists, or the role stamp below is a no-op (the bug).
  -- org_id must be set on insert: the AFTER-INSERT profiles_link_contact trigger
  -- creates a contact whose org_id default resolves via current_org() (= this
  -- profile's org). Without it the contact insert fails NOT-NULL and the whole
  -- profile creation rolls back — which is how accounts ended up profile-less.
  INSERT INTO profiles (user_id, org_id)
  VALUES (auth.uid(), v_inv.org_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE profiles
     SET role     = CASE WHEN v_inv.invited_role <> 'USER' THEN v_inv.invited_role ELSE role END,
         is_admin = CASE WHEN v_inv.invited_role = 'ADMIN' THEN true ELSE is_admin END,
         org_id   = coalesce(org_id, v_inv.org_id)
   WHERE user_id = auth.uid();

  INSERT INTO memberships (user_id, tier, status)
  VALUES (auth.uid(), 'community', 'active')
  ON CONFLICT (user_id) DO UPDATE SET status = 'active';

  UPDATE invitations SET status = 'accepted' WHERE id = v_inv.id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION redeem_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION redeem_invitation(text) TO authenticated;
