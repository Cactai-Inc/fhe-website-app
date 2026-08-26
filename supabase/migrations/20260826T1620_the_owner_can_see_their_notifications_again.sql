-- A notifications zone for the dashboard the owners actually land on
--
-- Owner, 2026-08-26: "the one thing i dont see is a clear set of notifications."
--
-- HE WAS RIGHT, AND THE CAUSE IS A ROUTING SIDE EFFECT, NOT A MISSING FEATURE.
-- `notifications` is written constantly and read back by `DashboardPanel`, which
-- has a working notification list. But TASK-DASHBOARDBUILD sent staff to
-- `OwnerDashboard` instead (DashboardHome.tsx: `if (isStaff) return
-- <OwnerDashboard />`), and OwnerDashboard has no notifications zone. So the two
-- owners were routed away from the only surface that displayed them.
--
-- Measured on production 2026-08-26: 77 unread for admin@fhequestrian.com, 60
-- for hello@fhequestrian.com. 137 unread notifications nobody could see.
--
-- This is D19's "ledgers the app writes and never reads back" exactly -- the same
-- class of defect the B6 zone was built to fix, in the one ledger B6 does not
-- cover.
--
-- ⚠️ UNREAD ONLY, AND NO LIMIT. Owner asked for "full list of notifications,
-- collapsable, never sticky". The other zones cap their list and offer a "+N
-- more" link; this one does not, because a notification list that hides
-- notifications is the thing being complained about. Read ones are history and
-- belong to the activity read-back, not to a list of things wanting attention --
-- and because `count` is the unread count, the zone disappears entirely once he
-- has cleared it, which is the dashboard's own "only shown when there is
-- something to show" rule (owner, 2026-08-22).
--
-- The validity filters are `my_notifications`' filters, deliberately identical:
-- a contract notification whose document was deleted, the retired
-- `contract_cancelled` kind, and the "awaiting archive" titles. Two readers of
-- one table that disagree about what is live would be a second source of truth.

CREATE OR REPLACE FUNCTION public.dash_notifications()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH live AS (
    SELECT n.*
      FROM notifications n
     WHERE n.user_id = auth.uid()
       AND n.read_at IS NULL
       AND (
         n.link IS NULL
         OR n.link !~ '^/app/contracts/[0-9a-fA-F-]{36}$'
         OR EXISTS (
           SELECT 1 FROM documents d
            WHERE d.id = regexp_replace(n.link, '^/app/contracts/', '')::uuid
              AND d.deleted_at IS NULL
         )
       )
       AND n.kind <> 'contract_cancelled'
       AND n.title NOT ILIKE '%awaiting archive%'
  )
  SELECT jsonb_build_object(
    'count', (SELECT count(*) FROM live),
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id',         l.id,
               'kind',       l.kind,
               'category',   l.category,
               'title',      l.title,
               'body',       left(coalesce(l.body, ''), 200),
               'link',       l.link,
               'created_at', l.created_at)
             ORDER BY l.created_at DESC, l.id DESC)
        FROM live l), '[]'::jsonb));
$function$;

REVOKE ALL ON FUNCTION public.dash_notifications() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.dash_notifications() TO authenticated;
