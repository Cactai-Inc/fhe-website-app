-- Owner, 2026-08-15: both Single Lesson cards' gold line is the price context
-- ("Per lesson"); the own-horse one also drops "with your horse" from its
-- description — the row divider carries the distinction, like its neighbors.
UPDATE offerings SET note = 'Per lesson'
WHERE service_type = 'RIDING_LESSON' AND name = 'Single Lesson';

UPDATE offerings SET note = 'Per lesson', tagline = 'An à la carte lesson.'
WHERE service_type = 'RIDING_LESSON' AND name = 'Single Lesson (With your horse)';
