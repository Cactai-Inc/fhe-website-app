-- Owner, 2026-08-14: weekly-card descriptions shortened; own-horse carries the
-- "with your horse" marker per the standing pattern. The prorate/reschedule
-- footnote moved out of the cards to a single block below each row (code).
UPDATE offerings SET tagline = 'Dedicated day each week and flexible rescheduling so you never have to miss a lesson.'
WHERE service_type = 'RIDING_LESSON' AND name = '1x Weekly';

UPDATE offerings SET tagline = 'Dedicated days each week and flexible rescheduling so you never have to miss a lesson.'
WHERE service_type = 'RIDING_LESSON' AND name = '2x Weekly';

UPDATE offerings SET tagline = 'Dedicated day each week with your horse and flexible rescheduling so you never have to miss a lesson.'
WHERE service_type = 'RIDING_LESSON' AND name = '1x Weekly (With your horse)';

UPDATE offerings SET tagline = 'Dedicated days each week with your horse and flexible rescheduling so you never have to miss a lesson.'
WHERE service_type = 'RIDING_LESSON' AND name = '2x Weekly (With your horse)';
