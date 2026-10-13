-- CR-126 — a contract party WHO ALREADY HAS AN ACCOUNT could not re-open their
-- document from the sent link. The link is a one-time /activate?token invitation
-- built for account CREATION; once the token was spent (first click redeemed it),
-- a signed-in party who had NOT yet signed the document hit the liveness rule
-- ("invitation is not valid or has expired") and was dead-ended — ending up at the
-- /sign chooser. But a party with an account needs no live token to view their own
-- document; they already have read access by RLS.
--
-- Fix: redeem_contract_invitation routes a signed-in caller straight to the document
-- whenever they are a PARTY on it (by their profile's contact_id, or the invited
-- contact is theirs) — not only when they have already SIGNED. The one-time liveness
-- rule now gates only the provisioning path (a brand-new account being created), which
-- is the only thing a spent token should actually block. In-place rewrite.

DO $cr126_party$
DECLARE
  v_def text;
  v_old text := $q$  IF v_signed THEN
    -- Nothing to provision and nothing to re-sign: they are already on the
    -- document. Retire a still-live token so it cannot be walked twice, and
    -- leave a spent/superseded one exactly as it is.
    UPDATE invitations
       SET status = 'redeemed', redeemed_at = coalesce(redeemed_at, now())
     WHERE id = v_inv.id AND status = 'sent';
    RETURN jsonb_build_object('document_id', v_inv.document_id, 'already_signed', true);
  END IF;$q$;
  v_new text := $q$  -- A caller who already has an account that is a PARTY on this document opens it
  -- directly — whether or not they have signed yet. A party with an account has read
  -- access by RLS and needs no live token; the one-time link should never dead-end
  -- them. This also makes the link effectively reusable for an account-holder.
  IF v_signed OR EXISTS (
       SELECT 1 FROM document_parties dp
        WHERE dp.document_id = v_inv.document_id
          AND dp.contact_id = (SELECT p.contact_id FROM profiles p WHERE p.user_id = auth.uid())
     ) THEN
    -- Nothing to provision: they are already a party on the document. Retire a
    -- still-live token so it cannot be walked twice, and leave a spent one as-is.
    UPDATE invitations
       SET status = 'redeemed', redeemed_at = coalesce(redeemed_at, now())
     WHERE id = v_inv.id AND status = 'sent';
    RETURN jsonb_build_object('document_id', v_inv.document_id, 'already_signed', v_signed);
  END IF;$q$;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc
    WHERE proname='redeem_contract_invitation' AND pronamespace='public'::regnamespace;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'redeem_contract_invitation v_signed block anchor not found';
  END IF;
  v_def := replace(v_def, v_old, v_new);
  EXECUTE v_def;
END $cr126_party$;
