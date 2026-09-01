-- public_offerings v2: expose price_model (acquisition flexible pricing, display-only)
DROP FUNCTION IF EXISTS public_offerings(text);
CREATE OR REPLACE FUNCTION public_offerings(p_slug text DEFAULT NULL)
RETURNS TABLE (
  id uuid, segment text, name text, tagline text, description text, slug text,
  service_type text, price_amount numeric, price_unit text, price_min numeric,
  purchase_type text, horse_included boolean, is_popular boolean,
  note text, sort_order integer, price_model jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT o.id, o.segment, o.name, o.tagline, o.description, o.slug,
         o.service_type, o.price_amount, o.price_unit, o.price_min,
         o.purchase_type::text, o.horse_included, o.is_popular,
         o.note, o.sort_order, o.price_model
  FROM offerings o
  JOIN organizations org ON org.id = o.org_id
  WHERE o.active
    AND org.id = COALESCE(
      (SELECT id FROM organizations WHERE slug = p_slug),
      'e656f20b-ef43-4725-9029-19e7f0190d9c'::uuid)
  ORDER BY o.segment, o.sort_order, o.name
$$;
GRANT EXECUTE ON FUNCTION public_offerings(text) TO anon, authenticated;
