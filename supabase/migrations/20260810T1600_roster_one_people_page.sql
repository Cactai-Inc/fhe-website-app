-- TASK-ROSTER (2026-08-10): the Clients page becomes the one people page.
--
-- 1. admin_client_accounts gains a THIRD arm: contacts with no account and no
--    clients row (previously selected by neither arm — they were invisible, not
--    filtered). Scope: contact_type = 'CONTACT' or unfiled (NULL). LEAD stays on
--    the Leads page until worked (owner lifecycle), TEAM stays on Team & access,
--    DIRECTORY stays on the rolodex — deliberate exclusions, but any contact
--    with a live clients row or USER login shows regardless of type.
-- 2. Every row gains the at-a-glance aggregates the owner asked for:
--    document_count, order_count, credits (with the name each credit applies
--    to), and services (consumed service events keyed by service_type code —
--    the positional row band renders these into fixed catalog-derived slots).
-- 3. roster_service_slots(): the slot taxonomy for the band — active service
--    types that have at least one active offering, ordered rider → horse →
--    acquisition so a rider's info clusters left and a horse owner's right.
--
-- "Consumed" = a real service event: a booking in scheduled/confirmed/
-- completed/no_show (available/draft slots and cancellations are not events),
-- plus consumed non-session fulfillment units (periods/milestones/executions;
-- session units are excluded because their booking is already counted).
-- A lesson booking with no offering and no credit is still a riding lesson —
-- kind = 'lesson' falls back to RIDING_LESSON (matches live data, where
-- credit-booked lessons carry no offering_id).

-- Return type widens → must drop first (CREATE OR REPLACE cannot change it).
DROP FUNCTION IF EXISTS public.admin_client_accounts();

CREATE FUNCTION public.admin_client_accounts()
RETURNS TABLE(
  kind text, user_id uuid, contact_id uuid, client_id uuid,
  first_name text, last_name text, display_name text, email text,
  is_suspended boolean, member_status text, created_at timestamp with time zone,
  tags text[], invite_id uuid, invite_status text,
  invite_expires_at timestamp with time zone, invite_scheduled_for date,
  document_count integer, order_count integer, credits jsonb, services jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH base AS (
    -- arm 1: login-backed accounts (unchanged)
    SELECT 'account' AS kind, p.user_id, p.contact_id, cl.id AS client_id,
           p.first_name, p.last_name, p.display_name, p.email,
           p.is_suspended, m.status AS member_status, p.created_at,
           c.tags, NULL::uuid AS invite_id, NULL::text AS invite_status,
           NULL::timestamptz AS invite_expires_at, NULL::date AS invite_scheduled_for
    FROM profiles p
    JOIN contacts c ON c.id = p.contact_id AND c.org_id = current_org() AND c.deleted_at IS NULL
    LEFT JOIN clients cl ON cl.contact_id = p.contact_id AND cl.deleted_at IS NULL
    LEFT JOIN members m ON m.user_id = p.user_id
    WHERE p.role = 'USER' AND is_admin()

    UNION ALL

    -- arm 2: provisioned clients without a login (unchanged)
    SELECT 'pending', NULL, c.id, cl.id,
           c.first_name, c.last_name, NULL, c.email,
           false, NULL, cl.created_at,
           c.tags, inv.id, inv.status, inv.expires_at, inv.scheduled_for
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

    -- arm 3 (NEW): bare contacts — no clients row, no USER login. These were in
    -- neither arm before. LEAD / TEAM / DIRECTORY types live on their own pages.
    SELECT 'contact', NULL, c.id, NULL,
           c.first_name, c.last_name, NULL, c.email,
           false, NULL, c.created_at,
           c.tags, inv.id, inv.status, inv.expires_at, inv.scheduled_for
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
         agg.document_count, agg.order_count, agg.credits, agg.services
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

-- The positional band's slot list: every purchasable service type owns a fixed
-- slot, rider → horse → acquisition. DB-driven — a new offering under a new
-- service type grows a slot without a frontend change.
CREATE OR REPLACE FUNCTION public.roster_service_slots()
RETURNS TABLE(code text, display_name text, segment text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT st.code, st.display_name, st.segment
  FROM service_types st
  WHERE st.active AND st.segment <> 'internal'
    AND EXISTS (SELECT 1 FROM offerings o
                 WHERE o.service_type = st.code AND o.active
                   AND o.org_id = current_org())
  ORDER BY CASE st.segment WHEN 'rider' THEN 1 WHEN 'horse' THEN 2 ELSE 3 END,
           st.sort_order, st.code
$function$;
