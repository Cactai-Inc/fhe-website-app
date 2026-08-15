-- LESSONS PAGE CATALOG COPY — owner-directed rewrite, 2026-08-14 (live traffic:
-- the owner's wife just sent the site link to a group of prospects).
--
-- Owner's directions, verbatim where short:
--   · every card said "Tailored instruction for every level" — replaced per-card
--   · gold text pertains to PRICE: evaluation "single lesson, first time riding
--     with us", single "single riding lesson", punch cards show the SAVINGS
--     ("Save $100" / "Save $250" — 8-pack note previously said $150, which is
--     wrong arithmetic anyway: 8 × $150 − $950 = $250)
--   · 8-pack window is 120 days (was written as 90 in description); 4-pack is 60
--   · badge moves: 1x Weekly = "Most Popular", 2x Weekly = "Best Value" — two
--     different labels, which is_popular (a bare boolean) cannot carry, hence the
--     new badge_label column
--   · 3x Weekly is not offered — deactivated (public_offerings filters o.active,
--     so this removes it from every public surface at once)
--   · own-horse cards: same descriptions "with your horse"; the "(With your
--     horse)" name suffix is stripped AT RENDER on the Lessons page only — the DB
--     name stays unique because staff surfaces (orders, admin lists) need to tell
--     the two Single Lessons apart.
--
-- D13 note: badge_label has no editor surface yet — the offering config editor
-- gains it as a follow-up. tagline/note/description already have editors.

-- 1 · the badge label
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS badge_label text;
COMMENT ON COLUMN offerings.badge_label IS
  'Card corner badge text (e.g. "Most Popular", "Best Value"). Rendered when set; is_popular alone renders the legacy "Popular".';

-- 2 · public_offerings grows the column. RETURNS TABLE shape changes require
--     DROP + CREATE; grants are re-asserted below exactly as they stood
--     (service_role, authenticated, anon, postgres, PUBLIC — all EXECUTE).
DROP FUNCTION IF EXISTS public.public_offerings(text);
CREATE FUNCTION public.public_offerings(p_slug text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, segment text, name text, tagline text, description text, slug text, service_type text, price_amount numeric, price_unit text, price_min numeric, purchase_type text, horse_included boolean, is_popular boolean, note text, sort_order integer, price_model jsonb, config_kind text, unit_count integer, weekly_frequency integer, badge_label text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.id, o.segment, o.name, o.tagline, o.description, o.slug,
         o.service_type, o.price_amount, o.price_unit, o.price_min,
         o.purchase_type::text, o.horse_included, o.is_popular,
         o.note, o.sort_order, o.price_model,
         o.config_kind, o.unit_count, o.weekly_frequency, o.badge_label
  FROM offerings o
  JOIN organizations org ON org.id = o.org_id
  WHERE o.active
    AND org.id = COALESCE((SELECT id FROM organizations WHERE slug = p_slug),
      'e656f20b-ef43-4725-9029-19e7f0190d9c'::uuid)
  ORDER BY o.segment, o.sort_order, o.name
$function$;
GRANT EXECUTE ON FUNCTION public.public_offerings(text) TO service_role, authenticated, anon, postgres, PUBLIC;

-- 3 · the copy. Scoped by service_type + exact current name; each UPDATE must
--     hit exactly 1 row (verified after apply).
UPDATE offerings SET
  tagline = 'The first lesson for every new client.',
  note    = 'Single lesson, first time riding with us'
WHERE service_type = 'RIDING_LESSON' AND name = 'Evaluation Lesson';

UPDATE offerings SET
  tagline = 'An à la carte lesson.',
  note    = 'Single riding lesson'
WHERE service_type = 'RIDING_LESSON' AND name = 'Single Lesson';

UPDATE offerings SET
  tagline     = '4 riding lessons used any time within 60 days.',
  description = 'Four private lessons — use them any time within 60 days.'
WHERE service_type = 'RIDING_LESSON' AND name = '4-Lesson Punch Card';

UPDATE offerings SET
  tagline     = '8 riding lessons used any time within 120 days.',
  description = 'Eight private lessons — use them any time within 120 days.',
  note        = 'Save $250'
WHERE service_type = 'RIDING_LESSON' AND name = '8-Lesson Punch Card';

UPDATE offerings SET
  tagline     = 'Ride every week with the option to select the day and time that works best for a consistent riding schedule every week. Flexible rescheduling anytime within the month.',
  is_popular  = true,
  badge_label = 'Most Popular'
WHERE service_type = 'RIDING_LESSON' AND name = '1x Weekly';

UPDATE offerings SET
  tagline     = 'Ride every week with the option to select the days and time that works best for a consistent riding schedule every week. Flexible rescheduling anytime within the month.',
  badge_label = 'Best Value',
  note        = NULL   -- was "Most chosen"; gold text on this card is the computed mechanics line, per owner
WHERE service_type = 'RIDING_LESSON' AND name = '2x Weekly';

UPDATE offerings SET active = false
WHERE service_type = 'RIDING_LESSON' AND name = '3x Weekly';

UPDATE offerings SET
  tagline = 'An à la carte lesson with your horse.',
  note    = 'Single riding lesson with your horse'
WHERE service_type = 'RIDING_LESSON' AND name = 'Single Lesson (With your horse)';

UPDATE offerings SET
  tagline = 'Ride every week with your horse, with the option to select the day and time that works best for a consistent riding schedule every week. Flexible rescheduling anytime within the month.'
WHERE service_type = 'RIDING_LESSON' AND name = '1x Weekly (With your horse)';

UPDATE offerings SET
  tagline = 'Ride every week with your horse, with the option to select the days and time that works best for a consistent riding schedule every week. Flexible rescheduling anytime within the month.'
WHERE service_type = 'RIDING_LESSON' AND name = '2x Weekly (With your horse)';
