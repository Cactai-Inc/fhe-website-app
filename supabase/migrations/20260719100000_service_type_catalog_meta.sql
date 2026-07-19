-- Category (service_type) catalog metadata: a cover image and a card-size weight so
-- the in-app/public catalog can render a variable-size grid (important categories
-- larger). card_weight: 2 = large/featured, 1 = standard.
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS cover_image_url text;
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS card_weight integer NOT NULL DEFAULT 1;

-- The owner's importance ranking: larger cards for the marquee services.
UPDATE public.service_types SET card_weight = 2
  WHERE code IN ('RIDING_LESSON', 'HORSEMANSHIP_TRAINING', 'HORSE_FINDER', 'HORSE_TRAINING', 'HORSE_EXERCISE');
UPDATE public.service_types SET card_weight = 1
  WHERE code IN ('HORSE_CLIPPING', 'HORSE_PURCHASE_ASSISTANCE', 'HORSE_EVALUATION',
                 'HORSE_LEASE_IN_ASSISTANCE', 'HORSE_LEASE_OUT_ASSISTANCE', 'HORSE_SALE_ASSISTANCE',
                 'JUMPER_TRAINING');
