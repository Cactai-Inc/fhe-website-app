-- SLICE 4 — PURCHASE-DRIVEN VIEW MODEL
-- The app's surfaces (which sections a member sees) are DERIVED from what they
-- bought, not from a static role. A rider gets the feed + community + library +
-- dashboard; a deal party (finder/brokering) gets a purpose-built deal view with
-- NO feed and NO community; a care client (exercise/clipping/training of their
-- horse) gets a care view, also NO feed/community. Operators (staff/admin) get
-- the company views + the feed. Surfaces compose by UNION and recompute
-- dynamically each load — buy a lesson later and the feed/community light up.
--
-- Category derivation (MASTER-SPEC Part 6):
--   segment 'rider'   → category 'riding'  → surfaces: feed, community, library, dashboard
--   segment 'support' → category 'deal'    → surfaces: deal_dashboard              (NO feed/community)
--   segment 'horse'   → category 'care'    → surfaces: care_dashboard              (NO feed/community)
--   staff/admin       → category 'operator'→ surfaces: feed, company, dashboard
--
-- A member with BOTH a lesson and an evaluation sees riding surfaces AND the deal
-- dashboard — union, no conflict. Feed/community are gated strictly on 'riding' or
-- 'operator' being present.

-- ── the categories a member currently holds (from live, non-deleted engagements) ──
-- Engagements are the durable record of a purchase relationship (an order/line item
-- provisions one). We read the distinct segments of their offerings' service_types.
CREATE OR REPLACE FUNCTION public.my_purchase_categories()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(DISTINCT cat ORDER BY cat), ARRAY[]::text[])
  FROM (
    SELECT CASE o.segment
             WHEN 'rider'   THEN 'riding'
             WHEN 'support' THEN 'deal'
             WHEN 'horse'   THEN 'care'
             ELSE o.segment
           END AS cat
    FROM engagements e
    -- prefer the offering the purchase snapshot points at; fall back to the
    -- engagement's own service_type mapped through the offerings catalog.
    LEFT JOIN client_purchases cp ON cp.engagement_id = e.id
    LEFT JOIN offerings o_cp ON o_cp.id = cp.offering_id
    LEFT JOIN LATERAL (
      SELECT segment FROM offerings o2
      WHERE o2.service_type = e.service_type
      LIMIT 1
    ) o_st ON TRUE
    CROSS JOIN LATERAL (SELECT COALESCE(o_cp.segment, o_st.segment) AS segment) o
    WHERE e.client_id = current_client_id()
      AND e.deleted_at IS NULL
      AND o.segment IS NOT NULL
  ) s
$$;

-- ── the assembled surface set for the signed-in user ──
-- Returns { categories, surfaces, has_feed, is_operator }. The client uses this to
-- decide which nav entries + home surface to render. Recomputed each call so a new
-- purchase (or an operator flag) changes the app with no cache to bust.
CREATE OR REPLACE FUNCTION public.my_view_surfaces()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cats     text[] := my_purchase_categories();
  v_operator boolean := has_staff_access();
  v_surfaces text[] := ARRAY[]::text[];
BEGIN
  -- operator gets company surfaces + feed regardless of personal purchases
  IF v_operator THEN
    v_cats := (SELECT ARRAY(SELECT DISTINCT unnest(v_cats || ARRAY['operator'])));
    v_surfaces := v_surfaces || ARRAY['feed', 'company', 'dashboard'];
  END IF;

  -- riding unlocks the social/library surfaces
  IF 'riding' = ANY(v_cats) THEN
    v_surfaces := v_surfaces || ARRAY['feed', 'community', 'library', 'dashboard'];
  END IF;

  -- deal / care get their own purpose-built dashboards, no feed/community
  IF 'deal' = ANY(v_cats) THEN
    v_surfaces := v_surfaces || ARRAY['deal_dashboard'];
  END IF;
  IF 'care' = ANY(v_cats) THEN
    v_surfaces := v_surfaces || ARRAY['care_dashboard'];
  END IF;

  -- everyone with an account can reach account + documents + orders (the "your
  -- record" surfaces), even a brand-new signer with nothing provisioned yet.
  v_surfaces := v_surfaces || ARRAY['account', 'documents', 'orders'];

  -- de-dupe, stable order
  v_surfaces := (SELECT ARRAY(SELECT DISTINCT unnest(v_surfaces) ORDER BY 1));

  RETURN jsonb_build_object(
    'categories', to_jsonb(v_cats),
    'surfaces',   to_jsonb(v_surfaces),
    'has_feed',   ('feed' = ANY(v_surfaces)),
    'has_community', ('community' = ANY(v_surfaces)),
    'is_operator', v_operator
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_purchase_categories() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_view_surfaces() TO authenticated;
