-- TASK-ORIGIN — the three things he must be able to log before he reviews
-- every account: ORIGIN (where they found us), CHANNEL (how they contacted
-- us), and a backfilled PURCHASE with an honest date.
--
-- ⚠️ ORIGIN AND CHANNEL ARE NOT THE SAME QUESTION (§1) — two separate
-- lookup_options vocabularies, two separate columns on contacts (not
-- clients — a LEAD has an origin too, and that is the most valuable one to
-- capture; §4.2).
--
-- Seed lists are the owner's own words, verbatim, 2026-08-27 — nothing
-- guessed (§4.1's own warning: a wrong seed is worse than an empty one).

-- ── §4.1 / §4.2 — the two columns and the two vocabularies ─────────────────

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS client_origin text,
  ADD COLUMN IF NOT EXISTS contact_channel text;

INSERT INTO lookup_options (lookup_key, code, display_name, active, sort_order) VALUES
  ('client_origin', 'GOOGLE_SEARCH',         'Google search',         true, 10),
  ('client_origin', 'GOOGLE_MAPS',           'Google Maps',           true, 20),
  ('client_origin', 'GOOGLE_BUSINESS_PAGE',  'Google Business Page',  true, 30),
  ('client_origin', 'APPLE_MAPS',            'Apple Maps',            true, 40),
  ('client_origin', 'INSTAGRAM',             'Instagram',             true, 50),
  ('client_origin', 'FACEBOOK',              'Facebook',              true, 60),
  -- ⚠️ NOT SEEDED: an "OTHER" row. "Other (enter manually)…" is the existing
  -- SelectOrOther/addLookupValue escape (owner, 2026-08-25) — a UI affordance,
  -- never a stored vocabulary value — and the owner declined a pre-built
  -- Referral/Signage bucket for the same reason: "saw the sign is other,
  -- person is other, i need specifics... i dont need to collect 500 checked
  -- boxes for saw the sign to know the sign is bringing in business."
  ('contact_channel', 'WEBSITE_FORM',  'Website form',  true, 10),
  ('contact_channel', 'TEXT_MESSAGE',  'Text message',  true, 20),
  ('contact_channel', 'PHONE_CALL',    'Phone call',    true, 30),
  ('contact_channel', 'EMAIL',         'Email',         true, 40),
  ('contact_channel', 'WALK_UP',       'Walk-up',       true, 50)
ON CONFLICT (lookup_key, code) DO NOTHING;

-- ── T1 — add_lookup_value's hardcoded five-key allowlist (§5) ──────────────
-- Body-only change; same signature, plain CREATE OR REPLACE is safe.

CREATE OR REPLACE FUNCTION public.add_lookup_value(p_lookup_key text, p_raw_value text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key  text := btrim(coalesce(p_lookup_key, ''));
  v_val  text := btrim(coalesce(p_raw_value, ''));
  v_code text;
  v_hit  text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF v_val = '' THEN RAISE EXCEPTION 'a value is required'; END IF;

  -- Horse intake's vocabularies, plus TASK-ORIGIN's client_origin and
  -- contact_channel (§5 T1) — widened, not opened: an open namespace would
  -- let a public form invent vocabularies (HorseIntakeForm.tsx:222 reaches
  -- this same RPC).
  IF v_key NOT IN ('horse_breeds', 'horse_colors', 'horse_markings',
                   'horse_registration_org', 'horse_passport_country',
                   'client_origin', 'contact_channel') THEN
    RAISE EXCEPTION 'lookup % is not open to additions from a form', v_key;
  END IF;

  -- Already there, however it was capitalised? Use it.
  IF v_key = 'horse_breeds' THEN
    SELECT code INTO v_hit FROM horse_breeds
     WHERE lower(display_name) = lower(v_val) OR lower(code) = lower(v_val) LIMIT 1;
  ELSIF v_key = 'horse_colors' THEN
    SELECT code INTO v_hit FROM horse_colors
     WHERE lower(display_name) = lower(v_val) OR lower(code) = lower(v_val) LIMIT 1;
  ELSE
    SELECT code INTO v_hit FROM lookup_options
     WHERE lookup_key = v_key
       AND (lower(display_name) = lower(v_val) OR lower(code) = lower(v_val)) LIMIT 1;
  END IF;

  IF v_hit IS NOT NULL THEN
    -- A value switched off earlier is switched back on by someone needing it.
    IF v_key = 'horse_breeds' THEN
      UPDATE horse_breeds SET active = true WHERE code = v_hit AND NOT active;
    ELSIF v_key = 'horse_colors' THEN
      UPDATE horse_colors SET active = true WHERE code = v_hit AND NOT active;
    ELSE
      UPDATE lookup_options SET active = true
       WHERE lookup_key = v_key AND code = v_hit AND NOT active;
    END IF;
    RETURN jsonb_build_object('code', v_hit, 'display_name', v_val, 'created', false);
  END IF;

  -- Same code shape promote_lookup_suggestion mints, so the two paths cannot
  -- produce two different codes for one word.
  v_code := upper(regexp_replace(v_val, '[^a-zA-Z0-9]+', '_', 'g'));

  IF v_key = 'horse_breeds' THEN
    INSERT INTO horse_breeds (code, display_name, active, sort_order)
    VALUES (v_code, v_val, true, 900) ON CONFLICT (code) DO UPDATE SET active = true;
  ELSIF v_key = 'horse_colors' THEN
    INSERT INTO horse_colors (code, display_name, active, sort_order)
    VALUES (v_code, v_val, true, 900) ON CONFLICT (code) DO UPDATE SET active = true;
  ELSE
    INSERT INTO lookup_options (lookup_key, code, display_name, active, sort_order)
    VALUES (v_key, v_code, v_val, true, 900)
    ON CONFLICT (lookup_key, code) DO UPDATE SET active = true;
  END IF;

  -- The review queue exists to catch values worth adding. This one has BEEN added,
  -- so it is recorded as settled rather than left for the owner to rule on twice.
  INSERT INTO lookup_suggestions (lookup_key, raw_value, norm_value, status, org_id)
  VALUES (v_key, v_val, lower(v_val), 'promoted', current_org())
  ON CONFLICT (lookup_key, norm_value) DO UPDATE
    SET status = 'promoted', count = lookup_suggestions.count + 1, last_seen = now();

  RETURN jsonb_build_object('code', v_code, 'display_name', v_val, 'created', true);
END;
$function$;

-- ── T2 — update_contact_record's own column allowlist (§5) ─────────────────
-- Body-only change; same signature, plain CREATE OR REPLACE is safe.

CREATE OR REPLACE FUNCTION public.update_contact_record(p_contact_id uuid, p_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed text[] := ARRAY[
    'first_name','last_name','email','phone','phone_ext','mobile','mobile_ext','whatsapp','text_only_phone',
    'address_line1','address_line2','city','state','postal_code','country',
    'date_of_birth','notes','tags','contact_type','guardian_contact_id',
    'emergency_contact_1_name','emergency_contact_1_relationship','emergency_contact_1_phone',
    'emergency_contact_2_name','emergency_contact_2_relationship','emergency_contact_2_phone',
    'riding_experience_years','jump_experience','riding_background','jump_limitations',
    'preferred_contact','hide_mobile','hide_whatsapp','hide_email',
    'social_tiktok','social_instagram','social_facebook','social_linkedin',
    -- TASK-ORIGIN §5 T2 — "editable afterwards, on the record, forever" (§4.2).
    'client_origin','contact_channel'];
  k text;
  v_sets text[] := '{}';
  v_sql text;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM contacts
                  WHERE id = p_contact_id AND org_id = current_org() AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'contact not found in this organisation';
  END IF;

  FOR k IN SELECT jsonb_object_keys(p_patch) LOOP
    IF NOT coalesce(k = ANY(v_allowed), false) THEN
      RAISE EXCEPTION 'field % is not editable here', k;
    END IF;
    v_sets := v_sets || format('%I = ($1->>%L)::text', k, k);
  END LOOP;

  IF array_length(v_sets, 1) IS NULL THEN
    RETURN contact_dossier(p_contact_id);
  END IF;

  -- tags is text[], the booleans are boolean, dates are date — cast per column
  -- rather than forcing everything through text.
  v_sql := 'UPDATE contacts SET ' || array_to_string(
    ARRAY(SELECT CASE
      WHEN key = 'tags' THEN
        format('tags = CASE WHEN $1->%L = ''null''::jsonb THEN NULL ELSE ARRAY(SELECT jsonb_array_elements_text($1->%L)) END', key, key)
      WHEN key IN ('hide_mobile','hide_whatsapp','hide_email') THEN
        format('%I = ($1->>%L)::boolean', key, key)
      WHEN key = 'date_of_birth' THEN
        format('date_of_birth = nullif($1->>%L, '''')::date', key)
      WHEN key = 'guardian_contact_id' THEN
        format('guardian_contact_id = nullif($1->>%L, '''')::uuid', key)
      ELSE format('%I = nullif($1->>%L, '''')', key, key)
    END FROM jsonb_object_keys(p_patch) AS key), ', ')
    || ', updated_at = now() WHERE id = $2';

  EXECUTE v_sql USING p_patch, p_contact_id;
  RETURN contact_dossier(p_contact_id);
END
$function$;

-- ── T3 — menu_inventory's hardcoded used_by label (§5) ──────────────────────
-- Body-only change; same signature and return type, plain CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.menu_inventory()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(m ORDER BY m->>'label'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
             'source', 'vocabulary', 'menu_key', k.key, 'label', k.label,
             'used_by', k.used_by,
             'total', k.total, 'active', k.active) AS m
      FROM (
        SELECT 'horse_breeds' AS key, 'Horse breed' AS label,
               'Horse records · horse intake · contracts' AS used_by,
               count(*) AS total, count(*) FILTER (WHERE active) AS active
          FROM horse_breeds
        UNION ALL
        SELECT 'horse_colors', 'Horse color', 'Horse records · horse intake · contracts',
               count(*), count(*) FILTER (WHERE active) FROM horse_colors
        UNION ALL
        SELECT lo.lookup_key,
               initcap(replace(replace(lo.lookup_key, 'horse_', 'Horse '), '_', ' ')),
               -- TASK-ORIGIN §5 T3: every lookup_options key used to be labelled
               -- 'Horse intake · contracts' regardless of what it actually feeds.
               -- Minimal CASE, not a restructure (§8 explicitly rules that out).
               CASE lo.lookup_key
                 WHEN 'client_origin'   THEN 'Contact & client record'
                 WHEN 'contact_channel' THEN 'Contact & client record'
                 ELSE 'Horse intake · contracts'
               END,
               count(*), count(*) FILTER (WHERE lo.active)
          FROM lookup_options lo GROUP BY lo.lookup_key
      ) k
    UNION ALL
    SELECT jsonb_build_object(
             'source', 'form', 'menu_key', fd.form_key || '::' || (f->>'key'),
             'label', (f->>'label'), 'form_key', fd.form_key, 'field_key', (f->>'key'),
             'used_by', fd.title,
             'total', jsonb_array_length(f->'options'),
             'active', jsonb_array_length(f->'options'))
      FROM form_definitions fd,
           LATERAL jsonb_array_elements(fd.schema->'sections') s,
           LATERAL jsonb_array_elements(s->'fields') f
     WHERE fd.active AND f ? 'options'
  ) all_menus;
$function$;

-- ── §6 read reach: staff_contact_directory (Leads tab roster) ──────────────
-- Adds two OUTPUT columns to a RETURNS TABLE function — Postgres refuses that
-- via CREATE OR REPLACE ("cannot change return type"), so DROP first (no
-- other function calls this by name — checked pg_proc.prosrc).

DROP FUNCTION IF EXISTS public.staff_contact_directory();

CREATE FUNCTION public.staff_contact_directory()
 RETURNS TABLE(id uuid, display_code text, first_name text, last_name text, email text, phone text, tags text[], notes text, created_at timestamp with time zone, linked_user_id uuid, linked_role text, is_client boolean, party_roles text[], horses_owned bigint, horses_leased bigint, engagement_count bigint, document_count bigint, contact_type text, is_company boolean, client_origin text, contact_channel text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id, c.display_code, c.first_name, c.last_name,
         c.email, c.phone, c.tags, c.notes, c.created_at,
         p.user_id, p.role,
         EXISTS (SELECT 1 FROM clients cl
                  WHERE cl.contact_id = c.id AND cl.deleted_at IS NULL),
         (SELECT coalesce(array_agg(DISTINCT dp.party_role), '{}')
            FROM document_parties dp WHERE dp.contact_id = c.id),
         (SELECT count(*) FROM horses h
           WHERE h.current_owner_contact_id = c.id AND h.deleted_at IS NULL),
         (SELECT count(*) FROM horses h
           WHERE h.lessee_contact_id = c.id AND h.deleted_at IS NULL),
         0::bigint,
         (SELECT count(DISTINCT d.id)
            FROM documents d
           WHERE d.deleted_at IS NULL
             AND (d.contact_id = c.id
                  OR EXISTS (SELECT 1 FROM document_parties dp
                              WHERE dp.document_id = d.id AND dp.contact_id = c.id))),
         c.contact_type,
         coalesce(c.is_company, false),
         c.client_origin, c.contact_channel
  FROM contacts c
  LEFT JOIN profiles p ON p.contact_id = c.id
  WHERE c.org_id = current_org()
    AND c.deleted_at IS NULL
    AND has_staff_access()
  ORDER BY c.last_name NULLS LAST, c.first_name
$function$;

-- ── §6 read reach: admin_client_accounts (Clients tab roster) ──────────────
-- Same DROP-then-CREATE reasoning as above. confirm_payment_claim and
-- apply_booking_fee call OTHER functions (mark_purchase_paid /
-- grant_lesson_credit below) — nothing calls admin_client_accounts from PL/pgSQL.

DROP FUNCTION IF EXISTS public.admin_client_accounts();

CREATE FUNCTION public.admin_client_accounts()
 RETURNS TABLE(kind text, user_id uuid, contact_id uuid, client_id uuid, first_name text, last_name text, display_name text, email text, is_suspended boolean, member_status text, created_at timestamp with time zone, tags text[], invite_id uuid, invite_status text, invite_expires_at timestamp with time zone, invite_scheduled_for date, document_count integer, order_count integer, credits jsonb, services jsonb, client_origin text, contact_channel text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    -- arm 1: login-backed accounts (unchanged, + the two new columns)
    SELECT 'account' AS kind, p.user_id, p.contact_id, cl.id AS client_id,
           p.first_name, p.last_name, p.display_name, p.email,
           p.is_suspended, m.status AS member_status, p.created_at,
           c.tags, NULL::uuid AS invite_id, NULL::text AS invite_status,
           NULL::timestamptz AS invite_expires_at, NULL::date AS invite_scheduled_for,
           c.client_origin, c.contact_channel
    FROM profiles p
    JOIN contacts c ON c.id = p.contact_id AND c.org_id = current_org() AND c.deleted_at IS NULL
    LEFT JOIN clients cl ON cl.contact_id = p.contact_id AND cl.deleted_at IS NULL
    LEFT JOIN members m ON m.user_id = p.user_id
    WHERE p.role = 'USER' AND is_admin()

    UNION ALL

    -- arm 2: provisioned clients without a login (unchanged, + the two new columns)
    SELECT 'pending', NULL, c.id, cl.id,
           c.first_name, c.last_name, NULL, c.email,
           false, NULL, cl.created_at,
           c.tags, inv.id, inv.status, inv.expires_at, inv.scheduled_for,
           c.client_origin, c.contact_channel
    FROM clients cl
    JOIN contacts c ON c.id = cl.contact_id AND c.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT i.id, i.status, i.expires_at, i.scheduled_for
      FROM invitations i
      WHERE lower(i.email) = lower(c.email)
      ORDER BY i.created_at DESC LIMIT 1
    ) inv ON true
    WHERE cl.org_id = current_org() AND cl.deleted_at IS NULL AND is_admin()
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id)

    UNION ALL

    -- arm 3: bare contacts — no clients row, no USER login (unchanged, + the
    -- two new columns). LEAD / TEAM / DIRECTORY types live on their own pages.
    SELECT 'contact', NULL, c.id, NULL,
           c.first_name, c.last_name, NULL, c.email,
           false, NULL, c.created_at,
           c.tags, inv.id, inv.status, inv.expires_at, inv.scheduled_for,
           c.client_origin, c.contact_channel
    FROM contacts c
    LEFT JOIN LATERAL (
      SELECT i.id, i.status, i.expires_at, i.scheduled_for
      FROM invitations i
      WHERE c.email IS NOT NULL AND lower(i.email) = lower(c.email)
      ORDER BY i.created_at DESC LIMIT 1
    ) inv ON true
    WHERE c.org_id = current_org() AND c.deleted_at IS NULL AND is_admin()
      AND (c.contact_type = 'CONTACT' OR c.contact_type IS NULL)
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id AND p.role = 'USER')
      -- not already arm 2 (a client row with a STAFF profile is in neither
      -- earlier arm, so it must land here rather than be excluded)
      AND NOT EXISTS (
        SELECT 1 FROM clients cl
        WHERE cl.contact_id = c.id AND cl.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM profiles p2 WHERE p2.contact_id = c.id))
  )
  SELECT b.kind, b.user_id, b.contact_id, b.client_id,
         b.first_name, b.last_name, b.display_name, b.email,
         b.is_suspended, b.member_status, b.created_at,
         b.tags, b.invite_id, b.invite_status,
         b.invite_expires_at, b.invite_scheduled_for,
         agg.document_count, agg.order_count, agg.credits, agg.services,
         b.client_origin, b.contact_channel
  FROM base b
  LEFT JOIN LATERAL (
    SELECT
      -- same document grain as staff_contact_directory: own + party
      (SELECT count(DISTINCT d.id)::int FROM documents d
        WHERE d.deleted_at IS NULL
          AND (d.contact_id = b.contact_id
               OR EXISTS (SELECT 1 FROM document_parties dp
                           WHERE dp.document_id = d.id AND dp.contact_id = b.contact_id)))
        AS document_count,
      (SELECT count(*)::int FROM purchases pu
        WHERE pu.deleted_at IS NULL
          AND (pu.buyer_contact_id = b.contact_id
               OR (b.user_id IS NOT NULL AND pu.buyer_user_id = b.user_id)))
        AS order_count,
      -- open credit balances, each with the name it applies to
      (SELECT coalesce(jsonb_agg(jsonb_build_object('label', x.label, 'remaining', x.rem)
                                 ORDER BY x.rem DESC, x.label), '[]'::jsonb)
        FROM (
          SELECT coalesce(o.name, lc.package_key, 'Credits') AS label,
                 sum(lc.credits_remaining)::int AS rem
          FROM lesson_credits lc
          LEFT JOIN offerings o ON o.id = lc.offering_id
          WHERE lc.deleted_at IS NULL
            AND b.client_id IS NOT NULL AND lc.client_id = b.client_id
          GROUP BY 1
          HAVING sum(lc.credits_remaining) > 0
        ) x) AS credits,
      -- consumed service events keyed by service_type code
      (SELECT coalesce(jsonb_object_agg(y.st, y.n), '{}'::jsonb)
        FROM (
          SELECT z.st, sum(z.n)::int AS n FROM (
            SELECT coalesce(o.service_type, o2.service_type,
                            CASE WHEN bk.kind = 'lesson' THEN 'RIDING_LESSON' END) AS st,
                   count(*) AS n
            FROM bookings bk
            LEFT JOIN offerings o ON o.id = bk.offering_id
            LEFT JOIN lesson_credits lc2 ON lc2.id = bk.credit_id
            LEFT JOIN offerings o2 ON o2.id = lc2.offering_id
            WHERE bk.status IN ('scheduled','confirmed','completed','no_show')
              AND ((b.client_id IS NOT NULL AND bk.client_id = b.client_id)
                   OR bk.account_contact_id = b.contact_id
                   OR (b.user_id IS NOT NULL AND bk.account_user_id = b.user_id))
            GROUP BY 1
            UNION ALL
            SELECT o3.service_type, count(*)
            FROM fulfillment_units fu
            JOIN purchases pu2 ON pu2.id = fu.purchase_id AND pu2.deleted_at IS NULL
            JOIN purchase_items pi ON pi.id = fu.purchase_item_id
            JOIN offerings o3 ON o3.id = pi.offering_id
            WHERE fu.deleted_at IS NULL AND fu.unit_kind <> 'session'
              AND fu.consumed_at IS NOT NULL
              AND (pu2.buyer_contact_id = b.contact_id
                   OR (b.user_id IS NOT NULL AND pu2.buyer_user_id = b.user_id))
            GROUP BY 1
          ) z
          WHERE z.st IS NOT NULL
          GROUP BY z.st
        ) y) AS services
  ) agg ON true
$function$;

-- ── §4.2 CHANNEL is self-evident for a website-form contact (owner,
-- 2026-08-27): "the form submissions are self evident because they are
-- system captured and should self inform, the others are manual inputs we
-- need to log." requests_capture_contact is the ONLY place a brand-new LEAD
-- is materialised from a public submission — every request reaching it came
-- through a website form (submit_public_request). Set on INSERT only, never
-- on the dedupe-match branch: an existing contact's already-recorded (or
-- deliberately blank) channel must not be overwritten by a later request.

CREATE OR REPLACE FUNCTION public.requests_capture_contact()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_email   text := lower(nullif(trim(coalesce(NEW.contact_email, '')), ''));
BEGIN
  -- No email means nothing to dedupe on and no way to reach them; the request
  -- still stands on its own in the queue.
  IF v_email IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_contact
    FROM contacts
   WHERE lower(email) = v_email AND org_id = NEW.org_id AND deleted_at IS NULL
   ORDER BY created_at
   LIMIT 1;

  IF v_contact IS NULL THEN
    INSERT INTO contacts (org_id, first_name, last_name, email, phone, contact_type, notes, contact_channel)
    VALUES (NEW.org_id,
            nullif(trim(coalesce(NEW.contact_first_name, '')), ''),
            nullif(trim(coalesce(NEW.contact_last_name, '')), ''),
            v_email,
            nullif(trim(coalesce(NEW.contact_phone, '')), ''),
            'LEAD',
            'Captured from ' || coalesce(NEW.channel, 'inbound')
              || coalesce(' (' || NEW.category || ')', ''),
            'WEBSITE_FORM')
    RETURNING id INTO v_contact;
  END IF;

  -- ITEM 2, repaired: this trigger is AFTER INSERT, so `NEW.contact_id := ...`
  -- is discarded once the row is already written. Persist explicitly. The
  -- WHERE guard keeps this idempotent and never clobbers an existing link.
  UPDATE requests SET contact_id = v_contact
   WHERE id = NEW.id AND contact_id IS NULL;

  RETURN NEW;
END
$function$;

-- ── §4.3 — a backfilled purchase needs an honest date, not today's ─────────
-- revenue_summary (the function an actual monthly report calls) filters on
-- purchases.paid_at, never created_at — confirmed by reading it. Both
-- functions below currently hardcode now() for that column. Adding a
-- trailing optional param is a SIGNATURE change (a new parameter type
-- position), which CREATE OR REPLACE will not apply to the existing function
-- — it creates a silent second overload instead (ORCHESTRATOR §3c: "old
-- call sites keep resolving to the old body"). DROP the exact old signature
-- first. Existing callers (confirm_payment_claim, apply_booking_fee, and
-- every frontend call) pass the same 4/6 positional args as before; the new
-- trailing param defaults to NULL and preserves the old now()-stamping
-- behaviour exactly, so nothing already calling these breaks.

DROP FUNCTION IF EXISTS public._payment_settle(uuid, text, text, numeric);

CREATE FUNCTION public._payment_settle(p_purchase_id uuid, p_method text, p_reference text, p_amount numeric, p_confirmed_at timestamptz DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM purchases WHERE id = p_purchase_id;
  -- settle the open entry if there is one; otherwise the money arrived without a
  -- declaration (staff took cash at the barn) and the entry is created settled.
  v_id := _payment_open(p_purchase_id, p_method, p_reference, auth.uid(), true);
  IF v_id IS NULL THEN RETURN NULL; END IF;

  UPDATE payments
     SET status       = 'paid',
         amount       = coalesce(p_amount, amount),
         -- TASK-ORIGIN §4.3: a backfilled historic payment is confirmed AS OF
         -- the date it actually happened, not the day someone typed it in.
         confirmed_at = coalesce(p_confirmed_at, now()),
         confirmed_by = auth.uid()
   WHERE id = v_id;

  PERFORM log_status_event('payment', v_id, 'confirmed',
    'Confirmed received — ' || lower(btrim(coalesce(p_method,'')))
      || coalesce(' — ref ' || nullif(btrim(coalesce(p_reference,'')), ''), ''), v_org);
  RETURN v_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.mark_purchase_paid(uuid, numeric, text, text);

CREATE FUNCTION public.mark_purchase_paid(p_purchase_id uuid, p_amount numeric, p_reference text DEFAULT NULL::text, p_method text DEFAULT 'zelle'::text, p_paid_at timestamptz DEFAULT NULL)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pur       purchases%ROWTYPE;
  v_this      numeric;
  v_settled   numeric;
  v_covers    boolean;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT * INTO v_pur FROM purchases WHERE id = p_purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown purchase: %', p_purchase_id; END IF;
  IF v_pur.payment_status = 'paid' THEN RETURN 'already_paid'; END IF;

  -- What was already settled BEFORE this act, from the payment records.
  SELECT coalesce(sum(amount), 0) INTO v_settled
    FROM payments
   WHERE purchase_id = p_purchase_id AND status = 'paid' AND deleted_at IS NULL;

  -- NULL amount keeps the old meaning: "settle whatever is left".
  v_this := coalesce(p_amount, greatest(coalesce(v_pur.amount, 0) - v_settled, 0));
  IF v_this <= 0 THEN RAISE EXCEPTION 'a payment amount must be greater than zero'; END IF;
  IF v_settled + v_this > coalesce(v_pur.amount, 0) + 0.005 THEN
    RAISE EXCEPTION 'that would settle %, more than the order total of %',
      v_settled + v_this, v_pur.amount;
  END IF;

  -- the entry that says WHEN this money was marked paid, by WHOM, and HOW
  PERFORM _payment_settle(p_purchase_id, coalesce(p_method,'zelle'), p_reference, v_this, p_paid_at);

  v_covers := (v_settled + v_this) >= coalesce(v_pur.amount, 0) - 0.005;

  UPDATE purchases p
     SET amount_paid       = v_settled + v_this,
         payment_method    = lower(btrim(coalesce(p_method, 'zelle'))),
         payment_reference = COALESCE(p.payment_reference, p_reference),
         -- ⚠️ ONLY when the money is all in. A part-paid order is still open, and
         -- its entitlements are still gated on payment exactly as before.
         -- TASK-ORIGIN §4.3: the date a monthly report reads (revenue_summary
         -- filters on paid_at) — a backfilled sale states when it really
         -- happened, or this stays today's default exactly as before.
         payment_status    = CASE WHEN v_covers THEN 'paid' ELSE p.payment_status END,
         status            = CASE WHEN v_covers THEN 'paid' ELSE p.status END,
         paid_at           = CASE WHEN v_covers THEN coalesce(p_paid_at, now()) ELSE p.paid_at END
   WHERE p.id = p_purchase_id;

  IF NOT v_covers THEN
    PERFORM log_status_event('order', p_purchase_id, 'partial_payment',
      'Part payment of ' || to_char(v_this, 'FM999999990.00')
        || ' by ' || lower(btrim(coalesce(p_method,'zelle')))
        || ' — ' || to_char(coalesce(v_pur.amount,0) - (v_settled + v_this), 'FM999999990.00')
        || ' still outstanding', v_pur.org_id);
    RETURN 'part_paid';
  END IF;

  PERFORM _notify_purchase_paid(p_purchase_id);
  RETURN 'paid';
END;
$function$;

DROP FUNCTION IF EXISTS public.grant_lesson_credit(uuid, uuid, integer, text, text, text);

CREATE FUNCTION public.grant_lesson_credit(p_client_id uuid, p_offering_id uuid, p_quantity integer DEFAULT 1, p_mode text DEFAULT 'handwrite'::text, p_reason text DEFAULT NULL::text, p_payment_method text DEFAULT NULL::text, p_paid_at timestamptz DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid := current_org();
  v_reason   text := nullif(btrim(coalesce(p_reason, '')), '');
  v_mode     text := lower(btrim(coalesce(p_mode, '')));
  v_qty      integer := coalesce(p_quantity, 1);
  v_cl       clients%ROWTYPE;
  v_off      offerings%ROWTYPE;
  v_list     numeric;
  v_line     numeric;
  v_total    numeric;
  v_purchase uuid;
  v_item     uuid;
  v_credit   lesson_credits%ROWTYPE;
  v_user     uuid;
  v_code     text;
  v_detail   text;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'only staff may grant a credit';
  END IF;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no organization in scope';
  END IF;
  IF v_mode NOT IN ('handwrite', 'comp', 'bill') THEN
    RAISE EXCEPTION 'mode must be handwrite, comp or bill (got %)', p_mode;
  END IF;
  -- D19(2). Not optional, not defaulted, not a placeholder.
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'a reason is required to grant a credit';
  END IF;
  IF v_qty < 1 THEN
    RAISE EXCEPTION 'quantity must be at least 1';
  END IF;

  SELECT * INTO v_cl FROM clients
   WHERE id = p_client_id AND deleted_at IS NULL AND org_id = v_org;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'client not found in this organization';
  END IF;

  SELECT * INTO v_off FROM offerings WHERE id = p_offering_id AND org_id = v_org;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'service not found in this organization';
  END IF;
  IF coalesce(v_off.config_kind, '') <> 'scheduled' THEN
    RAISE EXCEPTION '% is a % service — only a scheduled service mints a spendable credit. A weekly plan is a standing slot, not a credit balance.',
      v_off.name, coalesce(v_off.config_kind, 'quote-priced');
  END IF;
  IF coalesce(v_off.unit_count, 0) <= 0 THEN
    RAISE EXCEPTION '% carries no credit units, so granting it would mint nothing', v_off.name;
  END IF;

  -- THE LIST PRICE AT GRANT TIME. Read now, stored on the line, never re-derived:
  -- the offering's price is editable and a recorded loss must not move with it.
  v_list  := coalesce(v_off.price_amount, 0);
  v_line  := CASE WHEN v_mode = 'comp' THEN 0 ELSE v_list END;
  v_total := v_line * v_qty;

  INSERT INTO purchases (org_id, buyer_contact_id, status, amount, amount_paid,
                         payment_method, payment_status, paid_at, notes)
  VALUES (
    v_org, v_cl.contact_id,
    CASE WHEN v_mode = 'bill' THEN 'awaiting_payment' ELSE 'paid' END,
    v_total,
    CASE WHEN v_mode = 'bill' THEN 0 ELSE v_total END,
    CASE WHEN v_mode = 'comp' THEN 'comp'
         WHEN v_mode = 'handwrite' THEN coalesce(nullif(btrim(coalesce(p_payment_method, '')), ''), 'offline')
         END,
    CASE WHEN v_mode = 'bill' THEN 'unpaid' ELSE 'paid' END,
    -- TASK-ORIGIN §4.3: "a backfilled purchase entered today with today's
    -- timestamp is worse than no record." A bill is unpaid regardless — no
    -- paid_at to backdate until it is settled (mark_purchase_paid, above).
    CASE WHEN v_mode = 'bill' THEN NULL ELSE coalesce(p_paid_at, now()) END,
    CASE v_mode
      WHEN 'comp'      THEN 'Comped by staff — ' || v_reason
      WHEN 'bill'      THEN 'Billed by staff — ' || v_reason
      ELSE                  'Hand-written by staff — ' || v_reason
    END)
  RETURNING id, display_code INTO v_purchase, v_code;

  -- The line. `config` is the per-line intent this table already carries; the grant's
  -- own facts live there rather than in new columns nothing else would read.
  INSERT INTO purchase_items (org_id, purchase_id, offering_id, label, price_amount,
                              price_unit, quantity, config)
  VALUES (v_org, v_purchase, v_off.id, v_off.name, v_line, v_off.price_unit, v_qty,
          jsonb_build_object(
            'grant_mode',  v_mode,
            'grant_reason', v_reason,
            'list_price',  v_list,
            'granted_by',  auth.uid(),
            'granted_at',  now()))
  RETURNING id INTO v_item;

  -- The INSERT trigger has already minted through the engine. This re-run only names
  -- the client explicitly (the trigger resolves it from the buyer contact); the
  -- one-per-item unique index makes it a no-op when the trigger already succeeded.
  PERFORM _mint_credits_for_purchase_item(v_item, p_client_id);

  SELECT * INTO v_credit FROM lesson_credits
   WHERE purchase_item_id = v_item AND deleted_at IS NULL
   ORDER BY created_at LIMIT 1;
  -- D17: never report a grant that granted nothing. If the engine minted no row, the
  -- whole act rolls back rather than leaving an order that looks like an entitlement.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'the credit engine minted nothing for % — no credit was granted', v_off.name;
  END IF;

  v_detail :=
    CASE v_mode
      WHEN 'comp' THEN 'Comped ' || v_credit.credits_total || ' x ' || v_off.name
                       || ' (list ' || fmt_money(v_list * v_qty) || ' written off)'
      WHEN 'bill' THEN 'Billed ' || v_credit.credits_total || ' x ' || v_off.name
                       || ' — ' || fmt_money(v_total) || ' owed'
      ELSE             'Hand-wrote ' || v_credit.credits_total || ' x ' || v_off.name
                       || ' (' || fmt_money(v_total) || ' recorded as received)'
    END || ' — ' || v_reason;
  PERFORM log_status_event('order', v_purchase, 'staff_grant', v_detail, v_org);

  -- The client is told what they now hold. A BILL raises no "payment due" notice here:
  -- asking for the money is a separate, deliberate staff act (request_purchase_payment).
  SELECT pr.user_id INTO v_user FROM profiles pr WHERE pr.contact_id = v_cl.contact_id LIMIT 1;
  IF v_user IS NOT NULL THEN
    PERFORM notify_user(v_user, 'credit_granted',
      v_credit.credits_total || ' x ' || v_off.name || ' added to your account',
      CASE v_mode
        WHEN 'comp' THEN 'With our compliments. ' || v_reason
        WHEN 'bill' THEN 'Added now — ' || fmt_money(v_total) || ' is owed on order ' || coalesce(v_code, '') || '.'
        ELSE             'Recorded against ' || fmt_money(v_total) || ' already received.'
      END,
      '/order/' || v_purchase::text);
  END IF;

  IF v_mode = 'handwrite' THEN
    -- Same "payment received" trail every other paid order gets. A comp is not a
    -- payment and does not get one.
    PERFORM _notify_purchase_paid(v_purchase);
  END IF;

  RETURN jsonb_build_object(
    'purchase_id',   v_purchase,
    'display_code',  v_code,
    'item_id',       v_item,
    'credit_id',     v_credit.id,
    'credits',       v_credit.credits_total,
    'mode',          v_mode,
    'reason',        v_reason,
    'list_price',    v_list,
    'amount',        v_total,
    'comp_value',    CASE WHEN v_mode = 'comp' THEN v_list * v_qty ELSE 0 END,
    'offering_name', v_off.name,
    'client_id',     p_client_id);
END;
$function$;

-- ── Restore pre-migration privilege posture ─────────────────────────────
-- DROP FUNCTION + CREATE FUNCTION resets the ACL to the Postgres default
-- (EXECUTE granted to PUBLIC), which is NOT what these three had before —
-- measured via pg_proc.proacl prior to this migration:
--   _payment_settle     {postgres=X,service_role=X}                    — no PUBLIC, no anon, no authenticated
--   mark_purchase_paid  {postgres=X,service_role=X,authenticated=X}    — no PUBLIC, no anon
--   grant_lesson_credit {postgres=X,anon=X,authenticated=X,service_role=X} — no PUBLIC
-- An internal payment-settling helper and two staff/service-gated write RPCs
-- must not regain public or anon reachability just because their signature
-- grew a trailing optional parameter — that would be a privilege escalation
-- introduced by this migration itself. (staff_contact_directory and
-- admin_client_accounts already carried a PUBLIC grant before this
-- migration, so their post-CREATE default needs no correction.)

-- ⚠️ This database auto-grants EXECUTE to anon/authenticated/service_role on
-- every new function (ALTER DEFAULT PRIVILEGES), independently of the plain
-- PUBLIC grant — proven by testing in a rolled-back transaction: revoking
-- from PUBLIC alone left anon and authenticated still holding EXECUTE. Both
-- must be named explicitly wherever the original ACL excluded them.
REVOKE ALL ON FUNCTION public._payment_settle(uuid, text, text, numeric, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._payment_settle(uuid, text, text, numeric, timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.mark_purchase_paid(uuid, numeric, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_purchase_paid(uuid, numeric, text, text, timestamptz) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.grant_lesson_credit(uuid, uuid, integer, text, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_lesson_credit(uuid, uuid, integer, text, text, text, timestamptz) TO anon, authenticated, service_role;
