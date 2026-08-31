-- TASK-FIX2 §4 — three small, separately-proven corrections in one migration.
--
-- (a) `admin_client_overview.counts.orders` counted `buyer_user_id = p_user_id`.
--     ALL 13 live purchases carry `buyer_user_id IS NULL` — the staff provisioning
--     spine writes `buyer_contact_id` only — so the Overview header read 0 while
--     the Orders tab beside it, which already matches on BOTH identifiers
--     (`Admin.tsx buyerFilter()`), read 2. COUNTFIX's rule: one fact, one named
--     query. This makes the RPC agree with the list it sits above, using exactly
--     the predicate `admin_client_accounts().order_count` already uses.
--
-- (b) `calendar_free_busy` returned no `instructor_user_id` in ANY branch, which
--     is the READ half of the P0 overwrite (20260831T0900 fixed the WRITE half).
--     With the field absent the panel cannot show who is delivering a session —
--     staff read "You (whoever books it)" on a lesson that is Claire's. Added to
--     the STAFF branch only: it is an internal roster fact and no client branch
--     gains a key. There is still NO picker (owner: one instructor).
--     ⚠️ Also fixes AR1 F26b while the body is open: the aggregate sorted with
--     `ORDER BY (item->>'starts_at')` — a TEXT sort of a timestamptz, which puts
--     two items an offset apart backwards inside the DST fall-back hour.
--
-- (c) D32 retirement comments on `calendar_revenue` and `calendar_money_items`.
--     Both have ZERO call sites in src/, api/ and test/. `calendar_revenue`
--     disagrees with `revenue_summary` by 9.7x ($18,320 vs $1,880 for August)
--     because it sums scheduled value at start time while `revenue_summary` sums
--     money received at paid_at. `revenue_summary` is the single source and the
--     calendar already calls it. Under D32 neither function is dropped; they are
--     labelled in their own bodies so the next thread that greps "revenue" cannot
--     mistake them for the live one.

-- ── (a) ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_client_overview(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
  v_contact uuid;
  v jsonb;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'admin access required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id AND org_id = v_org) THEN
    RAISE EXCEPTION 'account not found in your organization';
  END IF;
  SELECT contact_id INTO v_contact FROM profiles WHERE user_id = p_user_id;

  SELECT jsonb_build_object(
    'profile', (SELECT jsonb_build_object(
        'user_id', p.user_id, 'email', p.email, 'first_name', p.first_name,
        'last_name', p.last_name, 'display_name', p.display_name,
        'phone', pc.phone, 'mobile', pc.mobile, 'whatsapp', pc.whatsapp,
        'riding_level', p.riding_level, 'bio', p.bio, 'role', p.role,
        'is_suspended', p.is_suspended, 'created_at', p.created_at,
        'contact_id', p.contact_id,
        'client_id', (SELECT c.id FROM clients c WHERE c.contact_id = p.contact_id AND c.deleted_at IS NULL))
      FROM profiles p LEFT JOIN contacts pc ON pc.id = p.contact_id AND pc.deleted_at IS NULL WHERE p.user_id = p_user_id),
    'login', (SELECT jsonb_build_object(
        'providers', coalesce((SELECT jsonb_agg(DISTINCT i.provider)
          FROM auth.identities i WHERE i.user_id = p_user_id), '[]'::jsonb),
        'last_sign_in_at', u.last_sign_in_at,
        'created_at', u.created_at,
        'email_confirmed_at', u.email_confirmed_at)
      FROM auth.users u WHERE u.id = p_user_id),
    'member', (SELECT jsonb_build_object('status', m.status,
        'started_at', m.started_at)
      FROM members m WHERE m.user_id = p_user_id LIMIT 1),
    'counts', jsonb_build_object(
      -- ⚠️ FIX2 §4a: the buyer of a staff-provisioned order is a CONTACT, not a
      -- login. Same predicate as admin_client_accounts().order_count and as
      -- Admin.tsx's buyerFilter(), so the header and the tab cannot disagree.
      'orders',    (SELECT count(*) FROM purchases pu
                     WHERE pu.deleted_at IS NULL
                       AND (pu.buyer_user_id = p_user_id
                            OR (v_contact IS NOT NULL AND pu.buyer_contact_id = v_contact))),
      'posts',     (SELECT count(*) FROM feed_posts WHERE author_id = p_user_id),
      'documents', (SELECT count(*) FROM documents d
                     JOIN profiles p ON p.contact_id = d.contact_id
                     WHERE p.user_id = p_user_id AND d.deleted_at IS NULL),
      'bookings',  (SELECT count(*) FROM bookings b
                     JOIN clients c ON c.id = b.client_id
                     JOIN profiles p ON p.contact_id = c.contact_id
                     WHERE b.kind = 'lesson' AND p.user_id = p_user_id))
  ) INTO v;
  RETURN v;
END;
$function$;

-- ── (b) ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calendar_free_busy(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org    uuid := current_org();
  v_staff  boolean := has_staff_access();
  v_client uuid := current_client_id();
  v_items  jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_to <= p_from OR p_to - p_from > interval '62 days' THEN
    RAISE EXCEPTION 'range must be positive and <= 62 days';
  END IF;

  -- ⚠️ FIX2 §4b: sort on the TIMESTAMP, not its text. `(item->>'starts_at')` is a
  -- text sort of a timestamptz and orders two items an offset apart backwards
  -- inside the DST fall-back hour (AR1 F26b).
  SELECT coalesce(jsonb_agg(item ORDER BY ((item->>'starts_at')::timestamptz)), '[]'::jsonb) INTO v_items
  FROM (
    SELECT CASE
      -- staff/admin: full detail on every item
      WHEN v_staff THEN jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'status', b.status, 'all_day', b.all_day,
        'starts_at', b.starts_at, 'ends_at', b.ends_at,
        'is_flexible', b.is_flexible, 'is_mine', false, 'mine_role', 'staff',
        'client_id', b.client_id, 'horse_id', b.horse_id, 'purchase_id', b.purchase_id,
        -- ⚠️ FIX2 §1/§4b: WHO IS DELIVERING IT. Staff-only, read-only, and the
        -- reason the panel can now show the stamp instead of guessing at it.
        'instructor_user_id', b.instructor_user_id,
        'offering_id', b.offering_id, 'location_id', b.location_id, 'address', b.address,
        'price_amount', b.price_amount, 'notes', b.notes,
        'travel_before_minutes', b.travel_before_minutes,
        'travel_after_minutes', b.travel_after_minutes, 'series_id', b.series_id)
      -- the client's OWN item: full detail
      WHEN b.client_id = v_client THEN jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'status', b.status, 'all_day', b.all_day,
        'starts_at', b.starts_at, 'ends_at', b.ends_at,
        'is_flexible', b.is_flexible, 'is_mine', true, 'mine_role', 'client',
        'horse_id', b.horse_id, 'offering_id', b.offering_id,
        'location_id', b.location_id, 'address', b.address, 'notes', b.notes,
        'series_id', b.series_id)
      -- a flexible-open block: bookable suggestion
      WHEN b.is_flexible AND b.status = 'available' THEN jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'status', 'available', 'all_day', b.all_day,
        'starts_at', b.starts_at, 'ends_at', b.ends_at,
        'is_flexible', true, 'is_mine', false, 'offering_id', b.offering_id,
        'location_id', b.location_id)
      -- everyone else's taken time: opaque, travel folded into the window
      ELSE jsonb_build_object(
        'id', b.id, 'status', 'unavailable', 'is_mine', false,
        'all_day', b.all_day,
        'starts_at', b.starts_at - make_interval(mins => b.travel_before_minutes),
        'ends_at', b.ends_at + make_interval(mins => b.travel_after_minutes))
    END AS item
    FROM bookings b
    WHERE b.org_id = v_org
      AND b.status NOT IN ('cancelled','expired')
      AND b.starts_at < p_to
      AND (b.ends_at IS NULL OR b.ends_at > p_from)
      -- clients never see other people's drafts
      AND (v_staff OR b.status <> 'draft' OR b.client_id = v_client)
  ) rows
  WHERE item IS NOT NULL;

  RETURN jsonb_build_object(
    'from', p_from, 'to', p_to,
    'role', CASE WHEN v_staff THEN 'staff' ELSE 'client' END,
    'hours', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'weekday', weekday, 'open', open_time, 'close', close_time, 'closed', closed)
        ORDER BY weekday), '[]'::jsonb)
      FROM business_hours WHERE org_id = v_org),
    'items', v_items
  );
END;
$function$;

-- ── (c) ──────────────────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.calendar_revenue(timestamptz, timestamptz) IS
  'RETIRED, NOT DROPPED (D32). ⚠️ DO NOT WIRE THIS TO ANY SURFACE. It sums '
  'bookings.price_amount over the window''s START TIMES — scheduled value at the '
  'moment work is planned — and counts every session of a monthly plan at the '
  'plan''s full price. Measured 2026-08-30 it reads $18,320 for August where '
  '`revenue_summary` reads $1,880 (9.7x). `revenue_summary` is the single source '
  'for money and the calendar ribbon and dashboard tile both already call it '
  '(src/lib/ops/api-calendar.ts fetchRevenue). Zero call sites in src/, api/ or '
  'test/ as of TASK-FIX2, 2026-08-31.';

COMMENT ON FUNCTION public.calendar_money_items(timestamptz, timestamptz) IS
  'RETIRED, NOT DROPPED (D32). Built for the calendar''s money row (payments due, '
  'gift expirations, pending confirmations) and read by nothing — zero call sites '
  'in src/, api/ or test/ as of TASK-FIX2, 2026-08-31. It also carries an unfixed '
  'D25 breach (AR1 F12) that has never been seen because nothing renders it. If it '
  'is ever wired, fix the naming first.';
