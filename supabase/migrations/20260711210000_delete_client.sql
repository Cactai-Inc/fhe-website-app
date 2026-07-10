/*
  # admin_delete_client — remove a client account from the app

  Two cases, one call:
  - PROVISIONED (no login yet): soft-delete the clients row + the contact.
    They vanish from Clients, Directory, and every picker. Fully reversible
    at the DB but gone from the app.
  - LOGIN-BACKED: a real auth user can only be destroyed with the service
    role, which this authenticated RPC does not hold. So we do everything the
    app CAN do atomically: soft-delete the clients row, permanently suspend
    the login (blocks sign-in), and detach the profile from its contact +
    org so it stops resolving as a tenant member. The caller is told a login
    remained so the UI can note it. History (engagements, documents, orders)
    is preserved — deleting a person never shreds signed agreements.

  Admin-gated. The profile writes go through the role-guard escape hatch
  (app.allow_profile_link), since suspending/detaching another profile isn't
  an ordinary self-update.
*/

CREATE OR REPLACE FUNCTION admin_delete_client(p_contact_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org   uuid;
  v_user  uuid;
BEGIN
  IF NOT (has_staff_access() AND is_admin()) THEN
    RAISE EXCEPTION 'admin access required';
  END IF;

  SELECT org_id INTO v_org FROM contacts WHERE id = p_contact_id AND deleted_at IS NULL;
  IF v_org IS NULL OR v_org <> current_org() THEN
    RAISE EXCEPTION 'contact not found in this org';
  END IF;

  SELECT user_id INTO v_user FROM profiles WHERE contact_id = p_contact_id;

  -- soft-delete the client record (never touches engagements/documents/orders)
  UPDATE clients
     SET deleted_at = now(), deleted_by = auth.uid()
   WHERE contact_id = p_contact_id AND deleted_at IS NULL;

  IF v_user IS NULL THEN
    -- provisioned, no login: retire the contact too
    UPDATE contacts SET deleted_at = now(), deleted_by = auth.uid()
     WHERE id = p_contact_id;
    RETURN jsonb_build_object('deleted', true, 'had_login', false);
  END IF;

  -- login-backed: block sign-in and detach from the tenant. The auth user
  -- itself needs service-role deletion (surfaced to the caller).
  PERFORM set_config('app.allow_profile_link', '1', true);
  UPDATE profiles
     SET is_suspended = true,
         contact_id = NULL,
         org_id = NULL
   WHERE user_id = v_user;

  RETURN jsonb_build_object('deleted', true, 'had_login', true);
END;
$fn$;

GRANT EXECUTE ON FUNCTION admin_delete_client(uuid) TO authenticated;
