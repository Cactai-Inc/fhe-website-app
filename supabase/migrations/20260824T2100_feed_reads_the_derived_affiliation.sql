-- ⚠️ A RIDER WHO HAS SIGNED EVERYTHING COULD NOT REACH THE COMMUNITY FEED.
--
-- Owner, 2026-08-24: "it takes me to the dashboard even though there arent any
-- notifications... and the community feed isnt even accessible, perhaps because
-- of an issue with the changes we made? is that a gated path?"
--
-- Not a gate, and not the changes: ONE bug wearing two faces. `Home` (/app, the
-- community front door) redirects to /app/dashboard when `has_feed` is false, so
-- "it sends me to the dashboard" and "the feed is unreachable" are the same
-- redirect reported twice.
--
-- `has_feed` comes from my_view_surfaces, which grants 'feed' only when
-- my_purchase_categories() returns 'riding'. That function derives it from
-- exactly two things: a PURCHASE of a rider-segment offering, or the literal
-- string 'rider' in `contacts.tags` — the free-text CRM column. It has never read
-- `groups`.
--
-- So the DERIVED affiliation — the one apply_affiliations computes from executed
-- documents, purchases and horse ownership, and the one every other surface in
-- the app trusts — was invisible here. A self-service rider who signed all four
-- documents and had not yet bought a lesson held RIDER and got no feed.
--
-- ⚠️ PRE-EXISTING, NOT CAUSED BY TODAY'S WORK. `contacts.tags` and `groups` are
-- two tag systems for one fact, read by different code — the same shape as D20's
-- `is_suspended` / `staff_active` pair. Nothing in OFFERINGDOCS touched either;
-- this account would have been bounced the same way last week.
--
-- The tag branch stays: a staff member may still hand-tag somebody, and removing
-- a working input to add another is not a fix. `groups` is added ALONGSIDE it,
-- mapped exactly as the tag strings already map.
CREATE OR REPLACE FUNCTION public.my_purchase_categories()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(DISTINCT cat ORDER BY cat), ARRAY[]::text[])
  FROM (
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

    UNION

    -- THE DERIVED AFFILIATION — apply_affiliations is the sole writer of these,
    -- computed from executed documents, purchases and horse ownership. Every
    -- other surface already trusts them; this one did not, which is why a rider
    -- with all four releases signed had no community feed.
    SELECT CASE g.group_type
             WHEN 'RIDER'       THEN 'riding'
             WHEN 'HORSE_OWNER' THEN 'care'
             ELSE NULL
           END AS cat
    FROM groups g
    WHERE g.contact_id = current_contact_id()
  ) s
  WHERE cat IS NOT NULL
$function$;
