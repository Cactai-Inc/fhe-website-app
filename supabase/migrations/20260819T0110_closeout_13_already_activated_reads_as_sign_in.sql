-- CLOSEOUT §1.3 (CONTRACTWALK A4) — the client who already activated and clicks
-- their old link.
--
-- redeem_invitation raises one string for expired, superseded and already-
-- redeemed, and the /activate page handles the first two well: it calls
-- invitation_replacement_notice and, when a NEWER live invitation exists, names
-- the masked inbox and offers a resend. The one genuinely wrong case is the
-- person who has ALREADY ACTIVATED: no newer invitation exists, so the page
-- told them to check their inbox for an email that does not exist, when the
-- truth is "you already have an account — sign in."
--
-- One branch closes it: when the retired token's invitation is 'redeemed' and a
-- profile exists for that email, the notice answers {'already_activated': true}
-- instead of NULL, and the page says so with the sign-in link it already has.
-- Every other case keeps today's behaviour, including the masked-resend notice
-- taking precedence when a newer live invitation DOES exist (a re-provisioned
-- person should follow their newest link, not their old account).
--
-- Disclosure note: the caller holds the token that was emailed to that address
-- and that token was REDEEMED — acknowledging "this account is active" to the
-- holder of its own used activation link reveals nothing a login attempt would
-- not. The new token, as before, never crosses this boundary.

CREATE OR REPLACE FUNCTION public.invitation_replacement_notice(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old     invitations%ROWTYPE;
  v_new     invitations%ROWTYPE;
  v_local   text;
  v_domain  text;
  v_masked  text;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN RETURN NULL; END IF;

  SELECT * INTO v_old FROM invitations WHERE token = p_token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  -- still usable: the caller should be activating, not reading this page
  IF v_old.status = 'sent' AND v_old.expires_at > now() AND v_old.deleted_at IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_new FROM invitations i
   WHERE i.org_id = v_old.org_id
     AND lower(i.email) = lower(v_old.email)
     AND i.status = 'sent'
     AND i.expires_at > now()
     AND i.deleted_at IS NULL
   ORDER BY i.created_at DESC
   LIMIT 1;
  IF NOT FOUND THEN
    -- CLOSEOUT §1.3: no newer invitation to point at. If THIS link was already
    -- redeemed and the account exists, the right message is "sign in", not
    -- "check your inbox for a newer one".
    IF v_old.status = 'redeemed' AND EXISTS (
         SELECT 1 FROM profiles p WHERE lower(p.email) = lower(v_old.email)) THEN
      RETURN jsonb_build_object('already_activated', true);
    END IF;
    RETURN NULL;
  END IF;

  v_local  := split_part(v_new.email, '@', 1);
  v_domain := split_part(v_new.email, '@', 2);
  -- keep the first character and the last, mask the middle: enough for a person
  -- to recognise their own address, not enough to learn someone else's.
  v_masked := CASE
    WHEN length(v_local) <= 2 THEN left(v_local, 1) || '•••'
    ELSE left(v_local, 1) || repeat('•', greatest(length(v_local) - 2, 3)) || right(v_local, 1)
  END || '@' || v_domain;

  RETURN jsonb_build_object(
    'masked_email', v_masked,
    'sent_at',      v_new.created_at,
    'expires_at',   v_new.expires_at);
END;
$function$;
