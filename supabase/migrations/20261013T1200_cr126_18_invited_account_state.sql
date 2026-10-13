-- CR-126 — the activation link must branch by account state, not always open the
-- signup flow (owner): an invited email that already has an account WITH at least one
-- session goes to LOGIN; one that has never had a session (new, or provisioned but
-- never activated) goes to the set-password + personal-info flow; and NEVER to the
-- /sign door chooser. The frontend needs to know, before login, whether the invited
-- email's account exists and has ever signed in.
--
-- invited_account_state(token) returns that, keyed by the invitation token (proof the
-- caller holds the personal link) so it never leaks arbitrary email account states.
-- SECURITY DEFINER to read auth.users; anon-callable like validate_invitation.

CREATE OR REPLACE FUNCTION public.invited_account_state(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email       text;
  v_document_id uuid;
  v_user        record;
BEGIN
  -- Resolve the invitation by token (any kind, live or spent — a spent link still
  -- needs to route an existing account-holder correctly).
  SELECT lower(email), document_id INTO v_email, v_document_id
    FROM invitations WHERE token = p_token
   ORDER BY created_at DESC LIMIT 1;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT u.id, u.last_sign_in_at INTO v_user
    FROM auth.users u WHERE lower(u.email) = v_email LIMIT 1;

  RETURN jsonb_build_object(
    'found', true,
    'email', v_email,
    'document_id', v_document_id,
    -- an account exists for the invited email
    'has_account', v_user.id IS NOT NULL,
    -- it has had at least one session (established account → send to login)
    'has_session', coalesce(v_user.last_sign_in_at IS NOT NULL, false)
  );
END;
$function$;

-- anon + authenticated callable (the activate page runs before login); never leaks
-- more than "does the invited email have an account / a session", gated by the token.
REVOKE EXECUTE ON FUNCTION public.invited_account_state(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invited_account_state(text) TO anon, authenticated, service_role;
