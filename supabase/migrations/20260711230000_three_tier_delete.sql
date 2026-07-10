/*
  # Three-tier account removal (owner spec)

  REMOVE  — deactivate; reversible. Login suspended, client marked INACTIVE.
            Reactivate restores everything. Nothing is deleted.
  SOFT    — keep the data, remove the user. clients + contact soft-deleted
            (deleted_at), login suspended + detached. History intact. Gone from
            the app but recoverable at the DB.
  HARD    — nuclear (service-role only; see api/hard-delete-client.ts). Not in
            this migration — SQL RPCs can't drop the auth user.

  admin_account_action(contact_id, action) does REMOVE / UNREMOVE / SOFT.
*/

CREATE OR REPLACE FUNCTION admin_account_action(p_contact_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org  uuid;
  v_user uuid;
BEGIN
  IF NOT (has_staff_access() AND is_admin()) THEN
    RAISE EXCEPTION 'admin access required';
  END IF;
  IF p_action NOT IN ('remove','unremove','soft') THEN
    RAISE EXCEPTION 'action must be remove, unremove, or soft';
  END IF;

  SELECT org_id INTO v_org FROM contacts WHERE id = p_contact_id;
  IF v_org IS NULL OR v_org <> current_org() THEN
    RAISE EXCEPTION 'contact not found in this org';
  END IF;
  SELECT user_id INTO v_user FROM profiles WHERE contact_id = p_contact_id;

  IF p_action = 'remove' THEN
    -- deactivate, fully reversible
    UPDATE clients SET status = 'INACTIVE', updated_at = now()
      WHERE contact_id = p_contact_id AND deleted_at IS NULL;
    IF v_user IS NOT NULL THEN
      PERFORM set_config('app.allow_profile_link', '1', true);
      UPDATE profiles SET is_suspended = true WHERE user_id = v_user;
    END IF;
    RETURN jsonb_build_object('ok', true, 'action', 'remove', 'had_login', v_user IS NOT NULL);

  ELSIF p_action = 'unremove' THEN
    UPDATE clients SET status = 'ACTIVE', updated_at = now()
      WHERE contact_id = p_contact_id AND deleted_at IS NULL;
    IF v_user IS NOT NULL THEN
      PERFORM set_config('app.allow_profile_link', '1', true);
      UPDATE profiles SET is_suspended = false WHERE user_id = v_user;
    END IF;
    RETURN jsonb_build_object('ok', true, 'action', 'unremove');

  ELSE  -- soft
    UPDATE clients SET deleted_at = now(), deleted_by = auth.uid()
      WHERE contact_id = p_contact_id AND deleted_at IS NULL;
    IF v_user IS NULL THEN
      UPDATE contacts SET deleted_at = now(), deleted_by = auth.uid()
        WHERE id = p_contact_id;
    ELSE
      PERFORM set_config('app.allow_profile_link', '1', true);
      UPDATE profiles SET is_suspended = true, contact_id = NULL, org_id = NULL
        WHERE user_id = v_user;
    END IF;
    RETURN jsonb_build_object('ok', true, 'action', 'soft', 'had_login', v_user IS NOT NULL);
  END IF;
END;
$fn$;

GRANT EXECUTE ON FUNCTION admin_account_action(uuid, text) TO authenticated;
