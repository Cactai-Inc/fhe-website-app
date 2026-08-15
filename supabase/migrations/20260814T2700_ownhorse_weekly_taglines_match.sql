-- Owner, 2026-08-14: own-horse weekly descriptions match the our-horse pair
-- exactly — the row's divider line already says whose horse it is.
UPDATE offerings SET tagline = 'Dedicated day each week and flexible rescheduling so you never have to miss a lesson.'
WHERE service_type = 'RIDING_LESSON' AND name = '1x Weekly (With your horse)';

UPDATE offerings SET tagline = 'Dedicated days each week and flexible rescheduling so you never have to miss a lesson.'
WHERE service_type = 'RIDING_LESSON' AND name = '2x Weekly (With your horse)';
