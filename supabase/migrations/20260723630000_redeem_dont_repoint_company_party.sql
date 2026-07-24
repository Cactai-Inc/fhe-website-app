-- BUG: when a contract counterparty opens their review link, redeem_contract_
-- invitation repoints the party (document_parties / contract_parties / shares /
-- originator) from the invitation's contact to the REDEEMER's own contact. That is
-- correct for a placeholder invite (invite client@x.com, they later make an
-- account) — but WRONG when the party is a COMPANY contact. A company party is the
-- intended party, not a placeholder; whoever opens the link (an employee/member,
-- e.g. Claire opening a French Heritage Equestrian contract) is acting ON BEHALF OF
-- the company, so the party must stay the company — not switch to that person's
-- personal contact. This is exactly what happened: the company Lessee got swapped
-- to Claire's personal contact because both accounts share the hello@ email.
--
-- Fix: skip the repoint when the invitation's contact is a company contact
-- (contacts.is_company = true). Everything else is unchanged.

CREATE OR REPLACE FUNCTION public.redeem_contract_invitation(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv     invitations%ROWTYPE;
  v_email   text;
  v_profile profiles%ROWTYPE;
  v_inv_is_company boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in before redeeming an invitation';
  END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_inv FROM invitations
   WHERE token = p_token AND status = 'sent' AND expires_at > now() AND kind = 'CONTRACT';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation is not valid or has expired';
  END IF;
  IF lower(v_inv.email) IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION 'this invitation was issued to a different email address';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no profile for the signed-in user';
  END IF;

  -- Is the invited party a company contact? If so, the redeemer acts on the
  -- company's behalf and the party must NOT be repointed to their personal contact.
  SELECT coalesce(is_company, false) INTO v_inv_is_company
    FROM contacts WHERE id = v_inv.contact_id;

  PERFORM set_config('app.allow_profile_link', '1', true);

  IF v_profile.contact_id IS NULL THEN
    -- fresh account: adopt the invite's party contact as their identity — but NOT
    -- when the party is a company (a person should not BE the company contact).
    IF NOT v_inv_is_company THEN
      UPDATE profiles
         SET contact_id = v_inv.contact_id,
             org_id     = coalesce(org_id, v_inv.org_id)
       WHERE user_id = auth.uid();
    ELSE
      UPDATE profiles SET org_id = coalesce(org_id, v_inv.org_id) WHERE user_id = auth.uid();
    END IF;
  ELSIF v_profile.contact_id <> v_inv.contact_id AND NOT v_inv_is_company THEN
    -- existing account with its own contact: keep THEIR contact singular and
    -- repoint the spine party rows + shares from the invite's placeholder contact
    -- to the account's contact. Skipped for a company party (above): the company
    -- stays the party; the person is only acting on its behalf.
    UPDATE document_parties SET contact_id = v_profile.contact_id
     WHERE contact_id = v_inv.contact_id;
    UPDATE contract_parties SET contact_id = v_profile.contact_id
     WHERE contact_id = v_inv.contact_id;
    UPDATE document_shares SET shared_with_contact_id = v_profile.contact_id
     WHERE shared_with_contact_id = v_inv.contact_id;
    UPDATE documents SET originator_contact_id = v_profile.contact_id
     WHERE originator_contact_id = v_inv.contact_id AND deleted_at IS NULL;
  END IF;

  UPDATE invitations SET status = 'accepted' WHERE id = v_inv.id;

  RETURN jsonb_build_object('document_id', v_inv.document_id);
END;
$function$;
