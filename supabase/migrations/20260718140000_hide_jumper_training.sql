-- Hide the Hunter / Jumper category from the catalog by deactivating its offerings.
-- The catalog reads active offerings only, so this removes it everywhere. Reversible.
UPDATE public.offerings SET active = false WHERE service_type = 'JUMPER_TRAINING';
