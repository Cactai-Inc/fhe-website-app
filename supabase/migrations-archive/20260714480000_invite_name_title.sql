/*
  # Staff invite carries first/last name + title → pre-populated account

  The invitation stored only email + role, so redeem_invitation created a profile
  with no name (nameless on both the password and Google paths — the blank-account
  symptom). Now the owner sets the invitee's name and title on the invite; they
  ride on the invitation and are stamped onto the profile (name) and staff_profiles
  (title) at redemption.

  A. invitations gains first_name / last_name / title.
  B. redeem_invitation fills the profile name (when blank) from the invite and,
     for a staff role with a title, upserts a staff_profiles row with the title.
*/

ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name  text,
  ADD COLUMN IF NOT EXISTS title      text;

CREATE OR REPLACE FUNCTION public.redeem_invitation(p_token text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv   invitations%ROWTYPE;
  v_email text;
  v_fn    text;
  v_ln    text;
  v_title text;
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

  v_fn    := nullif(btrim(coalesce(v_inv.first_name, '')), '');
  v_ln    := nullif(btrim(coalesce(v_inv.last_name,  '')), '');
  v_title := nullif(btrim(coalesce(v_inv.title,      '')), '');

  PERFORM set_config('app.allow_profile_link', '1', true);

  -- Ensure a profile row exists (org_id on insert so the contact-link trigger
  -- resolves current_org()). Seed the name from the invite so the account isn't
  -- nameless — on either the password or the Google registration path.
  INSERT INTO profiles (user_id, org_id, first_name, last_name)
  VALUES (auth.uid(), v_inv.org_id, v_fn, v_ln)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE profiles
     SET role       = CASE WHEN v_inv.invited_role <> 'USER' THEN v_inv.invited_role ELSE role END,
         is_admin   = CASE WHEN v_inv.invited_role = 'ADMIN' THEN true ELSE is_admin END,
         org_id     = coalesce(org_id, v_inv.org_id),
         first_name = coalesce(nullif(btrim(coalesce(first_name, '')), ''), v_fn),
         last_name  = coalesce(nullif(btrim(coalesce(last_name,  '')), ''), v_ln)
   WHERE user_id = auth.uid();

  INSERT INTO memberships (user_id, tier, status)
  VALUES (auth.uid(), 'community', 'active')
  ON CONFLICT (user_id) DO UPDATE SET status = 'active';

  -- staff title → staff_profiles (profiles has no title column)
  IF v_inv.invited_role IN ('MANAGER','ADMIN','EMPLOYEE') AND v_title IS NOT NULL THEN
    INSERT INTO staff_profiles (org_id, profile_user_id, title)
    VALUES (v_inv.org_id, auth.uid(), v_title)
    ON CONFLICT (org_id, profile_user_id) DO UPDATE SET title = excluded.title, updated_at = now();
  END IF;

  UPDATE invitations SET status = 'accepted' WHERE id = v_inv.id;
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION redeem_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION redeem_invitation(text) TO authenticated;
