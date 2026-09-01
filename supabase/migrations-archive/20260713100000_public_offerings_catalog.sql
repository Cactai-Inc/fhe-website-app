/*
  # public_offerings — one catalog for web AND app

  Owner-reported: editing the admin catalog didn't change the website, because
  the public pages (BookRider/BookSupport/Services/Shop) read HARDCODED prices
  from src/lib/services.ts, not the offerings table (the admin editor's target,
  40 live rows). This RPC exposes the active offerings to the public so the
  website renders from the same central resource the app and admin editor use.

  Anon-safe: returns ACTIVE offerings only, scoped to the addressed org (the
  tenant whose site is being viewed) or FHE by default. Mirrors the existing
  offerings_public_read RLS but as a stable, typed read the site can bind to.

  Also drops the dead products/product_prices path (a stillborn parallel to
  offerings — 0 rows, only the admin Price-book tab referenced it).
*/

CREATE OR REPLACE FUNCTION public_offerings(p_slug text DEFAULT NULL)
RETURNS TABLE (
  id uuid, segment text, name text, tagline text, description text, slug text,
  service_type text, price_amount numeric, price_unit text, price_min numeric,
  purchase_type text, horse_included boolean, is_popular boolean,
  note text, sort_order integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT o.id, o.segment, o.name, o.tagline, o.description, o.slug,
         o.service_type, o.price_amount, o.price_unit, o.price_min,
         o.purchase_type::text, o.horse_included, o.is_popular,
         o.note, o.sort_order
  FROM offerings o
  JOIN organizations org ON org.id = o.org_id
  WHERE o.active
    AND org.id = COALESCE(
      (SELECT id FROM organizations WHERE slug = p_slug),
      -- default tenant = FHE when no slug (the single-tenant site today)
      'e656f20b-ef43-4725-9029-19e7f0190d9c'::uuid)
  ORDER BY o.segment, o.sort_order, o.name
$$;

GRANT EXECUTE ON FUNCTION public_offerings(text) TO anon, authenticated;

-- NOTE: products/product_prices are a dead parallel to offerings (0 rows), but
-- org_public_config() and provision_tenant() still REFERENCE them — dropping
-- now would break tenant provisioning. Left in place; flagged in the System Map
-- as 'unused, blocked-by-dependents' for owner-directed removal after those two
-- functions are de-referenced.
