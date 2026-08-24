-- TASK-PAMELA §A — provision_client_invitation gains `p_send`.
--
-- Everything this function does — contact, clients row, categories, onboarding
-- documents, the order, the agreed lesson, apply_affiliations — already happens
-- BEFORE the invitation is minted, and none of it depends on an email going out.
-- The only reason staff had to send in order to save was that the endpoint's one
-- act ran the RPC and the mailer back to back with nothing between them.
--
-- `p_send = false` therefore changes exactly two statements: the invitation is
-- written as a DRAFT, and the prior live link is not retired (a save must never
-- kill a link somebody is holding). `p_send = true` on a contact who has a draft
-- PROMOTES that draft and sends ITS token, so the link the owner saved is the
-- link the client receives and one row carries the whole lifecycle.
--
-- ONE ENGINE, ONE BRANCH — not a second provisioning path (D18). The body below
-- is the LIVE body, read back with pg_get_functiondef and string-edited, so
-- nothing else in it can drift. Not replayable on a fresh database.
DO $mig$
DECLARE
  v_src  text;
  v_old  text;
  v_new  text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'provision_client_invitation';
  IF v_src IS NULL THEN RAISE EXCEPTION 'provision_client_invitation not found'; END IF;

  IF position('p_send boolean' IN v_src) > 0 THEN
    RAISE NOTICE 'p_send already present — nothing to do';
    RETURN;
  END IF;

  -- 1. the new parameter, appended so every existing named-argument call is unchanged
  v_src := replace(v_src,
    'p_agreed_lesson jsonb DEFAULT NULL::jsonb)',
    'p_agreed_lesson jsonb DEFAULT NULL::jsonb, p_send boolean DEFAULT true)');
  IF position('p_send boolean DEFAULT true' IN v_src) = 0 THEN
    RAISE EXCEPTION 'could not append p_send to the signature';
  END IF;

  -- 2. the invitation write
  v_old := $old$  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO invitations (org_id, request_id, email, token, expires_at, status,
                           first_name, last_name, contact_id, categories, offering_ids, template_keys)
    VALUES (v_org, p_request_id, v_email, v_token,
            now() + (invitation_expiry_days(v_org) || ' days')::interval, 'sent',
            v_fn, v_ln, v_contact, v_cats, nullif(p_offering_ids, '{}'), p_template_keys)
    RETURNING id INTO v_inv_id;$old$;

  v_new := $new$  -- ── PAMELA §A — SAVE AND SEND ARE TWO ACTS ON ONE ROW ───────────────────
  --
  -- A DRAFT is an account that exists and whose claim link has never been
  -- delivered. Re-saving updates that same draft rather than minting a second
  -- token, so the invitation history stays a record of what was actually issued
  -- instead of filling with one row per keystroke of staff second-guessing.
  -- Sending promotes the draft in place: the owner sends the link he saved.
  SELECT i.id, i.token INTO v_inv_id, v_token
    FROM invitations i
   WHERE i.org_id = v_org AND lower(i.email) = v_email
     AND i.status = 'draft' AND i.deleted_at IS NULL
   ORDER BY i.created_at DESC
   LIMIT 1;

  IF v_inv_id IS NOT NULL THEN
    UPDATE invitations
       SET status        = CASE WHEN p_send THEN 'sent' ELSE 'draft' END,
           request_id    = coalesce(p_request_id, request_id),
           expires_at    = now() + (invitation_expiry_days(v_org) || ' days')::interval,
           first_name    = coalesce(v_fn, first_name),
           last_name     = coalesce(v_ln, last_name),
           contact_id    = coalesce(v_contact, contact_id),
           categories    = v_cats,
           offering_ids  = nullif(p_offering_ids, '{}'),
           template_keys = p_template_keys
     WHERE id = v_inv_id;
  ELSE
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO invitations (org_id, request_id, email, token, expires_at, status,
                             first_name, last_name, contact_id, categories, offering_ids, template_keys)
      VALUES (v_org, p_request_id, v_email, v_token,
              now() + (invitation_expiry_days(v_org) || ' days')::interval,
              CASE WHEN p_send THEN 'sent' ELSE 'draft' END,
              v_fn, v_ln, v_contact, v_cats, nullif(p_offering_ids, '{}'), p_template_keys)
      RETURNING id INTO v_inv_id;
  END IF;$new$;

  IF position(v_old IN v_src) = 0 THEN
    RAISE EXCEPTION 'the invitation INSERT block is not the shape this migration expected';
  END IF;
  v_src := replace(v_src, v_old, v_new);

  -- 3. retiring the prior live link is part of SENDING, never of saving
  v_old := '  PERFORM supersede_invitations(v_org, v_email, v_inv_id);';
  v_new := '  IF p_send THEN PERFORM supersede_invitations(v_org, v_email, v_inv_id); END IF;';
  IF position(v_old IN v_src) = 0 THEN
    RAISE EXCEPTION 'the supersede call is not the shape this migration expected';
  END IF;
  v_src := replace(v_src, v_old, v_new);

  -- 4. swap the signature. Appending a defaulted parameter would otherwise leave
  --    TWO overloads and PostgREST cannot choose between them by name.
  DROP FUNCTION public.provision_client_invitation(
    text, text, text, text[], uuid[], text[], boolean, text, text, uuid, uuid, numeric, text, jsonb);
  EXECUTE v_src;
  GRANT EXECUTE ON FUNCTION public.provision_client_invitation(
    text, text, text, text[], uuid[], text[], boolean, text, text, uuid, uuid, numeric, text, jsonb, boolean)
    TO service_role, authenticated;
END
$mig$;
