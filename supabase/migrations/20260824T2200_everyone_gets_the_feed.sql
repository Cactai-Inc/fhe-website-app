-- EVERY ACCOUNT HOLDER GETS THE COMMUNITY FEED.
--
-- Owner, 2026-08-24: "Everyone gets the feed remove the guard."
--
-- This restores D8, which already said it and which the code had drifted from:
-- "Community access is gated by ACCOUNT, not documents — any account holder views
-- and participates. GUEST is never a derived group." The feed was instead gated
-- on having a 'riding' category, i.e. on having BOUGHT something — so a horse
-- owner, a deal party, or a rider who had signed everything and not yet purchased
-- was shut out of the community entirely.
--
-- 'feed' and 'community' are granted to every member. They are one thing in two
-- words — reading the feed and posting to it — and splitting them would recreate
-- the gate one surface further down.
--
-- ⚠️ WHAT THIS DOES NOT CHANGE. 'library' stays with 'riding', and the
-- purpose-built deal/care dashboards keep their own categories: those are about
-- what somebody BOUGHT, which is the correct basis for a surface built around a
-- purchase. Only the community is opened to everyone, because the community is
-- about having an account.
CREATE OR REPLACE FUNCTION public.my_view_surfaces()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cats     text[] := my_purchase_categories();
  v_operator boolean := has_staff_access();
  -- D8: an account is the qualification for the community. Nothing else.
  v_surfaces text[] := ARRAY['dashboard', 'feed', 'community']::text[];
BEGIN
  IF v_operator THEN
    v_cats := (SELECT ARRAY(SELECT DISTINCT unnest(v_cats || ARRAY['operator'])));
    v_surfaces := v_surfaces || ARRAY['company'];
  END IF;

  -- The LIBRARY is still a rider surface — it is instructional material for
  -- people taking lessons, not a community space.
  IF 'riding' = ANY(v_cats) THEN
    v_surfaces := v_surfaces || ARRAY['library'];
  END IF;

  IF 'deal' = ANY(v_cats) THEN
    v_surfaces := v_surfaces || ARRAY['deal_dashboard'];
  END IF;
  IF 'care' = ANY(v_cats) THEN
    v_surfaces := v_surfaces || ARRAY['care_dashboard'];
  END IF;

  v_surfaces := v_surfaces || ARRAY['account', 'documents', 'orders'];
  v_surfaces := (SELECT ARRAY(SELECT DISTINCT unnest(v_surfaces) ORDER BY 1));

  RETURN jsonb_build_object(
    'categories', to_jsonb(v_cats),
    'surfaces',   to_jsonb(v_surfaces),
    'has_feed',   ('feed' = ANY(v_surfaces)),
    'has_community', ('community' = ANY(v_surfaces)),
    'is_operator', v_operator
  );
END;
$function$;
