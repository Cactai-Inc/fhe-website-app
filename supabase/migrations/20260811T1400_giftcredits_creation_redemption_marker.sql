-- GIFTCREDITS — a redeemed gift actually delivers something.
--
-- Four defects (docs/tasks/TASK-GIFTCREDITS-redemption-delivers-value.md), plus
-- two bugs found while reading the exact code this task requires touching:
--
--   D1  redeem_gift created no purchases/purchase_items/lesson_credits — the
--       recipient reached /app with nothing to book. Fixed by routing through
--       the ONE existing spine (_provision_purchase_for_offerings), same as
--       every other purchase in this system. Requires the gift to know WHICH
--       offering it represents, which nothing on `gifts` recorded — see D4.
--   D2  the redeemer was marked CUSTOMER. Per the owner's identity taxonomy
--       (2026-08-02) and the 2026-08-11 ruling on this task's edge case: CLIENT
--       receives a service, CUSTOMER holds a good. Driven off the linked
--       offering's config_kind — a real service (config_kind present, not
--       'inquire') makes the redeemer a CLIENT; anything else, CUSTOMER.
--   D3  a provisioning failure was swallowed (EXCEPTION WHEN others THEN NULL)
--       and the gift was already marked redeemed by the time it could fire.
--       Fixed by reordering: provisioning (account + purchase) now happens
--       BEFORE the gift is marked consumed, inside one exception block. Failure
--       -> the gift row is untouched (still redeemable), the error is recorded
--       via notify_staff (not NULL), and the caller gets a new 'redemption_failed'
--       status — never 'redeemed' when provisioning didn't happen.
--   D4  nothing created a `gifts` row at all — owner decision 2026-08-11: staff
--       converts an inquiry (matches every existing purchase-creation path in
--       this codebase; all of them are staff/service-role only, and the public
--       /checkout is already inquiry-only). New create_gift(), staff-gated,
--       mirrors provision_client_invitation's shape. This also revives
--       ensure_gift_buyer_account — written in Stage 4 (2026-07-28) for exactly
--       this call site, dead ever since because nothing ever created a gift.
--
--   BUG (owner: fix while here) redeem_gift passed ARRAY[]::text[] (not NULL)
--       as template_keys to _ensure_client_account. Per that function's own
--       branching, a non-NULL array — even empty — takes the "insert these
--       specific docs" path and unnests to zero rows, permanently skipping the
--       "derive docs from category" fallback. Net effect: gift redemption
--       assigned ZERO onboarding documents, silently, while the task doc's
--       "what already works" table recorded this as built. Fixed by passing
--       NULL/NULL here so _ensure_client_account's own fallback runs, and by
--       routing through _provision_purchase_for_offerings, whose
--       purchase_items insert fires promote_buyer_from_offering — the
--       authoritative, most-recently-fixed (2026-08-10) category+document
--       deriver, already used by every other purchase path. Proof is in the
--       report: contact_required_documents row counts before/after, not "the
--       call returned without error."
--
-- Dry-run discipline: BEGIN; \i this file; verify; ROLLBACK; then re-run for
-- real, per CLAUDE.md. NO BEGIN/COMMIT IN THIS FILE — a COMMIT here would end
-- that wrapper early and land the dry run for real (house lesson, 2026-08-10).

-- ── A. gifts needs to know WHICH offering it represents (D1/D4) ────────────
-- Nothing on `gifts` linked to the catalog before this — item_type/item_label
-- were free text. A real offering_id is what lets redemption call the same
-- _provision_purchase_for_offerings every other purchase in this system uses.
ALTER TABLE public.gifts
  ADD COLUMN IF NOT EXISTS offering_id uuid REFERENCES public.offerings(id);

-- ── B. create_gift — the ONE gift-creation path (D4) ────────────────────────
-- Staff (or service_role) converts a reviewed inquiry + a real catalog
-- offering into a redeemable gift. Mirrors provision_client_invitation's
-- auth fence and validation shape; item_type/item_label/amount are captured
-- FROM the offering (not staff free text) so they can never drift from what
-- the redemption will actually provision.
CREATE OR REPLACE FUNCTION public.create_gift(
  p_offering_id      uuid,
  p_buyer_name       text,
  p_buyer_email      text,
  p_recipient_name   text,
  p_recipient_email  text    DEFAULT NULL,
  p_gift_message     text    DEFAULT NULL,
  p_mark_paid        boolean DEFAULT false,
  p_request_id       uuid    DEFAULT NULL
) RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_off        offerings%ROWTYPE;
  v_code       text;
  v_gift       uuid;
  v_buyer_acct jsonb;
  v_buyer_user uuid;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to create gifts';
  END IF;

  SELECT * INTO v_off FROM offerings WHERE id = p_offering_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'offering not found or inactive'; END IF;
  IF v_off.price_amount IS NULL THEN
    RAISE EXCEPTION 'this offering has no price and cannot be gifted';
  END IF;

  IF nullif(btrim(coalesce(p_buyer_name,'')),'') IS NULL THEN
    RAISE EXCEPTION 'buyer name is required';
  END IF;
  IF nullif(btrim(coalesce(p_buyer_email,'')),'') IS NULL THEN
    RAISE EXCEPTION 'buyer email is required';
  END IF;
  IF nullif(btrim(coalesce(p_recipient_name,'')),'') IS NULL THEN
    RAISE EXCEPTION 'recipient name is required';
  END IF;

  -- short, unique, URL-safe claim code (the credential itself — task constraint:
  -- open_gift/redeem_gift stay unguarded/self-guarding, this is what they check)
  LOOP
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM gifts WHERE code = v_code);
  END LOOP;

  SELECT u.id INTO v_buyer_user FROM auth.users u
   WHERE lower(u.email) = lower(btrim(p_buyer_email)) LIMIT 1;

  INSERT INTO gifts (org_id, code, item_type, item_label, amount, offering_id,
                     buyer_name, buyer_email, buyer_user_id,
                     recipient_name, recipient_email, gift_message, status)
    VALUES (v_off.org_id, v_code, coalesce(v_off.service_type, v_off.segment),
            v_off.name, v_off.price_amount, v_off.id,
            btrim(p_buyer_name), lower(btrim(p_buyer_email)), v_buyer_user,
            btrim(p_recipient_name),
            nullif(lower(btrim(coalesce(p_recipient_email,''))), ''),
            nullif(btrim(coalesce(p_gift_message,'')),''),
            CASE WHEN p_mark_paid THEN 'paid' ELSE 'created' END)
    RETURNING id INTO v_gift;

  -- D8/4b: revives the buyer-account call site written in Stage 4 for exactly
  -- this moment — dead until now because nothing created a gift. Soft-fails:
  -- a buyer-account hiccup must not block the gift itself from existing, but
  -- (matching the D3 lesson) it must not be a silent NULL either.
  BEGIN
    v_buyer_acct := ensure_gift_buyer_account(v_gift);
  EXCEPTION WHEN others THEN
    PERFORM notify_staff(v_off.org_id, 'gift_buyer_account_failed',
      'Gift ' || v_code || ' created, but buyer account setup failed for '
        || p_buyer_email || ' — ' || SQLERRM,
      '/app/ops/intake');
  END;

  IF p_request_id IS NOT NULL THEN
    UPDATE requests SET status = 'converted' WHERE id = p_request_id;
  END IF;

  RETURN jsonb_build_object(
    'gift_id', v_gift, 'code', v_code,
    'claim_link', '/redeem?code=' || v_code,
    'buyer_contact_id', v_buyer_acct->>'contact_id');
END;
$function$;

REVOKE ALL ON FUNCTION public.create_gift(uuid,text,text,text,text,text,boolean,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_gift(uuid,text,text,text,text,text,boolean,uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.create_gift(uuid,text,text,text,text,text,boolean,uuid) IS
  'The one gift-creation path (D4, owner decision 2026-08-11: staff converts an '
  'inquiry). item_type/item_label/amount captured from the linked offering so '
  'redemption can provision a real purchase against it (D1).';

-- ── C. redeem_gift — D1 + D2 + D3 + the empty-array document bug ───────────
CREATE OR REPLACE FUNCTION public.redeem_gift(p_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_gift     gifts%ROWTYPE;
  v_off      offerings%ROWTYPE;
  v_email    text;
  v_fn       text;
  v_ln       text;
  v_marker   text;
  v_res      jsonb;
  v_contact  uuid;
  v_client   uuid;
  v_purchase uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'not_authenticated'; END IF;

  SELECT * INTO v_gift FROM gifts WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_gift.status = 'redeemed' THEN RETURN 'already_redeemed'; END IF;
  IF v_gift.expires_at IS NOT NULL AND v_gift.expires_at < now() THEN RETURN 'expired'; END IF;
  IF v_gift.unlock_gate = 'intro_call' AND NOT v_gift.unlocked THEN RETURN 'awaiting_intro_call'; END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();
  v_email := coalesce(v_email, lower(nullif(trim(v_gift.recipient_email), '')));
  IF v_email IS NULL OR v_gift.org_id IS NULL THEN
    -- D3: nothing to provision against. Record it and say so — not a silent
    -- 'redeemed' with no account behind it.
    PERFORM notify_staff(v_gift.org_id, 'gift_redemption_failed',
      'Gift ' || v_gift.code || ' redemption could not resolve an email for user '
        || auth.uid()::text, '/app/ops/intake');
    RETURN 'redemption_failed';
  END IF;

  IF v_gift.offering_id IS NOT NULL THEN
    SELECT * INTO v_off FROM offerings WHERE id = v_gift.offering_id;
  END IF;

  -- D2 (owner ruling 2026-08-11): the taxonomy splits on what the person
  -- HOLDS, not who paid. A real service (config_kind present, not a pure
  -- inquiry line — the same test attach_first_purchase_policies and
  -- promote_buyer_from_offering already use) makes the redeemer a CLIENT.
  -- Anything else — no linked offering, or a non-service line — CUSTOMER:
  -- they hold something but received no experience.
  v_marker := CASE
    WHEN v_off.config_kind IS NOT NULL AND v_off.config_kind <> 'inquire' THEN 'CLIENT'
    ELSE 'CUSTOMER'
  END;

  v_fn := nullif(split_part(coalesce(v_gift.recipient_name, ''), ' ', 1), '');
  v_ln := nullif(btrim(substr(coalesce(v_gift.recipient_name, ''),
            coalesce(nullif(position(' ' in coalesce(v_gift.recipient_name,'')), 0),
                     length(coalesce(v_gift.recipient_name,''))+1))), '');

  -- D3: provisioning happens BEFORE the gift is marked consumed, in one
  -- exception block. Failure here means the UPDATE below never runs, so the
  -- gift stays in its pre-redemption status — genuinely redeemable again —
  -- with no compensating write required.
  BEGIN
    -- Discovered in dry-run, not in the task doc: promote_contact_to_account
    -- RAISEs if auth.uid() has no `profiles` row yet — true for a brand-new
    -- gift recipient created via /api/register-gift, which (like every other
    -- account-creation path here) only creates the auth.users row, never the
    -- profile. redeem_invitation already carries this exact step for its own
    -- new-signup path; mirrored verbatim (same ON CONFLICT DO NOTHING, same
    -- app.allow_profile_link flag) rather than inventing a second shape.
    PERFORM set_config('app.allow_profile_link', '1', true);
    INSERT INTO profiles (user_id, org_id, first_name, last_name, email)
    VALUES (auth.uid(), v_gift.org_id, v_fn, v_ln, v_email)
    ON CONFLICT (user_id) DO NOTHING;

    -- BUG FIX: NULL/NULL, not ARRAY[]::text[]/ARRAY[]::text[]. An empty (but
    -- non-NULL) template_keys array took _ensure_client_account's "insert
    -- these specific docs" branch and unnested to zero rows — permanently
    -- skipping its "derive from category" fallback. NULL lets that fallback
    -- run (category defaults to GUEST for a brand-new contact); the real
    -- RIDER/HORSE_OWNER category — and the documents it requires — gets
    -- derived a moment later from the purchase itself, same as every other
    -- purchase path (see below).
    v_res := _ensure_client_account(v_gift.org_id, v_email, v_fn, v_ln, NULL, NULL, v_marker);
    v_contact := (v_res->>'contact_id')::uuid;
    v_client  := (v_res->>'client_id')::uuid;

    -- D1: on the standard spine — indistinguishable downstream from any other
    -- purchase. The purchase_items insert this makes fires BOTH
    -- promote_buyer_from_offering (derives RIDER/HORSE_OWNER from the
    -- offering's segment, assigns that category's documents — the
    -- authoritative deriver, fixed 2026-08-10) and
    -- purchase_items_generate_units (fulfillment_units by config_kind).
    -- Punch-card / single-session offerings also grant lesson_credits, same
    -- as every staff-provisioned purchase — that is what the schedule reads.
    -- Marked paid: a gift was already paid for; the recipient owes nothing.
    IF v_gift.offering_id IS NOT NULL THEN
      v_purchase := _provision_purchase_for_offerings(
        v_gift.org_id, v_contact, v_client, ARRAY[v_gift.offering_id],
        true, NULL, 'Gift redemption — code ' || v_gift.code, 0);
    END IF;

    PERFORM promote_contact_to_account(auth.uid(), v_contact);
  EXCEPTION WHEN others THEN
    -- D3: recorded, not NULL — staff can see exactly what failed and for whom.
    PERFORM notify_staff(v_gift.org_id, 'gift_redemption_failed',
      'Gift ' || v_gift.code || ' redemption failed for ' || v_email || ' — ' || SQLERRM,
      '/app/ops/intake');
    RETURN 'redemption_failed';
  END;

  UPDATE gifts SET status = 'redeemed', redeemed_at = now(), redeemed_user_id = auth.uid()
  WHERE id = v_gift.id;

  RETURN 'redeemed';
END;
$function$;

COMMENT ON FUNCTION public.redeem_gift(text) IS
  'D1/D2/D3 (2026-08-11): provisions a real purchase on the standard spine '
  '(config_kind-driven fulfillment_units + lesson_credits), marks the redeemer '
  'CLIENT/CUSTOMER by whether the linked offering is a real service, and only '
  'marks the gift consumed after provisioning succeeds. Failure -> '
  '''redemption_failed'', gift stays redeemable, notify_staff records it. '
  'open_gift/redeem_gift keep their existing auth shape by design — the gift '
  'code is the credential; do not add an identity gate to either.';
