-- Explicit catalog display order (independent of card_weight, which controls SIZE).
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS catalog_rank integer;

UPDATE public.service_types SET catalog_rank = CASE code
  WHEN 'RIDING_LESSON'             THEN 1
  WHEN 'HORSEMANSHIP_TRAINING'     THEN 2
  WHEN 'HORSE_FINDER'              THEN 3
  WHEN 'HORSE_EVALUATION'          THEN 4
  WHEN 'HORSE_TRAINING'            THEN 5
  WHEN 'HORSE_EXERCISE'            THEN 6
  WHEN 'HORSE_CLIPPING'            THEN 7
  WHEN 'HORSE_PURCHASE_ASSISTANCE' THEN 8   -- Transaction Assistance
  ELSE 999 END
WHERE code IN ('RIDING_LESSON','HORSEMANSHIP_TRAINING','HORSE_FINDER','HORSE_EVALUATION',
               'HORSE_TRAINING','HORSE_EXERCISE','HORSE_CLIPPING','HORSE_PURCHASE_ASSISTANCE');
