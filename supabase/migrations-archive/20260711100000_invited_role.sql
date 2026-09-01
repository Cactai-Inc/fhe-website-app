/*
  # invited_role — staff-account provisioning through the same invitation rail

  The owner's "+ New account" flow creates client, instructor, OR admin
  accounts. Invitations now carry the intended role; redemption applies it
  (through the profiles_role_guard escape hatch, since the redeeming user is
  not an admin). Only admins may issue non-USER invitations — enforced in the
  API layer (service role inserts) and re-checked here at redemption time by
  trusting only the stored column, which the API guards.
*/

ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS invited_role text NOT NULL DEFAULT 'USER'
  CHECK (invited_role IN ('USER', 'MANAGER', 'ADMIN'));

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
