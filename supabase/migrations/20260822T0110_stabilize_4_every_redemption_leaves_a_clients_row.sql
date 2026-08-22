-- TASK-STABILIZE ITEM 4 — a weekly rider never gets their standing slot.
--
-- WALK4 §C/§D: `set_my_standing_schedule` refuses with "not your plan" from the
-- client side and "no client for purchase item …" from the staff dossier, and
-- the same contact is absent from the staff booking form's CLIENT dropdown.
-- One cause behind all three: no `clients` row for that contact.
--
-- `_ensure_client_account` is the function that creates it, and it is already
-- called from `provision_client_invitation` (staff provisioning), `redeem_gift`,
-- `ensure_gift_buyer_account` and `redeem_contract_invitation`. The one
-- redemption path that never calls it is `redeem_invitation` — the COMMUNITY
-- redemption — which builds the profile, promotes the contact, grants
-- membership, and stops. `promote_contact_to_account` only ever inserts a
-- clients row by COPYING one off a contact it is dissolving, so a first-time
-- account gets none.
--
-- Measured on production before this change: of every non-staff account,
-- exactly one contact had no clients row — Walk4 WALKTEST, whose contract
-- redemption raised before reaching `_ensure_client_account` (ITEM 1). Every
-- other account was provisioned by staff, which is why this hole has stayed
-- invisible: it only opens for someone who becomes an account WITHOUT staff
-- provisioning them first.
--
-- ⚠️ D23 STILL GOVERNS WHAT THEY THEN GET. This mints no credit and no
-- entitlement. A `clients` row is an identity fact — "this person is someone we
-- serve" — and it is the only thing the standing-slot machinery was missing.
-- A weekly rider's `remaining = 0` is correct and untouched here.
--
-- ⚠️ NOT A SECOND SPINE (D18). No new function; the existing one, called with
-- an EXPLICIT EMPTY `p_template_keys` so it inserts no requirement and deletes
-- none — the same '{}' branch `redeem_contract_invitation` uses. Redemption
-- must never change a document set staff already decided.
CREATE OR REPLACE FUNCTION public.redeem_invitation(p_token text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv     invitations%ROWTYPE;
  v_email   text;
  v_fn      text;
  v_ln      text;
  v_title   text;
  v_contact uuid;
  v_err     text;
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

  INSERT INTO profiles (user_id, org_id, first_name, last_name, email)
  VALUES (auth.uid(), v_inv.org_id, v_fn, v_ln, v_email)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE profiles
     SET role       = CASE WHEN v_inv.invited_role <> 'USER' THEN v_inv.invited_role ELSE role END,
         is_admin   = CASE WHEN v_inv.invited_role = 'ADMIN' THEN true ELSE is_admin END,
         org_id     = coalesce(org_id, v_inv.org_id),
         first_name = coalesce(nullif(btrim(coalesce(first_name, '')), ''), v_fn),
         last_name  = coalesce(nullif(btrim(coalesce(last_name,  '')), ''), v_ln)
   WHERE user_id = auth.uid();

  -- Resolve the person contact this invitation belongs to: the invitation's
  -- own contact, else the same by-email resolution the provisioning spine
  -- uses (never a company contact, never email-matching the shared pair —
  -- is_company is excluded structurally).
  v_contact := v_inv.contact_id;
  IF v_contact IS NULL THEN
    SELECT c.id INTO v_contact FROM contacts c
     WHERE lower(c.email) = v_email AND c.deleted_at IS NULL AND NOT c.is_company
       AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id AND p.user_id <> auth.uid())
     ORDER BY c.created_at LIMIT 1;
  END IF;

  IF v_contact IS NOT NULL THEN
    -- ITEM 3: redemption converts a LEAD into a real CONTACT.
    UPDATE contacts SET contact_type = 'CONTACT'
     WHERE id = v_contact AND contact_type = 'LEAD';

    -- THE SPINE: link/merge, signature account-stamp, members, derive groups.
    -- ITEM 4: a merge collision must not dead-end the invitation. The scan in
    -- promote_contact_to_account now runs before any mutation, so catching
    -- here leaves the database untouched; we surface the conflict to staff and
    -- re-raise so the transaction rolls back with the invitation still 'sent'.
    BEGIN
      PERFORM promote_contact_to_account(auth.uid(), v_contact);
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      -- staff-visible record of the collision, outside the doomed transaction
      PERFORM pg_notify('redemption_conflict',
        json_build_object('contact_id', v_contact, 'user_id', auth.uid(),
                          'invitation_id', v_inv.id, 'error', v_err)::text);
      INSERT INTO notifications (org_id, user_id, kind, title, body, link)
      SELECT v_inv.org_id, pr.user_id, 'redemption_conflict',
             'Account linking hit a data conflict',
             'A member could not be linked to their contact record during redemption: '
               || v_err || ' Their invitation remains valid until this is resolved.',
             '/app/ops/contacts/' || v_contact::text
        FROM profiles pr
       WHERE pr.org_id = v_inv.org_id AND coalesce(pr.staff_active, false) = true;
      RAISE EXCEPTION 'account linking hit a data conflict — staff have been notified; your invitation remains valid, try again after it is resolved';
    END;
  ELSE
    -- No person contact exists yet (bare account) — community still follows
    -- the account (D8).
    INSERT INTO members (user_id, status, org_id)
    VALUES (auth.uid(), 'active', v_inv.org_id)
    ON CONFLICT (user_id) DO UPDATE SET status = 'active';
  END IF;

  -- ── STABILIZE ITEM 4 — THE `clients` ROW, UNCONDITIONALLY ────────────────
  --
  -- Staff accounts are excluded: an operator is not someone we serve, and a
  -- clients row would put them in the booking form's CLIENT dropdown. Everyone
  -- else who finishes a redemption is a person this business serves, whatever
  -- door they came through, and the standing-slot machinery, the manual-booking
  -- dropdown and `current_client_id()` all key on exactly this row.
  --
  -- Swallowed for the same reason the contract redemption swallows it: an
  -- account that is otherwise fully activated must not be rolled back because
  -- a provisioning nicety failed. Idempotent — it no-ops when the row exists.
  IF v_inv.invited_role = 'USER' AND v_email IS NOT NULL THEN
    BEGIN
      PERFORM _ensure_client_account(v_inv.org_id, v_email, v_fn, v_ln,
        ARRAY['GUEST'], ARRAY[]::text[]);
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;

  IF v_inv.invited_role IN ('MANAGER','ADMIN','EMPLOYEE') AND v_title IS NOT NULL THEN
    UPDATE profiles SET title = v_title, staff_active = true WHERE user_id = auth.uid();
  END IF;

  -- Success: 'redeemed' is the new terminal success marker (accepted stays as
  -- the legacy value on historical rows).
  UPDATE invitations SET status = 'redeemed', redeemed_at = now() WHERE id = v_inv.id;

  -- close the inbound lifecycle: the request that produced this invitation is
  -- CONVERTED once the person actually creates their account. Guarded so a
  -- re-redemption or a manually-advanced request is never walked backwards.
  IF v_inv.request_id IS NOT NULL THEN
    UPDATE requests SET status = 'converted'
     WHERE id = v_inv.request_id AND status IS DISTINCT FROM 'converted';
  END IF;
  RETURN true;
END;
$function$;
