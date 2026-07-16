-- Two fixes to the surface model:
--
-- 1) EVERYONE gets a dashboard. It's the home of notifications (welcomes, contracts
--    to sign, etc.) — a member with no dashboard has nowhere to see them. Previously
--    a client with no purchase category got only account/documents/orders and
--    Home.tsx bounced them to /app/account in a loop.
--
-- 2) A member's CATEGORY comes from their contact TAGS as well as their purchases.
--    Staff tag a client "Rider" / "Horse owner" when adding them; that should grant
--    the matching surfaces immediately, not wait for a purchase row. (cjzigs was
--    tagged Rider + Horse owner but had no purchase, so got no community/dashboard.)
--
--    Tag → category:  Rider → riding · Horse owner/owner → care ·
--                     Buyer/Seller/Lessee/Lessor → deal

CREATE OR REPLACE FUNCTION public.my_purchase_categories()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(DISTINCT cat ORDER BY cat), ARRAY[]::text[])
  FROM (
    -- from purchases (unchanged)
    SELECT CASE o.segment
             WHEN 'rider'   THEN 'riding'
             WHEN 'support' THEN 'deal'
             WHEN 'horse'   THEN 'care'
             ELSE o.segment
           END AS cat
    FROM purchases pu
    JOIN purchase_items pi ON pi.purchase_id = pu.id
    JOIN offerings o ON o.id = pi.offering_id
    WHERE pu.buyer_contact_id = current_contact_id()
      AND pu.deleted_at IS NULL
      AND o.segment IS NOT NULL

    UNION

    -- from the member's own contact tags (staff-assigned categorization)
    SELECT CASE lower(t)
             WHEN 'rider'       THEN 'riding'
             WHEN 'horse owner' THEN 'care'
             WHEN 'owner'       THEN 'care'
             WHEN 'buyer'       THEN 'deal'
             WHEN 'seller'      THEN 'deal'
             WHEN 'lessee'      THEN 'deal'
             WHEN 'lessor'      THEN 'deal'
             ELSE NULL
           END AS cat
    FROM contacts c
    CROSS JOIN LATERAL unnest(coalesce(c.tags, ARRAY[]::text[])) AS t
    WHERE c.id = current_contact_id()
  ) s
  WHERE cat IS NOT NULL
$function$;

-- Everyone gets a dashboard surface (notifications live there).
CREATE OR REPLACE FUNCTION public.my_view_surfaces()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cats     text[] := my_purchase_categories();
  v_operator boolean := has_staff_access();
  v_surfaces text[] := ARRAY['dashboard']::text[];  -- always present
BEGIN
  IF v_operator THEN
    v_cats := (SELECT ARRAY(SELECT DISTINCT unnest(v_cats || ARRAY['operator'])));
    v_surfaces := v_surfaces || ARRAY['feed', 'company', 'dashboard'];
  END IF;

  IF 'riding' = ANY(v_cats) THEN
    v_surfaces := v_surfaces || ARRAY['feed', 'community', 'library', 'dashboard'];
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
