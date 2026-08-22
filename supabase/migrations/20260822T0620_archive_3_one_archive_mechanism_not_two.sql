-- TASK-ARCHIVE §1, second half — "Do not build a second archive mechanism."
--
-- One already existed, in the Clients tab's danger zone, and it was the broken
-- one. `admin_account_action(p_contact_id, 'soft')` — labelled in the UI as
-- "Soft delete — keep the data … preserves all history and signed documents" —
-- did two different things depending on whether the person had a login:
--
--   no login  → archived the contact (correct, and what this task now names).
--   HAS login → did NOT archive the contact at all. It ran
--               `UPDATE profiles SET is_suspended = true, contact_id = NULL,
--                org_id = NULL`, SEVERING the account from its contact record.
--
-- The second branch is the failure D32 exists to stop. `profiles.contact_id` is
-- how the whole system resolves an account to a person — `party_user_ids`,
-- `my_documents`, `current_contact_id()`, delivery, signatures-by-signer. Null
-- it and the person's own executed documents stop resolving to their login,
-- the contact stays fully visible in every staff listing (it was never
-- archived), and there is no way back: the 'unremove' action only unsuspends,
-- it cannot re-link, and nothing else in the codebase re-points contact_id.
-- The screen promised "keep the data" and delivered the one operation that
-- loses the thing tying the data to the person.
--
-- Both branches now converge on archive_contact: hide the account, suspend the
-- login, sever nothing. `unarchive_contact` + 'unremove' walks it all back.
--
-- The clients-row soft delete is kept as-is — it is the engagement record, it
-- has always been a deleted_at flag, and nothing reads it as evidence.

CREATE OR REPLACE FUNCTION public.admin_account_action(p_contact_id uuid, p_action text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid;
  v_user uuid;
BEGIN
  IF NOT coalesce(has_staff_access() AND is_admin(), false) THEN
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
    -- a previously archived contact comes back with the account it belongs to
    IF EXISTS (SELECT 1 FROM contacts WHERE id = p_contact_id AND deleted_at IS NOT NULL) THEN
      PERFORM unarchive_contact(p_contact_id);
    END IF;
    RETURN jsonb_build_object('ok', true, 'action', 'unremove');

  ELSE  -- soft: hide the account, keep every record it is attached to
    UPDATE clients SET deleted_at = now(), deleted_by = auth.uid()
      WHERE contact_id = p_contact_id AND deleted_at IS NULL;
    IF v_user IS NOT NULL THEN
      PERFORM set_config('app.allow_profile_link', '1', true);
      -- suspend the login. contact_id / org_id are NOT touched: the account
      -- must still resolve to the person for their documents to mean anything.
      UPDATE profiles SET is_suspended = true WHERE user_id = v_user;
    END IF;
    PERFORM archive_contact(p_contact_id, 'Soft delete from the account screen');
    RETURN jsonb_build_object('ok', true, 'action', 'soft', 'had_login', v_user IS NOT NULL);
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.admin_account_action(uuid, text) IS
  'remove/unremove suspend and reinstate the login. soft ARCHIVES the contact through archive_contact (D11/D32) and suspends the login — it no longer severs profiles.contact_id, which used to leave the contact visible AND its account unable to resolve to it. unremove now also unarchives, so the pair is fully reversible.';
