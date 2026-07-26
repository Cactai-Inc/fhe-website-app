-- Phase 4a — structural offering config: make the SKU's mechanics DATA, not text.
--
-- Owner-locked model: NO tiers. Every offering is its own SKU distinguished by
-- MECHANICS. Today the unit count + cadence live only in the NAME ("4-Lesson",
-- "2x Weekly") and provisioning regex-parses the name — fragile and unable to
-- express "2x weekly". This migration promotes those to real columns:
--   * config_kind      — the bucket the SKU falls in (drives which config UI + flow)
--   * unit_count       — # of deliverable units for a scheduled SKU (lessons/sessions)
--   * weekly_frequency — sessions per week for a recurring SKU (1x/2x/3x)
-- and adds purchase_items.config (jsonb) to hold the captured INTENT per order line
-- (dates, weekday/time, address, notes). The realized schedule still writes to the
-- real bookings columns (series_id, address, location_id, starts_at/ends_at).
--
-- Buckets (config_kind):
--   scheduled            — rider/training/exercise/clipping ad-hoc: buy N, book 1..N
--   recurring            — monthly 1x/2x/3x weekly: fixed weekday+time series
--   intake_finder        — Find-a-Horse: 0 purchase config, unlocks a criteria form
--   intake_evaluation    — Horse Evaluation: 0 purchase config, unlocks an intake form
--   document_transaction — Transaction Assistance: config is of the DOCUMENTS
--   inquire              — parent grouping rows / inquire-only (price_model kind=inquire)

BEGIN;

ALTER TABLE public.offerings
  ADD COLUMN IF NOT EXISTS config_kind      text,
  ADD COLUMN IF NOT EXISTS unit_count       integer,
  ADD COLUMN IF NOT EXISTS weekly_frequency integer;

ALTER TABLE public.offerings DROP CONSTRAINT IF EXISTS offerings_config_kind_check;
ALTER TABLE public.offerings
  ADD CONSTRAINT offerings_config_kind_check CHECK (config_kind IS NULL OR config_kind = ANY (ARRAY[
    'scheduled','recurring','intake_finder','intake_evaluation','document_transaction','inquire']));

ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ── Backfill config_kind from service_type + purchase_type + price semantics ──
-- recurring = a real subscription with a monthly cadence
UPDATE public.offerings
   SET config_kind = 'recurring'
 WHERE purchase_type = 'subscription' AND price_unit = 'month';

-- acquisition service types map to their intake/document buckets
UPDATE public.offerings SET config_kind = 'intake_finder'
 WHERE service_type = 'HORSE_FINDER' AND config_kind IS NULL;
UPDATE public.offerings SET config_kind = 'intake_evaluation'
 WHERE service_type = 'HORSE_EVALUATION' AND config_kind IS NULL;
UPDATE public.offerings SET config_kind = 'document_transaction'
 WHERE service_type = 'HORSE_PURCHASE_ASSISTANCE' AND config_kind IS NULL;

-- inquire-only / parent grouping rows (no price, or explicit inquire model)
UPDATE public.offerings SET config_kind = 'inquire'
 WHERE config_kind IS NULL
   AND (price_amount IS NULL OR coalesce(price_model->>'kind','') = 'inquire');

-- everything else priced + one-time in a schedulable service type = scheduled
UPDATE public.offerings SET config_kind = 'scheduled'
 WHERE config_kind IS NULL
   AND service_type IN ('RIDING_LESSON','HORSE_TRAINING','HORSE_EXERCISE',
                        'HORSE_CLIPPING','HORSEMANSHIP_TRAINING','JUMPER_TRAINING');

-- any remaining priced rows (e.g. one-off flat services) default to scheduled
UPDATE public.offerings SET config_kind = 'scheduled'
 WHERE config_kind IS NULL AND price_amount IS NOT NULL;

-- ── Backfill weekly_frequency for recurring SKUs from "(N)x Weekly" in the name ──
UPDATE public.offerings
   SET weekly_frequency = (regexp_match(name, '(\d+)\s*[xX]\s*Weekly'))[1]::int
 WHERE config_kind = 'recurring'
   AND name ~ '(\d+)\s*[xX]\s*Weekly';
-- recurring rows whose name doesn't state a cadence default to 1x/week
UPDATE public.offerings SET weekly_frequency = 1
 WHERE config_kind = 'recurring' AND weekly_frequency IS NULL;

-- ── Backfill unit_count for scheduled SKUs ──
-- "(N)-Lesson", "(N)-Class", "(N)-Session", "(N)-Pack", "(N)-Visit" → N
UPDATE public.offerings
   SET unit_count = (regexp_match(name, '(\d+)\s*-?\s*(?:Lesson|Class|Session|Pack|Visit)'))[1]::int
 WHERE config_kind = 'scheduled'
   AND name ~ '(\d+)\s*-?\s*(?:Lesson|Class|Session|Pack|Visit)';
-- a single scheduled unit (Single Lesson / Session / Class / clip) = 1
UPDATE public.offerings SET unit_count = 1
 WHERE config_kind = 'scheduled' AND unit_count IS NULL;

-- ── Surface the new structural columns through the public catalog projection ──
-- (DROP first: a RETURNS TABLE column-set change can't go through CREATE OR REPLACE)
DROP FUNCTION IF EXISTS public.public_offerings(text);
CREATE OR REPLACE FUNCTION public.public_offerings(p_slug text DEFAULT NULL::text)
RETURNS TABLE(id uuid, segment text, name text, tagline text, description text, slug text,
              service_type text, price_amount numeric, price_unit text, price_min numeric,
              purchase_type text, horse_included boolean, is_popular boolean, note text,
              sort_order integer, price_model jsonb,
              config_kind text, unit_count integer, weekly_frequency integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT o.id, o.segment, o.name, o.tagline, o.description, o.slug,
         o.service_type, o.price_amount, o.price_unit, o.price_min,
         o.purchase_type::text, o.horse_included, o.is_popular,
         o.note, o.sort_order, o.price_model,
         o.config_kind, o.unit_count, o.weekly_frequency
  FROM offerings o
  JOIN organizations org ON org.id = o.org_id
  WHERE o.active
    AND org.id = COALESCE(
      (SELECT id FROM organizations WHERE slug = p_slug),
      'e656f20b-ef43-4725-9029-19e7f0190d9c'::uuid)
  ORDER BY o.segment, o.sort_order, o.name
$function$;

COMMIT;
